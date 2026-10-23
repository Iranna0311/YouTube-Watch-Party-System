import { Server } from 'socket.io';
import { Room } from './Room';
import { Participant } from './Participant';

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private io: Server;

  constructor(io: Server) {
    this.io = io;
  }

  /**
   * Generates a random, collision-resistant 6-character room code.
   * Uses readable uppercase alphanumeric characters.
   */
  public generateUniqueCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excludes ambiguous: 0, O, 1, I
    let code: string;
    let attempts = 0;
    do {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      attempts++;
      if (attempts > 100) {
        throw new Error('Failed to generate a unique room code. Too many collisions.');
      }
    } while (this.rooms.has(code));

    return code;
  }

  public createRoom(
    hostUserId: string,
    hostUsername: string,
    hostSocketId: string,
    initialVideoId?: string
  ): { room: Room; host: Participant } {
    const code = this.generateUniqueCode();
    const room = new Room(code, hostUserId, this.io, initialVideoId);
    const host = new Participant(hostUserId, hostUsername, 'Host', hostSocketId);
    
    room.addParticipant(host);
    this.rooms.set(code, room);

    return { room, host };
  }

  public getRoom(code: string): Room | undefined {
    if (!code) return undefined;
    return this.rooms.get(code.toUpperCase().trim());
  }

  public deleteRoom(code: string): boolean {
    const normalized = code.toUpperCase().trim();
    const room = this.rooms.get(normalized);
    if (room) {
      room.destroy();
      return this.rooms.delete(normalized);
    }
    return false;
  }

  public cleanupRoomIfEmpty(code: string): void {
    const room = this.getRoom(code);
    if (room && room.isEmpty()) {
      this.deleteRoom(code);
    }
  }

  public getActiveRoomCount(): number {
    return this.rooms.size;
  }
}

