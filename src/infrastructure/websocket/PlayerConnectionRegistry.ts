import type { Socket } from 'socket.io';

const LOBBY_ROOM = 'active-lobby';

export class PlayerConnectionRegistry {
  private socketToNickname = new Map<string, string>();
  private nicknameToSocket = new Map<string, Socket>();

  isSocketRegistered(socketId: string): boolean {
    return this.socketToNickname.has(socketId);
  }

  isNicknameConnected(nickname: string): boolean {
    return this.nicknameToSocket.has(nickname);
  }

  register(socket: Socket, nickname: string): void {
    this.socketToNickname.set(socket.id, nickname);
    this.nicknameToSocket.set(nickname, socket);
    socket.join(LOBBY_ROOM);
  }

  unregister(socket: Socket): string | null {
    const disconnectedNickname = this.socketToNickname.get(socket.id) ?? null;

    if (disconnectedNickname) {
      this.nicknameToSocket.delete(disconnectedNickname);
    }
    this.socketToNickname.delete(socket.id);
    socket.leave(LOBBY_ROOM);

    return disconnectedNickname;
  }

  getNicknameBySocketId(socketId: string): string | null {
    return this.socketToNickname.get(socketId) ?? null;
  }

  getSocketByNickname(nickname: string): Socket | null {
    return this.nicknameToSocket.get(nickname) ?? null;
  }

  getConnectedCount(): number {
    return this.socketToNickname.size;
  }

  clear(): void {
    this.socketToNickname.clear();
    this.nicknameToSocket.clear();
  }

  get lobbyRoom(): string {
    return LOBBY_ROOM;
  }
}
