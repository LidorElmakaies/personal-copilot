const { test, expect } = require('@playwright/test');

// Account tab's Profile card: Save stays disabled until a field differs from what was loaded.
// Gateway mocked.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, PUT, PATCH, POST, DELETE, OPTIONS',
};

const PROFILE = { firstName: 'Dana', lastName: null, phone: null, location: null };

// Unsigned but well-formed and unexpired — the app only decodes claims, never verifies.
function fakeAccessToken() {
  const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const payload = {
    sub: '11111111-1111-1111-1111-111111111111',
    email: 'e2e@example.com',
    role: 'user',
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.signature`;
}

// redux-persist on web: AsyncStorage → localStorage, each field JSON-stringified on its own.
async function signIn(page) {
  const persisted = JSON.stringify({
    accessToken: JSON.stringify(fakeAccessToken()),
    refreshToken: JSON.stringify('fake-refresh'),
    _persist: JSON.stringify({ version: -1, rehydrated: true }),
  });
  await page.addInitScript((value) => {
    window.localStorage.setItem('persist:auth', value);
  }, persisted);
}

// Every other Gateway call answers 503 (a 401 from the real Gateway would sign the fake session
// out). Returns the recorded PATCH bodies.
async function mockGateway(page) {
  const patches = [];
  const appOrigin = new URL(process.env.E2E_BASE_URL ?? 'http://localhost:8081').origin;
  await page.route(
    (url) => url.origin !== appOrigin,
    (route) =>
      route.request().method() === 'OPTIONS'
        ? route.fulfill({ status: 204, headers: CORS })
        : route.fulfill({ status: 503, json: { message: 'unavailable' }, headers: CORS }),
  );
  await page.route('**/ws/**', (route) => route.abort());
  await page.route('**/users/me', (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (req.method() === 'PATCH') {
      const body = req.postDataJSON();
      patches.push(body);
      return route.fulfill({ json: { ...PROFILE, ...body }, headers: CORS });
    }
    return route.fulfill({ json: PROFILE, headers: CORS });
  });
  return patches;
}

// InputField's label is a sibling Text, so find the field by the first input after it.
const field = (page, label) =>
  page.getByText(label, { exact: true }).locator('xpath=following::input[1]');

// The Pressable carrying the label (RN-web puts aria-disabled on it).
const button = (page, label) =>
  page.getByText(label, { exact: true }).locator('xpath=ancestor::*[@tabindex][1]');

test('Save is disabled until a field changes, and again once it is changed back', async ({ page }) => {
  await signIn(page);
  const patches = await mockGateway(page);
  await page.goto('/account');

  const subtitle = page.getByText('Dana', { exact: true });
  await expect(subtitle).toBeVisible();
  // AccountCard has an Edit too; the Profile card's is the first after its subtitle.
  await subtitle.locator('xpath=following::*[text()="Edit"][1]').click();
  const firstName = field(page, 'First name');
  await expect(firstName).toHaveValue('Dana');

  const save = button(page, 'Save');
  await expect(save).toHaveAttribute('aria-disabled', 'true');
  await save.click({ force: true });
  expect(patches).toEqual([]);

  await firstName.fill('Danah');
  await expect(save).not.toHaveAttribute('aria-disabled', 'true');

  await firstName.fill('Dana');
  await expect(save).toHaveAttribute('aria-disabled', 'true');

  await field(page, 'Last name').fill('Levi');
  await expect(save).not.toHaveAttribute('aria-disabled', 'true');
  await save.click();
  await expect(page.getByText('Dana Levi', { exact: true })).toBeVisible();
  expect(patches).toEqual([{ firstName: 'Dana', lastName: 'Levi', phone: null }]);
});
