import { Role, Action } from '../types';

export class Permissions {
  private static readonly roleActionMap: Record<Role, Set<Action>> = {
    Host: new Set<Action>([
      'play',
      'pause',
      'seek',
      'change_video',
      'assign_role',
      'remove_participant',
      'transfer_host',
      'approve_request',
      'manage_queue',
    ]),
    Moderator: new Set<Action>([
      'play',
      'pause',
      'seek',
      'change_video',
      'approve_request',
      'manage_queue',
    ]),
    Participant: new Set<Action>([]),
  };

  /**
   * Validates whether a given role has the authority to execute an action.
   */
  public static can(role: Role, action: Action): boolean {
    const allowed = this.roleActionMap[role];
    return allowed ? allowed.has(action) : false;
  }
}
