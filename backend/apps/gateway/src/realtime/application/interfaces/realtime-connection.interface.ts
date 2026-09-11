import type { Socket } from 'socket.io';

/** Implemented by RealtimeConnectionService — the entry point any feature uses to reach a user. */
export interface IRealtimeConnectionService {
  register(userId: string, socket: Socket): void;
  unregister(socket: Socket): void;
  /** Emits `event`/`payload` to the user's live connection. False if they have none open. */
  pushToUser<T extends object>(
    userId: string,
    event: string,
    payload: T,
  ): boolean;
}
