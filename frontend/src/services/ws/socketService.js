import { io } from 'socket.io-client';
import { URLS } from '../../config/urls';

let socket = null;

// One shared connection for the whole app — features attach their own listeners via getSocket()
// rather than each opening a connection.
export function connect(token) {
  if (socket) return socket;
  socket = io(URLS.ws.origin, {
    path: URLS.ws.path,
    auth: { token },
    transports: ['websocket'],
  });
  return socket;
}

export function disconnect() {
  socket?.disconnect();
  socket = null;
}

export function getSocket() {
  return socket;
}
