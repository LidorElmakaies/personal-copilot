const { test, expect } = require('@playwright/test');

// The app's one Socket.IO connection to Gateway's /ws, always with this install's device token
// (fetched once from POST /realtime/device and kept): anonymous while signed out, plus the login
// token once signed in; a new login token for the same session keeps the connection and is sent on
// the next reconnect; signing out switches back to anonymous; a refused device token is replaced.
// Gateway mocked; /ws is a minimal Socket.IO server via routeWebSocket.

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
const DEVICE_TOKEN = 'device-token-1';
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
// out — Log Out's revoke is best effort, so a 503 still signs out); /auth/account answers with
// NEW_TOKEN; /realtime/device hands out `deviceTokens` in turn. Returns the device-token requests.
async function mockGateway(page, deviceTokens = [DEVICE_TOKEN]) {
  const deviceRequests = [];
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
  await page.route('**/realtime/device', (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    deviceRequests.push(route.request().method());
    return route.fulfill({
      status: 201,
      json: { device_token: deviceTokens[deviceRequests.length - 1] },
      headers: CORS,
    });
  });
  return deviceRequests;
}

// Engine.IO v4 + Socket.IO v5 over a WebSocket (the client is websocket-only): open packet, then
// answer each namespace CONNECT ("40{auth}") with a CONNECT ack — or, for a device token in
// `refused`, Gateway's CONNECT_ERROR. Records each connection's auth and whether it's still open.
async function mockSocketIo(page, refused = []) {
  const server = { connections: [] };
  await page.routeWebSocket(/\/ws\//, (ws) => {
    const connection = { ws, auth: null, open: true };
    server.connections.push(connection);
    ws.send(
      `0${JSON.stringify({ sid: `eio-${server.connections.length}`, upgrades: [], pingInterval: 25000, pingTimeout: 20000, maxPayload: 1000000 })}`,
    );
    ws.onClose(() => {
      connection.open = false;
    });
    ws.onMessage((message) => {
      if (typeof message === 'string' && message.startsWith('40')) {
        connection.auth = JSON.parse(message.slice(2) || '{}');
        ws.send(
          refused.includes(connection.auth.deviceToken)
            ? `44${JSON.stringify({ message: 'device_token_invalid' })}`
            : `40${JSON.stringify({ sid: `sio-${server.connections.length}` })}`,
        );
      }
    });
  });
  return server;
}

// InputField's label is a sibling Text, so find the field by the first input after it.
const field = (page, label) =>
  page.getByText(label, { exact: true }).locator('xpath=following::input[1]');

const openConnections = (server) => server.connections.filter((c) => c.open);

test('signed out, the app gets a device token once and connects anonymously with it', async ({ page }) => {
  const deviceRequests = await mockGateway(page);
  const server = await mockSocketIo(page);

  await page.goto('/');
  await expect.poll(() => server.connections[0]?.auth).toEqual({ deviceToken: DEVICE_TOKEN });
  expect(server.connections).toHaveLength(1);

  // Kept: a reload connects with the same one, without asking again.
  await page.reload();
  await expect.poll(() => server.connections[1]?.auth).toEqual({ deviceToken: DEVICE_TOKEN });
  expect(deviceRequests).toEqual(['POST']);
});

test('a device token Gateway refuses is replaced, and the app connects with the new one', async ({ page }) => {
  const deviceRequests = await mockGateway(page, ['stale-device-token', DEVICE_TOKEN]);
  const server = await mockSocketIo(page, ['stale-device-token']);

  await page.goto('/');
  await expect.poll(() => server.connections[1]?.auth).toEqual({ deviceToken: DEVICE_TOKEN });
  expect(server.connections[0].auth).toEqual({ deviceToken: 'stale-device-token' });
  expect(deviceRequests).toEqual(['POST', 'POST']);
});

test('an account update keeps the connection, and the next reconnect sends the new token', async ({ page }) => {
  await signIn(page);
  await mockGateway(page);
  const server = await mockSocketIo(page);

  await page.goto('/');
  await expect.poll(() => server.connections[0]?.auth).toEqual({ deviceToken: DEVICE_TOKEN, token: OLD_TOKEN });

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

  // The same connection, still open — not a second one.
  expect(server.connections).toHaveLength(1);
  expect(server.connections[0].open).toBe(true);

  // The server drops it: socket.io reconnects on its own, with the updated token.
  await server.connections[0].ws.close();
  await expect.poll(() => server.connections.length, { timeout: 10_000 }).toBe(2);
  await expect.poll(() => server.connections[1].auth).toEqual({ deviceToken: DEVICE_TOKEN, token: NEW_TOKEN });
});

test('logging out switches the connection to an anonymous one', async ({ page }) => {
  await signIn(page);
  await mockGateway(page);
  const server = await mockSocketIo(page);

  await page.goto('/account');
  await expect.poll(() => server.connections[0]?.auth).toEqual({ deviceToken: DEVICE_TOKEN, token: OLD_TOKEN });

  // LogoutCard: "Log Out" opens the in-card confirm, whose own "Log Out" logs out.
  await page.getByText('Log Out', { exact: true }).click();
  await expect(page.getByText('Log out of your account?')).toBeVisible();
  await page.getByText('Log Out', { exact: true }).first().click();
  await expect(page.getByText('You need to log in to view your account.')).toBeVisible();

  await expect.poll(() => server.connections.length).toBe(2);
  await expect.poll(() => server.connections[1].auth).toEqual({ deviceToken: DEVICE_TOKEN });
  await expect.poll(() => openConnections(server).length).toBe(1);
  expect(server.connections[0].open).toBe(false);
});
