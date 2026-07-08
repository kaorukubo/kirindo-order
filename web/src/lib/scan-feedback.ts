let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    try {
      audioCtx = new AudioContext();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

function beep(frequency: number, durationMs: number, volume = 0.15) {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = frequency;
  gain.gain.value = volume;
  osc.connect(gain);
  gain.connect(ctx.destination);
  const t = ctx.currentTime;
  osc.start(t);
  osc.stop(t + durationMs / 1000);
}

export function scanSuccessFeedback() {
  beep(880, 60);
  setTimeout(() => beep(1175, 50), 70);
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate([30, 40, 30]);
  }
}

export function scanErrorFeedback() {
  beep(220, 120, 0.12);
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(200);
  }
}

export function scanUnknownFeedback() {
  beep(440, 80);
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(100);
  }
}
