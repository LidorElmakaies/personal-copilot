import { io } from 'socket.io-client';
import { URLS } from '../../config/urls';

let socket = null;
let socketToken = null;
let socketDeviceToken = null;
const listeners = new Set(); // [event, handler] pairs, kept across reconnects

// One shared connection for the whole app, identified by this install's device token; with a
// login token too once signed in. Without one it's anonymous: Gateway sends it only what goes to
// everyone (e.g. `app-update`). Features subscribe with on(), not on the socket itself, so a new
// connection (sign-in/out, back from the background) keeps their handlers.
export function connect(deviceToken, token) {
  if (socket) return socket;
  socketToken = token ?? null;
  socketDeviceToken = deviceToken;
  const current = io(URLS.gateway, {
    path: URLS.wsPath,
    auth: authFor(token),
    transports: ['websocket'],
  });
  // Gateway dropped it on purpose — this device connected again elsewhere (another tab): forget
  // it, so the next connectWebSocket opens a new one. socket.io doesn't reconnect after this.
  current.on('disconnect', (reason) => {
    if (reason === 'io server disconnect' && socket === current) disconnect();
  });
  for (const [event, handler] of listeners) current.on(event, handler);
  socket = current;
  return socket;
}

// A refreshed login token for the open connection — socket.io sends it on its next (re)connect.
export function updateToken(token) {
  if (!socket) return;
  socketToken = token;
  socket.auth = authFor(token);
}

// The login token the open connection was made with (null: anonymous), or undefined with none open.
export function currentToken() {
  return socket ? socketToken : undefined;
}

export function disconnect() {
  socket?.disconnect();
  socket = null;
  socketToken = null;
  socketDeviceToken = null;
}

// Returns the unsubscribe function.
export function on(event, handler) {
  const entry = [event, handler];
  listeners.add(entry);
  socket?.on(event, handler);
  return () => {
    listeners.delete(entry);
    socket?.off(event, handler);
  };
}

function authFor(token) {
  return token
    ? { deviceToken: socketDeviceToken, token }
    : { deviceToken: socketDeviceToken };
}
