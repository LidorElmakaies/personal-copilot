import { forwardedPath } from './forwarded-path';

describe('forwardedPath', () => {
  it.each([
    ['a plain id', 'rem-42', '/things/rem-42'],
    ['a slash', 'a/../b', '/things/a%2F..%2Fb'],
    ['a question mark', 'x?y', '/things/x%3Fy'],
  ])('a param with %s stays one path segment', (_name, id, expected) => {
    expect(forwardedPath('/things/:id', { id }, 'DELETE', '/x')).toBe(expected);
  });

  it("passes a GET's query string on as sent", () => {
    expect(forwardedPath('/users/me', {}, 'GET', '/users/me?a=1&b=2')).toBe(
      '/users/me?a=1&b=2',
    );
  });

  it('drops the query string of anything but a GET', () => {
    expect(forwardedPath('/users/me', {}, 'PATCH', '/users/me?a=1')).toBe(
      '/users/me',
    );
  });
});
