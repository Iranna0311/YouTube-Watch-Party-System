import React from 'react';
import { Crown, Shield, User, UserMinus, ArrowRightLeft } from 'lucide-react';
import { ParticipantData, Role } from '../types';

interface ParticipantListProps {
  participants: ParticipantData[];
  currentUserId: string;
  currentUserRole: Role;
  onAssignRole: (targetUserId: string, newRole: Role) => void;
  onRemoveParticipant: (targetUserId: string) => void;
  onTransferHost: (targetUserId: string) => void;
}

export const ParticipantList: React.FC<ParticipantListProps> = ({
  participants,
  currentUserId,
  currentUserRole,
  onAssignRole,
  onRemoveParticipant,
  onTransferHost,
}) => {
  const isHost = currentUserRole === 'Host';

  const getRoleIcon = (role: Role) => {
    switch (role) {
      case 'Host':
        return <Crown className="w-4 h-4 text-yellow-400" />;
      case 'Moderator':
        return <Shield className="w-4 h-4 text-blue-400" />;
      default:
        return <User className="w-4 h-4 text-gray-400" />;
    }
  };

  const getRoleBadgeClass = (role: Role) => {
    switch (role) {
      case 'Host':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'Moderator':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      default:
        return 'bg-gray-800 text-gray-400 border-gray-700';
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col h-full shadow-lg">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-800">
        <h3 className="font-semibold text-white text-sm flex items-center gap-2">
          <span>Participants</span>
          <span className="bg-gray-800 text-gray-400 text-xs px-2 py-0.5 rounded-full font-mono">
            {participants.length}
          </span>
        </h3>
      </div>

      <div className="space-y-2.5 overflow-y-auto flex-1 pr-1 custom-scrollbar">
        {participants.map((p) => {
          const isSelf = p.userId === currentUserId;
          const isTargetHost = p.role === 'Host';

          return (
            <div
              key={p.userId}
              className={`p-2.5 rounded-lg border transition flex items-center justify-between ${
                isSelf
                  ? 'bg-red-500/5 border-red-500/20'
                  : 'bg-gray-850/60 border-gray-800 hover:border-gray-700'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center font-bold text-xs text-gray-200">
                    {p.username.charAt(0).toUpperCase()}
                  </div>
                  <span
                    className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-gray-900 ${
                      p.isConnected ? 'bg-green-500' : 'bg-gray-500'
                    }`}
                    title={p.isConnected ? 'Connected' : 'Disconnected'}
                  />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-sm text-gray-200 truncate">
                      {p.username}
                    </span>
                    {isSelf && (
                      <span className="text-[10px] bg-red-600/20 text-red-400 px-1 rounded font-semibold">
                        You
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${getRoleBadgeClass(
                        p.role
                      )}`}
                    >
                      {getRoleIcon(p.role)}
                      <span>{p.role}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Host Administrative Controls */}
              {isHost && !isSelf && !isTargetHost && (
                <div className="flex items-center gap-1">
                  {/* Role Selector */}
                  <select
                    value={p.role}
                    onChange={(e) => onAssignRole(p.userId, e.target.value as Role)}
                    className="bg-gray-800 text-gray-300 text-xs border border-gray-700 rounded px-1.5 py-1 focus:outline-none focus:border-red-500"
                    title="Change participant role"
                  >
                    <option value="Participant">Participant</option>
                    <option value="Moderator">Moderator</option>
                  </select>

                  {/* Transfer Host */}
                  <button
                    onClick={() => {
                      if (confirm(`Transfer Host role to ${p.username}?`)) {
                        onTransferHost(p.userId);
                      }
                    }}
                    className="p-1 text-gray-400 hover:text-yellow-400 transition rounded hover:bg-gray-800"
                    title="Transfer Host"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                  </button>

                  {/* Kick Participant */}
                  <button
                    onClick={() => {
                      if (confirm(`Remove and ban ${p.username} from this room?`)) {
                        onRemoveParticipant(p.userId);
                      }
                    }}
                    className="p-1 text-gray-400 hover:text-red-400 transition rounded hover:bg-gray-800"
                    title="Remove user"
                  >
                    <UserMinus className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
