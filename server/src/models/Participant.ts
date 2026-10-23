import { randomUUID } from 'crypto';
import { Role, ParticipantData } from '../types';

export class Participant {
  public readonly userId: string;
  public username: string;
  public role: Role;
  public socketId: string;
  public readonly joinedAt: number;
  public isConnected: boolean;
  public readonly sessionToken: string;

  constructor(
    userId: string,
    username: string,
    role: Role,
    socketId: string,
    existingSessionToken?: string
  ) {
    this.userId = userId;
    this.username = username;
    this.role = role;
    this.socketId = socketId;
    this.joinedAt = Date.now();
    this.isConnected = true;
    this.sessionToken = existingSessionToken || randomUUID();
  }

  public updateSocket(newSocketId: string): void {
    this.socketId = newSocketId;
    this.isConnected = true;
  }

  public setDisconnected(): void {
    this.isConnected = false;
  }

  public setRole(newRole: Role): void {
    this.role = newRole;
  }

  public setUsername(newUsername: string): void {
    this.username = newUsername;
  }

  /**
   * Sanitized public representation broadcast to other users.
   * NEVER exposes sessionToken or internal socketId.
   */
  public toJSON(): ParticipantData {
    return {
      userId: this.userId,
      username: this.username,
      role: this.role,
      joinedAt: this.joinedAt,
      isConnected: this.isConnected,
    };
  }
}
