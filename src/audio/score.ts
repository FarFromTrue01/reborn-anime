// Procedural soundtrack, rendered offline with Tone.js. Everything is
// scheduled at absolute film times taken from cues.ts, so the player and the
// MP4 export share exactly the same buffer.
//
// The score is split into sections. Each section is rendered in its own short
// OfflineContext (in parallel) and the results are mixed in JS: Tone nodes keep
// running for the whole length of a context, so one 60 s context holding every
// instrument renders far slower than a handful of short ones.
import * as Tone from 'tone';
import { DURATION } from '../config';
import { CUE } from '../cues';
import { rng } from '../lib/math';
export { encodeWav } from './wav';

const SR = 44100;

// ── Themes ───────────────────────────────────────────────────────────────────
/** Selene's lullaby — the film's main theme (D major, 3/4). [note, beats] */
export const LULLABY_A: [string, number][] = [
  ['F#4', 1], ['A4', 1], ['B4', 1], ['A4', 2], ['F#4', 1],
  ['E4', 1], ['F#4', 1], ['D4', 1], ['E4', 3],
];
export const LULLABY_B: [string, number][] = [
  ['F#4', 1], ['A4', 1], ['D5', 1], ['C#5', 2], ['B4', 1],
  ['A4', 1], ['B4', 1], ['F#4', 1], ['D4', 3],
];

const up = (n: string, oct: number) => Tone.Frequency(n).transpose(oct * 12).toNote();

/** Stereo noise burst with exponential decay and a darkening tail. */
function impulse(seconds: number, decay: number, seed: number) {
  const n = Math.floor(SR * seconds);
  const r = rng(seed);
  const ch = [new Float32Array(n), new Float32Array(n)];
  for (const c of ch) {
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const k = i / n;
      lp += (r() * 2 - 1 - lp) * (0.9 - k * 0.75);
      c[i] = lp * Math.pow(1 - k, decay) * (i < SR * 0.005 ? i / (SR * 0.005) : 1);
    }
  }
  return Tone.ToneAudioBuffer.fromArray(ch);
}

/** Things every section gets: time mapping, busses, reverb sends. */
interface Kit {
  /** absolute film time → section-local time */
  T: (t: number) => number;
  R: () => number;
  out: Tone.Gain;
  hall: Tone.Gain;
  room: Tone.Gain;
}

interface Section { name: string; start: number; end: number; build: (k: Kit) => void }

async function renderSection(s: Section, seed: number): Promise<{ start: number; data: Float32Array[] }> {
  const context = new Tone.OfflineContext(2, s.end - s.start, SR);
  const original = Tone.getContext();
  Tone.setContext(context);
  try {
    const out = new Tone.Gain(1).toDestination();
    const hall = new Tone.Gain(0.32).connect(new Tone.Convolver(impulse(3.0, 2.6, seed)).connect(out));
    const room = new Tone.Gain(0.2).connect(new Tone.Convolver(impulse(0.8, 4, seed + 1)).connect(out));
    s.build({ T: (t) => Math.max(0, t - s.start), R: rng(seed * 7 + 3), out, hall, room });
  } finally {
    Tone.setContext(original);
  }
  // render Tone's clock synchronously (Tone.Offline yields to setTimeout every
  // simulated second, which hidden/headless tabs throttle heavily)
  const buf = (await context.render(false)).get() as AudioBuffer;
  return { start: s.start, data: [buf.getChannelData(0), buf.getChannelData(1)] };
}

export async function renderScore(): Promise<AudioBuffer> {
  const parts = await Promise.all(SECTIONS.map((s, i) => renderSection(s, 11 + i * 17)));
  const n = Math.round(SR * DURATION);
  const L = new Float32Array(n), Rr = new Float32Array(n);
  for (const p of parts) {
    const off = Math.round(p.start * SR);
    for (let i = 0; i < p.data[0].length && off + i < n; i++) {
      L[off + i] += p.data[0][i];
      Rr[off + i] += p.data[1][i];
    }
  }
  // global envelope: the sudden silence before the impact + the final fade
  const env = (t: number) => {
    if (t >= CUE.silence && t < CUE.white) return 0;
    if (t > CUE.end - 1.4) return Math.max(0, (CUE.end - 0.05 - t) / 1.35);
    return 1;
  };
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const g = env(i / SR);
    L[i] *= g;
    Rr[i] *= g;
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(Rr[i]));
  }
  // normalise toward -1 dBFS with a gentle soft-knee limiter
  const ceil = 0.89, knee = 0.7;
  const pre = peak > 0 ? Math.min(4, (ceil * 1.15) / peak) : 1;
  const soft = (x: number) => {
    const y = x * pre;
    const a = Math.abs(y);
    return a < knee ? y : Math.sign(y) * (knee + (ceil - knee) * Math.tanh((a - knee) / (ceil - knee)));
  };
  for (let i = 0; i < n; i++) {
    L[i] = soft(L[i]);
    Rr[i] = soft(Rr[i]);
  }
  const out = new AudioBuffer({ length: n, numberOfChannels: 2, sampleRate: SR });
  out.copyToChannel(L, 0);
  out.copyToChannel(Rr, 1);
  return out;
}

