const { test, expect } = require('@playwright/test');

// Home's Live/Disconnected chip across a token change: an account update hands the app a new access
// token while the socket stays up — the chip must stay Live, and the next reconnect must send the
// new token. Gateway mocked; /ws is a minimal Socket.IO server via routeWebSocket.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, PUT, PATCH, POST, DELETE, OPTIONS',
};

// Unsigned but well-formed and unexpired — the app only decodes claims, never verifies.
function fakeAccessToken(email) {
  const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const payload = {
    sub: '11111111-1111-1111-1111-111111111111',
    email,
    role: 'user',
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.signature`;
}

const OLD_TOKEN = fakeAccessToken('e2e@example.com');
const NEW_TOKEN = fakeAccessToken('e2e-new@example.com');

// redux-persist on web: AsyncStorage → localStorage, each field JSON-stringified on its own.
async function signIn(page) {
  const persisted = JSON.stringify({
    accessToken: JSON.stringify(OLD_TOKEN),
    refreshToken: JSON.stringify('fake-refresh'),
    _persist: JSON.stringify({ version: -1, rehydrated: true }),
  });
  await page.addInitScript((value) => {
    if (!sessionStorage.getItem('e2e-signed-in')) {
      sessionStorage.setItem('e2e-signed-in', '1');
      localStorage.setItem('persist:auth', value);
    }
  }, persisted);
}

// Every other Gateway call answers 503 (a 401 from the real Gateway would sign the fake session
// out); /auth/account answers with NEW_TOKEN.
async function mockGateway(page) {
  const appOrigin = new URL(process.env.E2E_BASE_URL ?? 'http://localhost:8081').origin;
  await page.route(
    (url) => url.origin !== appOrigin,
    (route) =>
      route.request().method() === 'OPTIONS'
        ? route.fulfill({ status: 204, headers: CORS })
        : route.fulfill({ status: 503, json: { message: 'unavailable' }, headers: CORS }),
  );
  await page.route('**/auth/account', (route) =>
    route.request().method() === 'OPTIONS'
      ? route.fulfill({ status: 204, headers: CORS })
      : route.fulfill({
          json: { access_token: NEW_TOKEN, refresh_token: 'fake-refresh-2' },
          headers: CORS,
        }),
  );
}

// Engine.IO v4 + Socket.IO v5 over a WebSocket (the client is websocket-only): open packet, then
// answer each namespace CONNECT ("40{auth}") with a CONNECT ack. Records each connection's auth.
async function mockSocketIo(page) {
  const server = { connections: [] };
  await page.routeWebSocket(/\/ws\//, (ws) => {
    const connection = { ws, auth: null };
    server.connections.push(connection);
    ws.send(
      `0${JSON.stringify({ sid: `eio-${server.connections.length}`, upgrades: [], pingInterval: 25000, pingTimeout: 20000, maxPayload: 1000000 })}`,
    );
    ws.onMessage((message) => {
      if (typeof message === 'string' && message.startsWith('40')) {
        connection.auth = JSON.parse(message.slice(2) || '{}');
        ws.send(`40${JSON.stringify({ sid: `sio-${server.connections.length}` })}`);
      }
    });
  });
  return server;
}

const chip = (page, label) => page.getByText(label, { exact: true });

// InputField's label is a sibling Text, so find the field by the first input after it.
const field = (page, label) =>
  page.getByText(label, { exact: true }).locator('xpath=following::input[1]');

test('an account update keeps the chip Live, and the next reconnect sends the new token', async ({ page }) => {
  await signIn(page);
  await mockGateway(page);
  const server = await mockSocketIo(page);

  await page.goto('/');
  await expect(chip(page, 'Live')).toBeVisible();
  expect(server.connections).toHaveLength(1);
  expect(server.connections[0].auth).toEqual({ token: OLD_TOKEN });

  // In-app navigation keeps the socket; a page.goto would start a fresh one.
  await page.getByText('Account', { exact: true }).click();
  await page.getByText('Edit', { exact: true }).first().click();
  await field(page, 'Email').fill('e2e-new@example.com');
  await field(page, 'Current password').fill('current-password');
  const update = page.waitForResponse(
    (r) => r.url().endsWith('/auth/account') && r.request().method() === 'POST',
  );
  await page.getByText('Save', { exact: true }).click();
  await update;
  await expect(page.getByText('Account updated.')).toBeVisible();

  await page.getByText('Home', { exact: true }).click();
  await expect(chip(page, 'Live')).toBeVisible();
  await expect(chip(page, 'Disconnected')).toHaveCount(0);
  // The same connection, not a second one.
  expect(server.connections).toHaveLength(1);

  // The server drops it: socket.io reconnects on its own, with the updated token.
  await server.connections[0].ws.close();
  await expect.poll(() => server.connections.length, { timeout: 10_000 }).toBe(2);
  await expect.poll(() => server.connections[1].auth).toEqual({ token: NEW_TOKEN });
  await expect(chip(page, 'Live')).toBeVisible();
});
