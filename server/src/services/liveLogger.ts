import fs from 'fs';
import path from 'path';
import { ChatMessage, AuditLogEntry } from '../types';
import { dbPersistAuditLog, dbPersistChatMessage } from './supabase';

const DATA_DIR = path.resolve(__dirname, '../../data');
const CHAT_CSV_PATH = path.join(DATA_DIR, 'live_chat_history.csv');
const ACTIVITY_CSV_PATH = path.join(DATA_DIR, 'live_activity_logs.csv');

// Initialize data directory and CSV headers
function initCsvFiles() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(CHAT_CSV_PATH)) {
      fs.writeFileSync(
        CHAT_CSV_PATH,
        'timestamp,iso_time,room_code,message_id,user_id,username,role,message_text\n',
        'utf8'
      );
    }

    if (!fs.existsSync(ACTIVITY_CSV_PATH)) {
      fs.writeFileSync(
        ACTIVITY_CSV_PATH,
        'timestamp,iso_time,room_code,event_type,user_id,username,role,details\n',
        'utf8'
      );
    }
  } catch (err) {
    console.warn('[LiveLogger] Failed to initialize CSV storage:', err);
  }
}

initCsvFiles();

function escapeCsv(text: string): string {
  if (!text) return '""';
  const str = String(text).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Log user join event (persists to Supabase audit_logs + live CSV)
 */
export async function logUserJoin(roomCode: string, userId: string, username: string, role: string) {
  const now = Date.now();
  const iso = new Date(now).toISOString();
  const details = `${username} entered room ${roomCode} as ${role}`;

  // 1. Append to local CSV file
  try {
    const row = `${now},${iso},${escapeCsv(roomCode)},${escapeCsv('USER_JOIN')},${escapeCsv(userId)},${escapeCsv(username)},${escapeCsv(role)},${escapeCsv(details)}\n`;
    fs.appendFileSync(ACTIVITY_CSV_PATH, row, 'utf8');
  } catch (err) {
    console.warn('[LiveLogger] CSV append error for join:', err);
  }

  // 2. Persist to Supabase audit_logs table
  const audit: AuditLogEntry = {
    id: 'log_' + Math.random().toString(36).substring(2, 9),
    action: 'USER_JOIN',
    performer: username,
    details,
    timestamp: now,
  };
  await dbPersistAuditLog(roomCode, audit);
}

/**
 * Log user chat message (persists to Supabase chat_messages + live CSV)
 */
export async function logChatMessage(roomCode: string, msg: ChatMessage) {
  const iso = new Date(msg.timestamp).toISOString();

  // 1. Append to local CSV file
  try {
    const row = `${msg.timestamp},${iso},${escapeCsv(roomCode)},${escapeCsv(msg.id)},${escapeCsv(msg.userId)},${escapeCsv(msg.username)},${escapeCsv(msg.role)},${escapeCsv(msg.text)}\n`;
    fs.appendFileSync(CHAT_CSV_PATH, row, 'utf8');
  } catch (err) {
    console.warn('[LiveLogger] CSV append error for chat:', err);
  }

  // 2. Persist to Supabase chat_messages table
  await dbPersistChatMessage(roomCode, msg);
}

/**
 * Log user leave/disconnect event (persists to Supabase audit_logs + live CSV)
 */
export async function logUserLeave(roomCode: string, userId: string, username: string, role: string) {
  const now = Date.now();
  const iso = new Date(now).toISOString();
  const details = `${username} left room ${roomCode}`;

  // 1. Append to local CSV file
  try {
    const row = `${now},${iso},${escapeCsv(roomCode)},${escapeCsv('USER_LEAVE')},${escapeCsv(userId)},${escapeCsv(username)},${escapeCsv(role)},${escapeCsv(details)}\n`;
    fs.appendFileSync(ACTIVITY_CSV_PATH, row, 'utf8');
  } catch (err) {
    console.warn('[LiveLogger] CSV append error for leave:', err);
  }

  // 2. Persist to Supabase audit_logs table
  const audit: AuditLogEntry = {
    id: 'log_' + Math.random().toString(36).substring(2, 9),
    action: 'USER_LEAVE',
    performer: username,
    details,
    timestamp: now,
  };
  await dbPersistAuditLog(roomCode, audit);
}

export function getChatCsvPath(): string {
  return CHAT_CSV_PATH;
}

export function getActivityCsvPath(): string {
  return ACTIVITY_CSV_PATH;
}