// ── Shared instruments ───────────────────────────────────────────────────────
function strings(k: Kit, cutoff = 1500, volume = -25) {
  const s = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'fatsawtooth', count: 2, spread: 24 } as any,
    envelope: { attack: 1.3, decay: 0.5, sustain: 0.8, release: 2.0 },
    volume,
  });
  const lp = new Tone.Filter({ type: 'lowpass', frequency: cutoff, rolloff: -24 });
  s.chain(lp, k.out);
  s.connect(k.hall);
  return { s, lp, pad: (notes: string[], t: number, d: number, v = 0.6) => notes.forEach((n) => s.triggerAttackRelease(n, d, k.T(t), v)) };
}
function piano(k: Kit) {
  const p = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'fmtriangle', harmonicity: 2, modulationIndex: 0.6 } as any,
    envelope: { attack: 0.004, decay: 1.6, sustain: 0.08, release: 1.6 },
    volume: -15,
  });
  p.connect(k.out);
  p.connect(k.hall);
  const arp = (notes: string[], t: number, step: number, n: number, v = 0.5) => {
    for (let i = 0; i < n; i++) p.triggerAttackRelease(notes[i % notes.length], step * 2, k.T(t + i * step), v * (0.85 + k.R() * 0.3));
  };
  return { p, arp };
}

