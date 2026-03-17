import type { Socket } from 'socket.io';

const LOBBY_ROOM = 'active-lobby';

export class PlayerConnectionRegistry {
  private socketToNickname = new Map<string, string>();
  private nicknameToSocket = new Map<string, Socket>();

  isSocketRegistered(socketId: string): boolean {
    return this.socketToNickname.has(socketId);
  }

  isNicknameConnected(nickname: string): boolean {
    const socket = this.nicknameToSocket.get(nickname);
    if (!socket) return false;
    // Verify the socket is actually alive, not just in the Map
    if (!socket.connected) {
      this.nicknameToSocket.delete(nickname);
      this.socketToNickname.delete(socket.id);
      return false;
    }
    return true;
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
    const socket = this.nicknameToSocket.get(nickname) ?? null;
    if (socket && !socket.connected) {
      this.nicknameToSocket.delete(nickname);
      this.socketToNickname.delete(socket.id);
      return null;
    }
    return socket;
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
