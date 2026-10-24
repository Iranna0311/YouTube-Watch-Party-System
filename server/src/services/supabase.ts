/**
 * Supabase Database Persistence Layer
 *
 * Implements durable persistence for:
 * - Rooms (creation, current video, active host)
 * - Chat Messages (persisted chat history)
 * - Audit Logs (moderation and role changes)
 *
 * Architecture note:
 * Real-time video clock sync (play/pause/seek) stays in memory/WebSockets for 0ms latency.
 * Supabase handles durable persistence on room lifecycle and message events.
 * Gracefully degrades to in-memory if Supabase credentials are not set or unreachable.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ChatMessage, AuditLogEntry } from '../types';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xowjxmkhpsdyhayjcaax.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const supabase: SupabaseClient | null = (SUPABASE_URL && SUPABASE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false },
    })
  : null;

if (supabase) {
  console.log(`[WatchParty Database] Supabase client initialized for: ${SUPABASE_URL}`);
} else {
  console.log('[WatchParty Database] Running in in-memory mode (SUPABASE_KEY not set). Persistence disabled.');
}

/**
 * Persist or update a room record
 */
export async function dbPersistRoom(code: string, hostId: string, initialVideoId: string = 'M7lc1UVf-VE'): Promise<void> {
  if (!supabase) return;
  try {
    const { error } = await supabase.from('rooms').upsert({
      code,
      host_id: hostId,
      current_video_id: initialVideoId,
      play_state: 'paused',
      current_time: 0,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      console.warn(`[WatchParty Database] Failed to upsert room ${code}:`, error.message);
    }
  } catch (err) {
    console.warn(`[WatchParty Database] Network error upserting room ${code}:`, err);
  }
}

/**
 * Update video state when video changes or advances
 */
export async function dbUpdateRoomVideo(code: string, videoId: string): Promise<void> {
  if (!supabase) return;
  try {
    const { error } = await supabase.from('rooms').update({
      current_video_id: videoId,
      updated_at: new Date().toISOString(),
    }).eq('code', code);
    if (error) {
      console.warn(`[WatchParty Database] Failed to update room video for ${code}:`, error.message);
    }
  } catch (err) {
    console.warn(`[WatchParty Database] Network error updating room video:`, err);
  }
}

/**
 * Persist a chat message
 */
export async function dbPersistChatMessage(roomCode: string, msg: ChatMessage): Promise<void> {
  if (!supabase) return;
  try {
    const { error } = await supabase.from('chat_messages').insert({
      room_code: roomCode,
      user_id: msg.userId,
      username: msg.username,
      role: msg.role,
      text: msg.text,
      created_at: new Date(msg.timestamp).toISOString(),
    });
    if (error) {
      console.warn(`[WatchParty Database] Failed to persist chat for ${roomCode}:`, error.message);
    }
  } catch (err) {
    console.warn(`[WatchParty Database] Network error persisting chat:`, err);
  }
}

/**
 * Persist an audit log entry
 */
export async function dbPersistAuditLog(roomCode: string, log: AuditLogEntry): Promise<void> {
  if (!supabase) return;
  try {
    const { error } = await supabase.from('audit_logs').insert({
      room_code: roomCode,
      action: log.action,
      performed_by: log.performer,
      details: log.details,
      created_at: new Date(log.timestamp).toISOString(),
    });
    if (error) {
      console.warn(`[WatchParty Database] Failed to persist audit log for ${roomCode}:`, error.message);
    }
  } catch (err) {
    console.warn(`[WatchParty Database] Network error persisting audit log:`, err);
  }
}

/**
 * Fetch recent chat history for a room
 */
export async function dbFetchRecentChat(roomCode: string, limit: number = 50): Promise<ChatMessage[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('room_code', roomCode)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error || !data) return [];

    return data.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      username: row.username,
      role: row.role,
      text: row.text,
      timestamp: new Date(row.created_at).getTime(),
    }));
  } catch {
    return [];
  }
}
