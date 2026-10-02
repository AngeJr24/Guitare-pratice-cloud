export const MAX_TRACK_SIZE = 25 * 1024 * 1024;

const ALLOWED_AUDIO_TYPES = new Set([
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/mp4',
  'audio/x-m4a',
]);

const ALLOWED_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'm4a']);

export function validateAudioUpload(file?: File): string | null {
  if (!file) {
    return 'Un fichier audio est requis.';
  }

  const extension = file.name.split('.').pop()?.toLowerCase();
  const hasValidMimeType = ALLOWED_AUDIO_TYPES.has(file.type);
  const hasValidExtension = extension ? ALLOWED_EXTENSIONS.has(extension) : false;

  if (!hasValidMimeType && !hasValidExtension) {
    return 'Format audio non pris en charge. Formats acceptés : MP3, WAV, OGG, M4A.';
  }

  if (file.size > MAX_TRACK_SIZE) {
    return 'Le fichier ne doit pas dépasser 25 Mo.';
  }

  return null;
}
