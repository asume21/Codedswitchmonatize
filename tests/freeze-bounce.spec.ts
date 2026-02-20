import { test, expect } from '@playwright/test';
import { createBounceFingerprint, evaluateBounceParity } from '../client/src/lib/freezeBounce';

function makeMockBuffer(channelData: number[][]): AudioBuffer {
  const channels = channelData.map((row) => Float32Array.from(row));
  const length = channels[0]?.length ?? 0;

  return {
    numberOfChannels: channels.length,
    length,
    getChannelData: (channel: number) => channels[channel] ?? new Float32Array(length),
  } as AudioBuffer;
}

test.describe('Freeze/Bounce parity helpers', () => {
  test('createBounceFingerprint is deterministic for identical buffers', () => {
    const bufferA = makeMockBuffer([
      [0, 0.2, -0.2, 0.5, -0.5, 0.1],
      [0, 0.1, -0.1, 0.25, -0.25, 0.05],
    ]);
    const bufferB = makeMockBuffer([
      [0, 0.2, -0.2, 0.5, -0.5, 0.1],
      [0, 0.1, -0.1, 0.25, -0.25, 0.05],
    ]);

    const fpA = createBounceFingerprint(bufferA, 256);
    const fpB = createBounceFingerprint(bufferB, 256);

    expect(fpA).toBe(fpB);
  });

  test('createBounceFingerprint changes when audio content changes', () => {
    const bufferA = makeMockBuffer([[0, 0.2, -0.2, 0.5, -0.5, 0.1]]);
    const bufferB = makeMockBuffer([[0, 0.2, -0.18, 0.48, -0.45, 0.08]]);

    const fpA = createBounceFingerprint(bufferA, 256);
    const fpB = createBounceFingerprint(bufferB, 256);

    expect(fpA).not.toBe(fpB);
  });

  test('evaluateBounceParity returns null when no expected fingerprint is provided', () => {
    const result = evaluateBounceParity('', {
      peak: 0.8,
      rms: 0.22,
      fingerprint: 'abc123ef',
    });

    expect(result).toBeNull();
  });

  test('evaluateBounceParity returns severity none for exact match', () => {
    const result = evaluateBounceParity('ABC123EF', {
      peak: 0.8,
      rms: 0.22,
      fingerprint: 'abc123ef',
    });

    expect(result).toBeTruthy();
    expect(result?.matches).toBeTruthy();
    expect(result?.severity).toBe('none');
  });

  test('evaluateBounceParity returns warning for mismatch', () => {
    const result = evaluateBounceParity('abc123ef', {
      peak: 0.8,
      rms: 0.22,
      fingerprint: 'ff0011aa',
    });

    expect(result).toBeTruthy();
    expect(result?.matches).toBeFalsy();
    expect(result?.severity).toBe('warning');
    expect(result?.expectedFingerprint).toBe('abc123ef');
    expect(result?.actualFingerprint).toBe('ff0011aa');
  });
});
