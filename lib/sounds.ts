// Simple synthesized sound effects using Web Audio API
// No external audio files needed

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  // Resume if suspended (browser autoplay policy)
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

/** Short rising blip — ball moves to a new cell */
export function playMove() {
  const c = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(440, c.currentTime);
  osc.frequency.linearRampToValueAtTime(660, c.currentTime + 0.08);
  gain.gain.setValueAtTime(0.15, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.12);
  osc.connect(gain).connect(c.destination);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + 0.12);
}

/** Bouncy ascending tone — jump */
export function playJump() {
  const c = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(350, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(900, c.currentTime + 0.15);
  gain.gain.setValueAtTime(0.18, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.25);
  osc.connect(gain).connect(c.destination);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + 0.25);
}

/** Low thud — can't move (hit wall) */
export function playBump() {
  const c = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(150, c.currentTime);
  osc.frequency.linearRampToValueAtTime(80, c.currentTime + 0.1);
  gain.gain.setValueAtTime(0.2, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15);
  osc.connect(gain).connect(c.destination);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + 0.15);
}

/** Bright chime — NFC card scanned */
export function playNfcScan() {
  const c = getCtx();
  // Two-tone chime: low → high
  const freqs = [600, 900];
  freqs.forEach((freq, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const t = c.currentTime + i * 0.1;
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.18);
  });
}

/** Sharp pop burst — ball explodes (failure) */
export function playBurst() {
  const c = getCtx();
  // Sharp attack pop
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(800, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(100, c.currentTime + 0.15);
  gain.gain.setValueAtTime(0.25, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.2);
  osc.connect(gain).connect(c.destination);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + 0.2);
  // Noise burst for crackle
  const bufferSize = Math.floor(c.sampleRate * 0.3);
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);
  const noise = c.createBufferSource();
  noise.buffer = buffer;
  const noiseGain = c.createGain();
  noiseGain.gain.setValueAtTime(0.18, c.currentTime);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.3);
  noise.connect(noiseGain).connect(c.destination);
  noise.start(c.currentTime);
  noise.stop(c.currentTime + 0.3);
}

/** Branch trigger — short up-down sweep */
export function playBranch() {
  const c = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(500, c.currentTime);
  osc.frequency.linearRampToValueAtTime(900, c.currentTime + 0.08);
  osc.frequency.linearRampToValueAtTime(600, c.currentTime + 0.16);
  gain.gain.setValueAtTime(0.2, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.2);
  osc.connect(gain).connect(c.destination);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + 0.2);
}

/** Success fanfare — program complete or goal reached */
export function playSuccess() {
  const c = getCtx();
  const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
  notes.forEach((freq, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const t = c.currentTime + i * 0.12;
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  });
}
