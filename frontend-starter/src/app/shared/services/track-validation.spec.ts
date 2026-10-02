import { describe, expect, it } from 'vitest';
import { validateAudioUpload } from './track-validation';

describe('validateAudioUpload', () => {
  it('accepts a valid mp3 under 25 MB', () => {
    const file = new File(['audio'], 'demo.mp3', { type: 'audio/mpeg' });
    expect(validateAudioUpload(file)).toBeNull();
  });

  it('rejects a missing file', () => {
    expect(validateAudioUpload(undefined)).toBe('Un fichier audio est requis.');
  });

  it('rejects unsupported mime types', () => {
    const file = new File(['text'], 'demo.txt', { type: 'text/plain' });
    expect(validateAudioUpload(file)).toBe('Format audio non pris en charge. Formats acceptés : MP3, WAV, OGG, M4A.');
  });

  it('rejects files over 25MB', () => {
    const file = new File([new Uint8Array(26 * 1024 * 1024)], 'big.mp3', {
      type: 'audio/mpeg',
    });
    expect(validateAudioUpload(file)).toBe('Le fichier ne doit pas dépasser 25 Mo.');
  });
});
