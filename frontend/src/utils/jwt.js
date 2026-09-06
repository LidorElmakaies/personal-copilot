// Reads claims only — never verifies the signature, that's the server's job.
export function decodeJwtPayload(token) {
  try {
    const [, payload] = token.split('.');
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json =
      typeof atob === 'function'
        ? atob(base64)
        : Buffer.from(base64, 'base64').toString('utf-8'); // RN/Metro polyfills atob; fallback only
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// The server never hands back a `user` object — see docs/specs/services.md#auth.
export function getUserFromToken(token) {
  const payload = decodeJwtPayload(token);
  if (!payload?.sub) return null;
  return { id: payload.sub, email: payload.email, role: payload.role };
}

export function isTokenExpired(token) {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return true; // unparseable/malformed — treat as invalid, not as "fine"
  return Date.now() >= payload.exp * 1000;
}

// Milliseconds until the token's exp claim is reached (0 if already past/unparseable).
export function msUntilExpiry(token) {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return 0;
  return Math.max(0, payload.exp * 1000 - Date.now());
}
