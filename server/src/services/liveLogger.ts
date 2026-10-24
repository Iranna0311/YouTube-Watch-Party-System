import fs from 'fs';
import path from 'path';
import { ChatMessage, AuditLogEntry } from '../types';
import { dbPersistAuditLog, dbPersistChatMessage, supabase } from './supabase';

const DATA_DIR = path.resolve(__dirname, '../../data');
const CHAT_CSV_PATH = path.join(DATA_DIR, 'live_chat_history.csv');
const ACTIVITY_CSV_PATH = path.join(DATA_DIR, 'live_activity_logs.csv');

// Set to track recorded row keys and avoid duplicate lines
const recordedKeys = new Set<string>();

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
    } else {
      const chatLines = fs.readFileSync(CHAT_CSV_PATH, 'utf8').split('\n');
      for (const line of chatLines) {
        const parts = line.split(',');
        if (parts[3]) recordedKeys.add(parts[3].replace(/"/g, '').trim());
      }
    }

    if (!fs.existsSync(ACTIVITY_CSV_PATH)) {
      fs.writeFileSync(
        ACTIVITY_CSV_PATH,
        'timestamp,iso_time,room_code,event_type,user_id,username,role,details\n',
        'utf8'
      );
    } else {
      const actLines = fs.readFileSync(ACTIVITY_CSV_PATH, 'utf8').split('\n');
      for (const line of actLines) {
        const parts = line.split(',');
        if (parts[0]) recordedKeys.add(parts[0].trim());
      }
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
  recordedKeys.add(String(now));

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
  recordedKeys.add(msg.id);

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
  recordedKeys.add(String(now));

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

/**
 * Real-time Cloud Sync:
 * Listens to Supabase for events occurring on Render or Vercel
 * and immediately synchronizes them down into the local CSV files!
 */
export function startCloudRealtimeSync() {
  if (!supabase) return;

  try {
    // Sync activity logs (rooms created, joined, left on Render/Vercel)
    supabase
      .channel('cloud-activity-sync')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs' }, (payload) => {
        const row = payload.new;
        if (!row) return;
        const key = row.id || `${row.created_at}_${row.room_code}`;
        if (recordedKeys.has(key)) return;
        recordedKeys.add(key);

        const ts = row.created_at ? new Date(row.created_at).getTime() : Date.now();
        const iso = new Date(ts).toISOString();
        const csvLine = `${ts},${iso},${escapeCsv(row.room_code || '')},${escapeCsv(row.action || '')},${escapeCsv(row.id || '')},${escapeCsv(row.performed_by || '')},${escapeCsv('Participant')},${escapeCsv(row.details || '')}\n`;

        fs.appendFile(ACTIVITY_CSV_PATH, csvLine, 'utf8', () => {});
      })
      .subscribe();

    // Sync chat messages sent on Render/Vercel
    supabase
      .channel('cloud-chat-sync')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        const row = payload.new;
        if (!row) return;
        const msgId = row.id || `msg_${Date.now()}`;
        if (recordedKeys.has(msgId)) return;
        recordedKeys.add(msgId);

        const ts = row.created_at ? new Date(row.created_at).getTime() : Date.now();
        const iso = new Date(ts).toISOString();
        const csvLine = `${ts},${iso},${escapeCsv(row.room_code || '')},${escapeCsv(msgId)},${escapeCsv(row.user_id || '')},${escapeCsv(row.username || '')},${escapeCsv(row.role || '')},${escapeCsv(row.text || '')}\n`;

        fs.appendFile(CHAT_CSV_PATH, csvLine, 'utf8', () => {});
      })
      .subscribe();

    console.log('[WatchParty Cloud Sync] Active: Real-time sync from Render & Vercel -> Local CSVs');
  } catch (err) {
    console.warn('[WatchParty Cloud Sync] Failed to initialize:', err);
  }
}

export function getChatCsvPath(): string {
  return CHAT_CSV_PATH;
}

export function getActivityCsvPath(): string {
  return ACTIVITY_CSV_PATH;
}
