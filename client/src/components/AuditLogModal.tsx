import React from 'react';
import { History, X } from 'lucide-react';
import { AuditLogEntry } from '../types';

interface AuditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: AuditLogEntry[];
}

export const AuditLogModal: React.FC<AuditLogModalProps> = ({ isOpen, onClose, logs }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between pb-3 border-b border-gray-800 mb-4">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-red-500" />
            <h3 className="text-base font-bold text-white">Room Activity Audit Log</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar text-xs">
          {logs.length === 0 ? (
            <div className="text-center py-8 text-gray-500 italic">No activity recorded yet.</div>
          ) : (
            [...logs].reverse().map((entry) => (
              <div
                key={entry.id}
                className="p-3 rounded-xl bg-gray-800/60 border border-gray-800/80 flex flex-col gap-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-200">{entry.performer}</span>
                  <span className="text-[10px] text-gray-400 font-mono">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-gray-300 text-xs">{entry.details}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

