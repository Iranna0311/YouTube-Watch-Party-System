export function extractYouTubeVideoId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // If already a valid 11-character video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // Regex matching watch?v=, youtu.be/, shorts/, embed/, etc.
  const regExp =
    /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = trimmed.match(regExp);

  return match ? match[1] : null;
}

export function formatTime(seconds: number): string {
  const floorSec = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(floorSec / 60);
  const remainingSecs = floorSec % 60;
  return `${mins}:${remainingSecs < 10 ? '0' : ''}${remainingSecs}`;
}

