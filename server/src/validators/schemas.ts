import { z } from 'zod';

// Strict YouTube 11-char video ID pattern
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/** Accepts a raw YouTube URL or a bare 11-char ID; coerces to the ID or fails. */
const VideoIdField = z
  .string()
  .trim()
  .min(1)
  .max(256)
  .transform((val, ctx) => {
    // Bare ID
    if (VIDEO_ID_RE.test(val)) return val;

    // Extract from URL
    const regExp =
      /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;
    const match = val.match(regExp);
    if (match && match[1]) return match[1];

    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid YouTube URL or 11-character video ID' });
    return z.NEVER;
  });

const SeekTime = z
  .number()
  .finite()
  .min(0)
  .max(86400); // max 24 h

const UsernameField = z
  .string()
  .trim()
  .min(1, 'Username is required')
  .max(32, 'Username must be 32 characters or fewer');

const UserIdField = z.string().min(1).max(64);

export const CreateRoomSchema = z.object({
  userId: UserIdField,
  username: UsernameField,
  initialVideoId: VideoIdField.optional(),
});

export const JoinRoomSchema = z.object({
  roomId: z.string().trim().min(1).max(12),
  username: UsernameField,
  userId: UserIdField,
  sessionToken: z.string().min(1).max(128).optional(),
});

export const SeekSchema = z.object({
  time: SeekTime,
});

export const ChangeVideoSchema = z.object({
  videoId: VideoIdField,
});

export const AssignRoleSchema = z.object({
  userId: UserIdField,
  role: z.enum(['Host', 'Moderator', 'Participant']),
});

export const RemoveParticipantSchema = z.object({
  userId: UserIdField,
});

export const TransferHostSchema = z.object({
  userId: UserIdField,
});

export const ChangeRequestSchema = z.object({
  type: z.enum(['change_video', 'seek', 'play', 'pause', 'add_to_queue']),
  payload: z.any(),
});

export const ApproveRejectSchema = z.object({
  requestId: z.string().min(1).max(64),
});

export const AddToQueueSchema = z.object({
  videoId: VideoIdField,
  title: z.string().trim().max(100).optional(),
});

export const ChatMessageSchema = z.object({
  text: z.string().trim().max(500).default(''),
  audioUrl: z.string().max(2500000).optional(),
  audioDuration: z.number().max(120).optional(),
}).refine((data) => data.text.length > 0 || (typeof data.audioUrl === 'string' && data.audioUrl.length > 0), {
  message: 'Message must contain either text or an audio recording',
});

export const ReactionSchema = z.object({
  emoji: z.string().min(1).max(8),
});

/** Used server-side when processing a change_request payload for a video change. */
export const VideoIdPayloadSchema = z.object({
  videoId: VideoIdField,
});

/** Used server-side when processing a change_request payload for seek. */
export const SeekPayloadSchema = z.object({
  time: SeekTime,
});

export const VideoEndedSchema = z.object({
  videoId: z.string().regex(VIDEO_ID_RE, 'Invalid video ID format'),
});
