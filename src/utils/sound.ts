let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) {
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume();
  }
  return audioCtx;
}

function playTone(
  frequency: number,
  durationMs: number,
  startOffsetSec = 0,
  type: OscillatorType = 'sine',
  gainLevel = 0.08
): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const start = ctx.currentTime + startOffsetSec;
  const end = start + durationMs / 1000;

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);

  gain.gain.setValueAtTime(0.001, start);
  gain.gain.exponentialRampToValueAtTime(gainLevel, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, end);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(start);
  osc.stop(end + 0.02);
}

export function playSuccessChime(enabled: boolean): void {
  if (!enabled) return;
  playTone(659.25, 110, 0, 'sine', 0.09); // E5
  playTone(880.0, 180, 0.08, 'sine', 0.09); // A5
}

export function playDuplicateChime(enabled: boolean): void {
  if (!enabled) return;
  playTone(523.25, 90, 0, 'triangle', 0.07);
  playTone(523.25, 90, 0.12, 'triangle', 0.07);
}

export function playErrorChime(enabled: boolean): void {
  if (!enabled) return;
  playTone(260, 180, 0, 'sawtooth', 0.05);
}