// ── Sections ────────────────────────────────────────────────────────────────
const SECTIONS: Section[] = [
  {
    // rain, heartbeat, keyboard, level-up, street, crash, ringing
    name: 'night', start: 0, end: CUE.rebirth + 1,
    build(k) {
      const { T, R } = k;
      const slowLP = new Tone.Filter({ type: 'lowpass', frequency: 18000, rolloff: -24 }).connect(k.out);
      slowLP.connect(k.room);
      slowLP.frequency.setValueAtTime(18000, T(CUE.slowmo - 0.05));
      slowLP.frequency.exponentialRampToValueAtTime(260, T(CUE.slowmo + 0.5));

      // rain bed
      const rainLP = new Tone.Filter({ type: 'lowpass', frequency: 700 }).connect(slowLP);
      const rainG = new Tone.Gain(0).connect(rainLP);
      new Tone.Noise('pink').connect(rainG).start(0).stop(T(CUE.silence));
      const hiss = new Tone.Filter({ type: 'highpass', frequency: 3500 }).connect(slowLP);
      const hissG = new Tone.Gain(0).connect(hiss);
      new Tone.Noise('white').connect(hissG).start(0).stop(T(CUE.silence));
      const g = rainG.gain, f = rainLP.frequency, h = hissG.gain;
      g.setValueAtTime(0, 0); g.linearRampToValueAtTime(0.35, 1.5);
      f.setValueAtTime(700, T(CUE.apartment)); f.linearRampToValueAtTime(1100, T(CUE.apartment + 0.5));
      g.setValueAtTime(0.35, T(CUE.street - 0.1)); g.linearRampToValueAtTime(0.42, T(CUE.street + 0.2));
      f.setValueAtTime(1100, T(CUE.street - 0.1)); f.linearRampToValueAtTime(4200, T(CUE.street + 0.2));
      h.setValueAtTime(0, T(CUE.street - 0.1)); h.linearRampToValueAtTime(0.018, T(CUE.street + 0.2));
      g.setValueAtTime(0.42, T(CUE.slowmo)); g.linearRampToValueAtTime(0.4, T(CUE.silence - 0.05)); g.linearRampToValueAtTime(0, T(CUE.silence));
      h.setValueAtTime(0.018, T(CUE.slowmo)); h.linearRampToValueAtTime(0, T(CUE.slowmo + 0.4));
      // indoors: rain tapping on the window
      const tap = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.02, sustain: 0 }, volume: -30 });
      tap.chain(new Tone.Filter({ type: 'bandpass', frequency: 2500, Q: 2 }), slowLP);
      for (let t = CUE.apartment; t < CUE.street; t += 0.05 + R() * 0.18) tap.triggerAttackRelease(0.02, T(t), 0.2 + R() * 0.5);

      // heartbeat
      const heart = new Tone.MembraneSynth({ pitchDecay: 0.04, octaves: 3, envelope: { attack: 0.002, decay: 0.35, sustain: 0, release: 0.1 }, volume: -2 });
      heart.chain(new Tone.Filter({ type: 'lowpass', frequency: 180 }), slowLP);
      for (const b of CUE.heartbeats) {
        heart.triggerAttackRelease('A0', 0.15, T(b), 0.9);
        heart.triggerAttackRelease('A0', 0.15, T(b + 0.24), 0.6);
      }
      for (const b of [CUE.slowmo + 0.25, CUE.slowmo + 1.15, CUE.slowmo + 1.85]) {
        heart.triggerAttackRelease('F#0', 0.3, T(b), 1);
        heart.triggerAttackRelease('F#0', 0.3, T(b + 0.3), 0.7);
      }

      // keyboard clicks while he plays + the finishing blow
      const key = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.025, sustain: 0 }, volume: -22 });
      key.chain(new Tone.Filter({ type: 'bandpass', frequency: 3200, Q: 1.2 }), slowLP);
      for (const [a, b] of [[CUE.apartment + 0.6, CUE.shotFace1 + 1.4], [CUE.shotMonitor, CUE.levelUp - 0.1]] as const)
        for (let t = a; t < b; t += 0.07 + R() * 0.2) key.triggerAttackRelease(0.02, T(t), 0.4 + R() * 0.6);
      const hit = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.001, decay: 0.12, sustain: 0 }, volume: -16 }).connect(slowLP);
      hit.triggerAttackRelease(0.1, T(CUE.levelUp - 0.5));

      // LEVEL UP fanfare (chiptune square wave + bells)
      const chip = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.002, decay: 0.12, sustain: 0.3, release: 0.15 }, volume: -18 });
      chip.connect(k.out);
      chip.connect(k.hall);
      const notes = ['C5', 'E5', 'G5', 'C6', 'E6', 'G6'];
      notes.forEach((n, i) => chip.triggerAttackRelease(n, i === notes.length - 1 ? 0.45 : 0.06, T(CUE.levelUp + i * 0.065)));
      const bell = new Tone.PolySynth(Tone.FMSynth, { harmonicity: 5.1, modulationIndex: 9, envelope: { attack: 0.001, decay: 0.9, sustain: 0, release: 0.8 }, volume: -22 });
      bell.connect(k.hall);
      bell.connect(k.out);
      ['C7', 'G6', 'E7'].forEach((n, i) => bell.triggerAttackRelease(n, 0.6, T(CUE.levelUp + 0.4 + i * 0.09)));

      // street: footsteps in puddles, city hum, tyres
      const step = new Tone.NoiseSynth({ noise: { type: 'brown' }, envelope: { attack: 0.002, decay: 0.09, sustain: 0 }, volume: -16 });
      step.chain(new Tone.Filter({ type: 'lowpass', frequency: 900 }), slowLP);
      for (let t = CUE.street + 0.3; t < CUE.turn; t += 0.52) step.triggerAttackRelease(0.08, T(t), 0.6 + R() * 0.3);
      const hum = new Tone.Gain(0).connect(slowLP);
      new Tone.Noise('brown').chain(new Tone.Filter({ type: 'lowpass', frequency: 160 }), hum).start(T(CUE.street)).stop(T(CUE.silence));
      hum.gain.setValueAtTime(0, T(CUE.street));
      hum.gain.linearRampToValueAtTime(0.5, T(CUE.street + 1));
      const tyre = new Tone.Gain(0).connect(slowLP);
      const tyreF = new Tone.Filter({ type: 'bandpass', frequency: 600, Q: 0.7 }).connect(tyre);
      new Tone.Noise('pink').connect(tyreF).start(T(CUE.crash + 0.6)).stop(T(CUE.silence));
      tyre.gain.setValueAtTime(0.0001, T(CUE.crash + 0.6));
      tyre.gain.exponentialRampToValueAtTime(0.7, T(CUE.turn));
      tyreF.frequency.setValueAtTime(500, T(CUE.crash + 0.6));
      tyreF.frequency.exponentialRampToValueAtTime(2200, T(CUE.turn));

      // brake screech: squealing FM tone with wobble
      const squeal = new Tone.FMSynth({ harmonicity: 1.5, modulationIndex: 3, envelope: { attack: 0.05, decay: 0.1, sustain: 0.8, release: 0.4 }, volume: -17 });
      squeal.chain(new Tone.Vibrato(14, 0.3), slowLP);
      squeal.triggerAttack(2700, T(CUE.headlights + 0.1));
      squeal.frequency.setValueAtTime(2700, T(CUE.headlights + 0.1));
      squeal.frequency.linearRampToValueAtTime(3300, T(CUE.turn + 0.4));
      squeal.triggerRelease(T(CUE.slowmo + 0.2));
      // horn: two sawtooth tones a major third apart
      const horn = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sawtooth' }, envelope: { attack: 0.02, decay: 0.05, sustain: 1, release: 0.15 }, volume: -20 });
      horn.chain(new Tone.Filter({ type: 'lowpass', frequency: 2400 }), slowLP);
      horn.triggerAttackRelease(['G#4', 'C5'], 0.55, T(CUE.horn));
      horn.triggerAttackRelease(['G#4', 'C5'], 0.9, T(CUE.horn + 0.7));

      // slow motion: deep swell + whoosh rising into the silence
      const subG = new Tone.Gain(0).connect(k.out);
      new Tone.Oscillator(38, 'sine').connect(subG).start(T(CUE.slowmo)).stop(T(CUE.silence));
      subG.gain.setValueAtTime(0, T(CUE.slowmo));
      subG.gain.linearRampToValueAtTime(0.5, T(CUE.silence - 0.1));
      subG.gain.linearRampToValueAtTime(0, T(CUE.silence));
      const whoosh = new Tone.Gain(0).connect(k.out);
      const wf = new Tone.Filter({ type: 'bandpass', frequency: 200, Q: 1.5 }).connect(whoosh);
      new Tone.Noise('pink').connect(wf).start(T(CUE.slowmo)).stop(T(CUE.silence));
      whoosh.gain.setValueAtTime(0.0001, T(CUE.slowmo));
      whoosh.gain.exponentialRampToValueAtTime(0.6, T(CUE.silence - 0.02));
      whoosh.gain.linearRampToValueAtTime(0, T(CUE.silence));
      wf.frequency.setValueAtTime(200, T(CUE.slowmo));
      wf.frequency.exponentialRampToValueAtTime(1600, T(CUE.silence));

      // after the silence: no impact — only a high ringing in the ears
      const ring = new Tone.Gain(0).connect(k.out);
      new Tone.Oscillator(4186, 'sine').connect(ring).start(T(CUE.white)).stop(T(CUE.rebirth + 0.95));
      const ring2 = new Tone.Gain(0).connect(k.out);
      new Tone.Oscillator(6272, 'sine').connect(ring2).start(T(CUE.white)).stop(T(CUE.rebirth));
      ring.gain.setValueAtTime(0, T(CUE.white));
      ring.gain.linearRampToValueAtTime(0.07, T(CUE.white + 0.05));
      ring.gain.exponentialRampToValueAtTime(0.02, T(CUE.rebirth));
      ring.gain.linearRampToValueAtTime(0, T(CUE.rebirth + 0.9));
      ring2.gain.setValueAtTime(0, T(CUE.white));
      ring2.gain.linearRampToValueAtTime(0.02, T(CUE.white + 0.05));
      ring2.gain.linearRampToValueAtTime(0, T(CUE.rebirth - 0.3));
    },
  },
  {
    // Nolan's world: calm, melancholic lo-fi in A minor — cut dead by the horn
    name: 'lofi', start: CUE.apartment - 0.1, end: CUE.horn + 0.05,
    build(k) {
      const { T, R } = k;
      const beat = 60 / 72;
      const lp = new Tone.Filter({ type: 'lowpass', frequency: 2600, rolloff: -24 }).connect(k.out);
      lp.connect(k.hall);
      lp.frequency.setValueAtTime(2600, T(CUE.street));
      lp.frequency.linearRampToValueAtTime(1100, T(CUE.street + 0.6)); // now heard from outside
      const bus = new Tone.Gain(1).connect(lp);
      bus.gain.setValueAtTime(1, T(CUE.horn - 0.012));
      bus.gain.linearRampToValueAtTime(0, T(CUE.horn)); // abrupt cut
      const ep = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3, modulationIndex: 1.6,
        envelope: { attack: 0.01, decay: 1.4, sustain: 0.25, release: 1.4 },
        modulationEnvelope: { attack: 0.01, decay: 0.5, sustain: 0.1, release: 0.5 },
        volume: -13,
      });
      ep.chain(new Tone.Chorus(1.5, 3, 0.4).start(), new Tone.FeedbackDelay({ delayTime: beat * 0.75, feedback: 0.25, wet: 0.2 }), bus);
      const chords = [
        ['A2', 'E3', 'G3', 'B3', 'C4'], ['F2', 'C3', 'E3', 'A3'], ['C3', 'G3', 'B3', 'E4'], ['G2', 'D3', 'F#3', 'B3'],
        ['A2', 'E3', 'G3', 'C4'], ['F2', 'A3', 'C4', 'E4'], ['D3', 'F3', 'A3', 'C4'], ['E2', 'G#3', 'B3', 'D4'],
      ];
      for (let t = CUE.apartment + 0.2, i = 0; t < CUE.horn - 0.2; t += beat * 2, i++)
        chords[i % chords.length].forEach((n, j) => ep.triggerAttackRelease(n, beat * 1.9, T(t + j * 0.03), 0.55));
      // sparse, sad lead
      const lead = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.03, decay: 0.4, sustain: 0.4, release: 1.2 }, volume: -21 });
      lead.chain(new Tone.Vibrato(4.5, 0.08), bus);
      lead.volume.value = -17;
      const mel: [string, number, number][] = [
        ['E5', 0, 1.5], ['D5', 1.5, 0.5], ['C5', 2, 2], ['B4', 4, 1], ['C5', 5, 0.5], ['A4', 5.5, 2.5],
        ['G4', 8, 1], ['A4', 9, 1], ['C5', 10, 1.5], ['B4', 11.5, 0.5], ['A4', 12, 3],
      ];
      const t0 = CUE.apartment + beat * 2;
      for (const [n, b, d] of mel) if (t0 + b * beat < CUE.horn - 0.3) lead.triggerAttackRelease(n, d * beat, T(t0 + b * beat), 0.6);
      // lo-fi drums
      const kick = new Tone.MembraneSynth({ pitchDecay: 0.03, octaves: 5, envelope: { attack: 0.001, decay: 0.3, sustain: 0 }, volume: -14 }).connect(bus);
      const snare = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.001, decay: 0.16, sustain: 0 }, volume: -24 });
      snare.chain(new Tone.Filter({ type: 'bandpass', frequency: 1800, Q: 0.8 }), bus);
      const hat = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.04, sustain: 0 }, volume: -34 });
      hat.chain(new Tone.Filter({ type: 'highpass', frequency: 7000 }), bus);
      for (let bt = CUE.apartment + beat * 2; bt < CUE.horn - 0.1; bt += beat * 4) {
        kick.triggerAttackRelease('C1', 0.2, T(bt), 0.9);
        if (bt + beat * 2.5 < CUE.horn) kick.triggerAttackRelease('C1', 0.2, T(bt + beat * 2.5), 0.6);
        if (bt + beat < CUE.horn) snare.triggerAttackRelease(0.1, T(bt + beat + 0.02), 0.7);
        if (bt + beat * 3 < CUE.horn) snare.triggerAttackRelease(0.1, T(bt + beat * 3 + 0.02), 0.7);
        for (let j = 0; j < 8; j++) if (bt + j * beat * 0.5 < CUE.horn - 0.05) hat.triggerAttackRelease(0.03, T(bt + j * beat * 0.5 + (j % 2 ? 0.04 : 0)), j % 2 ? 0.4 : 0.7);
      }
      const crackle = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.006, sustain: 0 }, volume: -36 }).connect(bus);
      for (let c = CUE.apartment; c < CUE.horn; c += 0.04 + R() * 0.3) crackle.triggerAttackRelease(0.005, T(c), R());
    },
  },
  {
    // rebirth: warm strings, soft piano, Selene humming the lullaby
    name: 'rebirth', start: CUE.rebirth - 0.1, end: CUE.montage + 2.5,
    build(k) {
      const { T } = k;
      const st = strings(k);
      const { arp } = piano(k);
      st.pad(['D3', 'A3', 'E4', 'F#4'], CUE.rebirth + 0.3, 2.6, 0.5);
      st.pad(['G2', 'D3', 'B3', 'D4'], CUE.seleneFocus, 2.4);
      st.pad(['B2', 'F#3', 'B3', 'D4'], CUE.seleneFocus + 2.4, 2.4);
      st.pad(['A2', 'E3', 'C#4', 'E4'], CUE.aldric, 1.8);
      st.pad(['D3', 'A3', 'D4', 'F#4'], CUE.aldric + 1.8, 1.6);
      arp(['D4', 'A4', 'E5', 'F#5'], CUE.rebirth + 1.0, 0.42, 6, 0.35);
      arp(['G3', 'D4', 'B4', 'D5'], CUE.seleneFocus, 0.4, 6, 0.4);
      arp(['B3', 'F#4', 'B4', 'D5'], CUE.seleneFocus + 2.4, 0.4, 6, 0.4);
      arp(['A3', 'E4', 'C#5', 'E5'], CUE.aldric, 0.45, 4, 0.4);
      arp(['D4', 'A4', 'D5', 'F#5'], CUE.aldric + 1.8, 0.45, 4, 0.4);
      // humming: a soft, vowel-less "mm" voice with vibrato
      const voice = new Tone.Synth({ oscillator: { type: 'custom', partials: [1, 0.35, 0.12, 0.05] } as any, envelope: { attack: 0.08, decay: 0.2, sustain: 0.85, release: 0.35 }, volume: -12 });
      voice.chain(new Tone.Vibrato(5.2, 0.12), new Tone.Filter({ type: 'lowpass', frequency: 1200, Q: 1 }), k.out);
      voice.connect(k.hall);
      const beat = 0.56;
      let t = CUE.seleneFocus + 0.3;
      for (const [n, b] of [...LULLABY_A, ...LULLABY_B.slice(0, 3)]) {
        if (t + b * beat > CUE.montage - 0.2) break;
        voice.triggerAttackRelease(n, b * beat * 0.92, T(t), 0.8);
        t += b * beat;
      }
    },
  },
  {
    // montage: music-box lullaby, seasons, the parents' conversation
    name: 'montage', start: CUE.montage - 0.1, end: CUE.magic + 2,
    build(k) {
      const { T, R } = k;
      const st = strings(k);
      const { arp } = piano(k);
      st.s.volume.value = -21;
      const box = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 5.07, modulationIndex: 7,
        envelope: { attack: 0.001, decay: 1.1, sustain: 0, release: 1 },
        modulationEnvelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.2 },
        volume: -4,
      });
      box.connect(k.out);
      box.connect(k.hall);
      const beat = 0.33;
      let t = CUE.montage + 0.05;
      for (const [n, b] of [...LULLABY_A, ...LULLABY_B]) {
        if (t > CUE.crib) break;
        box.triggerAttackRelease(up(n, 1), 0.5, T(t), 0.8);
        t += b * beat;
      }
      ['D4', 'A3', 'B3', 'A3', 'D4', 'F#3', 'G3', 'D4'].forEach((n, i) => box.triggerAttackRelease(n, 0.8, T(CUE.montage + 0.05 + i * 3 * beat), 0.5));
      st.pad(['D3', 'A3', 'F#4'], CUE.montage, 4, 0.35);
      // time-lapse swishes between seasons
      const swish = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.12, decay: 0.3, sustain: 0, release: 0.1 }, volume: -22 });
      swish.chain(new Tone.Filter({ type: 'bandpass', frequency: 1200, Q: 0.8 }), k.out);
      swish.triggerAttackRelease(0.3, T(CUE.spring - 0.15));
      swish.triggerAttackRelease(0.3, T(CUE.summer - 0.15));
      // winter wind, spring birds
      const wind = new Tone.Gain(0).connect(k.out);
      new Tone.Noise('pink').chain(new Tone.Filter({ type: 'bandpass', frequency: 500, Q: 2 }), wind).start(T(CUE.montage)).stop(T(CUE.spring + 0.2));
      wind.gain.setValueAtTime(0, T(CUE.montage));
      wind.gain.linearRampToValueAtTime(0.25, T(CUE.montage + 0.4));
      wind.gain.linearRampToValueAtTime(0, T(CUE.spring + 0.1));
      const bird = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.005, decay: 0.05, sustain: 0.5, release: 0.05 }, volume: -26 }).connect(k.out);
      for (let t2 = CUE.spring + 0.1; t2 < CUE.summer - 0.2; t2 += 0.25 + R() * 0.2) {
        const f0 = 3000 + R() * 1500;
        bird.triggerAttackRelease(f0, 0.07, T(t2));
        bird.frequency.setValueAtTime(f0, T(t2));
        bird.frequency.exponentialRampToValueAtTime(f0 * 1.35, T(t2 + 0.06));
      }
      // the parents talking: soft chords underneath
      st.pad(['G2', 'D3', 'B3', 'D4'], CUE.crib, 2, 0.7);
      st.pad(['A2', 'E3', 'C#4', 'E4'], CUE.parents + 0.4, 2, 0.7);
      arp(['D4', 'F#4', 'A4', 'D5'], CUE.parents + 1.0, 0.5, 6, 0.5);
    },
  },
  {
    // magic: shimmer, a mysterious chord, the status window's UI blip
    name: 'magic', start: CUE.magic - 0.1, end: CUE.mira + 2,
    build(k) {
      const { T, R } = k;
      const st = strings(k);
      const myst = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sine' }, envelope: { attack: 1.2, decay: 0.5, sustain: 0.9, release: 2 }, volume: -23 });
      myst.chain(new Tone.Chorus(0.8, 4, 0.6).start(), k.out);
      myst.connect(k.hall);
      myst.triggerAttackRelease(['D3', 'A3', 'C#4', 'E4', 'F4'], 3.6, T(CUE.magic));
      st.pad(['D3', 'F3', 'A3', 'C#4'], CUE.magic, 3.4, 0.45);
      myst.triggerAttackRelease(['G3', 'B3', 'D4', 'F#4', 'A4'], 2.6, T(CUE.josephEyes));
      st.pad(['G2', 'D3', 'B3', 'F#4'], CUE.status, 3.4, 0.5);
      myst.triggerAttackRelease(['D4', 'F#4', 'A4', 'E5'], 2.8, T(CUE.status + 0.4));
      const sparkle = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sine' }, envelope: { attack: 0.002, decay: 0.5, sustain: 0, release: 0.5 }, volume: -24 });
      sparkle.connect(k.hall);
      sparkle.connect(k.out);
      const scale = ['D6', 'E6', 'F#6', 'G#6', 'A6', 'C#7', 'D7', 'E7'];
      for (let t = CUE.magic + 0.2; t < CUE.josephEyes + 1.5; t += 0.06 + R() * 0.12) sparkle.triggerAttackRelease(scale[Math.floor(R() * scale.length)], 0.3, T(t), 0.3 + R() * 0.5);
      const rise = new Tone.Gain(0).connect(k.out);
      const rf = new Tone.Filter({ type: 'bandpass', frequency: 400, Q: 3 }).connect(rise);
      new Tone.Noise('white').connect(rf).start(T(CUE.magic)).stop(T(CUE.magic + 1.6));
      rise.gain.setValueAtTime(0, T(CUE.magic));
      rise.gain.linearRampToValueAtTime(0.18, T(CUE.magic + 0.8));
      rise.gain.linearRampToValueAtTime(0, T(CUE.magic + 1.6));
      rf.frequency.setValueAtTime(400, T(CUE.magic));
      rf.frequency.exponentialRampToValueAtTime(5000, T(CUE.magic + 1.6));
      // the status window: a glassy echo of the game's level-up sound
      const ui = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.002, decay: 0.15, sustain: 0.2, release: 0.3 }, volume: -16 });
      ui.chain(new Tone.FeedbackDelay({ delayTime: 0.12, feedback: 0.35, wet: 0.4 }), k.out);
      ['D6', 'F#6', 'A6', 'D7'].forEach((n, i) => ui.triggerAttackRelease(n, 0.08, T(CUE.panelOn + i * 0.06)));
      ['A6', 'F#6', 'D6'].forEach((n, i) => ui.triggerAttackRelease(n, 0.05, T(CUE.panelOff - 0.2 + i * 0.05), 0.6));
      const glitch = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.05, sustain: 0 }, volume: -26 }).connect(k.out);
      for (let j = 0; j < 4; j++) glitch.triggerAttackRelease(0.03, T(CUE.panelOff - 0.25 + j * 0.07));
    },
  },
  {
    // Mira: an emotional rise (instead of a synthetic baby cry) + candles
    name: 'mira', start: CUE.mira - 0.1, end: CUE.title + 1,
    build(k) {
      const { T, R } = k;
      const st = strings(k, 1500, -16);
      const { p, arp } = piano(k);
      st.pad(['B2', 'F#3', 'B3', 'D4'], CUE.mira, 2.2, 0.55);
      st.pad(['G2', 'D3', 'B3', 'G4'], CUE.mira + 2.2, 2.2, 0.62);
      st.pad(['D3', 'A3', 'F#4', 'A4'], CUE.miraClose + 0.2, 1.4, 0.7);
      st.pad(['A2', 'E3', 'C#4', 'E4', 'A4'], CUE.miraClose + 1.6, 1.3, 0.8);
      st.pad(['D3', 'A3', 'D4', 'F#4', 'A4'], CUE.josephSmile, 2.6, 0.75);
      st.lp.frequency.setValueAtTime(1500, T(CUE.mira));
      st.lp.frequency.linearRampToValueAtTime(3200, T(CUE.josephSmile));
      arp(['B3', 'D4', 'F#4', 'B4'], CUE.mira, 0.36, 6, 0.4);
      arp(['G3', 'B3', 'D4', 'G4'], CUE.mira + 2.2, 0.36, 6, 0.45);
      arp(['A3', 'C#4', 'E4', 'A4'], CUE.miraClose + 1.6, 0.32, 4, 0.5);
      // the theme on piano when Joseph smiles
      let t = CUE.josephSmile + 0.4;
      for (const [n, b] of LULLABY_A.slice(0, 5)) {
        p.triggerAttackRelease(up(n, 1), b * 0.5, T(t), 0.6);
        t += b * 0.5;
      }
      const pop = new Tone.NoiseSynth({ noise: { type: 'brown' }, envelope: { attack: 0.001, decay: 0.02, sustain: 0 }, volume: -30 }).connect(k.out);
      for (let c = CUE.mira; c < CUE.title; c += 0.15 + R() * 0.6) pop.triggerAttackRelease(0.01, T(c), R());
    },
  },
  {
    // title: a short, strong restatement of the main theme
    name: 'title', start: CUE.title - 0.1, end: CUE.end,
    build(k) {
      const { T } = k;
      const st = strings(k, 2600, -21);
      const { p } = piano(k);
      const timp = new Tone.MembraneSynth({ pitchDecay: 0.08, octaves: 2, envelope: { attack: 0.002, decay: 1.6, sustain: 0, release: 1 }, volume: -6 }).connect(k.out);
      timp.triggerAttackRelease('D1', 1.5, T(CUE.title));
      st.pad(['D2', 'A2', 'D3', 'F#3', 'A3', 'D4'], CUE.title, 2.4, 0.95);
      const brass = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sawtooth' }, envelope: { attack: 0.08, decay: 0.3, sustain: 0.7, release: 1.2 }, volume: -22 });
      brass.chain(new Tone.Filter({ type: 'lowpass', frequency: 1800 }), k.out);
      brass.connect(k.hall);
      let t = CUE.title + 0.05;
      for (const [n, d] of [['F#4', 0.35], ['A4', 0.35], ['B4', 0.35], ['A4', 0.7], ['D5', 1.4]] as [string, number][]) {
        brass.triggerAttackRelease(n, d * 0.95, T(t), 0.8);
        p.triggerAttackRelease(up(n, 1), d * 1.5, T(t), 0.7);
        t += d;
      }
      const tail = new Tone.FMSynth({ harmonicity: 5.07, modulationIndex: 6, envelope: { attack: 0.001, decay: 2, sustain: 0, release: 1 }, volume: -18 }).connect(k.hall);
      tail.triggerAttackRelease('D6', 1.5, T(CUE.title + 1.95));
    },
  },
];
