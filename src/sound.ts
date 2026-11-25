import { useEffect } from 'react';

// Sounds and background music, all synthesized with the Web Audio API (no audio files).
// Every kind of action has its own sound, and the same action always makes the same sound.
// There is no volume control: Web Audio plays at the iPad's media volume, and with the 'ambient'
// audio session the iPad's silent mode mutes it.

export type SoundName = 'click' | 'key' | 'pop' | 'popDown' | 'flip' | 'correct' | 'wrong' | 'hint' | 'done' | 'undo' | 'box' | 'chapter';

let ctx: AudioContext | null = null;
let fx: GainNode | null = null; // effect sounds
let music: GainNode | null = null; // background music (ducked under result sounds)
let musicOn = false;
let listening = false;
const MUSIC_LEVEL = 0.14; // the tracks are normalised to -20 LUFS: this keeps them well under the clicks and effects

// localhost only: a log of every sound, so browser tests can check which sound each action makes
const testLog = typeof location !== 'undefined' && location.hostname === 'localhost';
const muted = testLog && new URLSearchParams(location.search).has('mute');
declare global {
  interface Window {
    __sounds?: string[];
  }
}

function setup(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try {
    const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (session) session.type = 'ambient';
  } catch {
    /* older Safari: no audio session API */
  }
  ctx = new AC();
  const master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);
  fx = ctx.createGain();
  fx.gain.value = 0.75;
  fx.connect(master);
  music = ctx.createGain();
  music.gain.value = 0;
  music.connect(master);
  if (muted) master.gain.value = 0; // browser tests run silent (localhost ?mute)
  if (!listening) {
    listening = true;
    // Leaving the app (tab switch, home screen, lock): stop the music at once. iOS keeps a page that is
    // playing audio alive in the background, so a plain pause was not enough.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') stopAll(false);
      else if (ctx) void ctx.resume().then(() => ctx?.state === 'running' && startMusic()).catch(() => {}); // else: the next tap restarts it
    });
    // the tab is closing (or going into the back/forward cache): shut the audio engine down completely
    window.addEventListener('pagehide', () => stopAll(true));
  }
  return ctx;
}

/** Call from a user gesture: iPad Safari only allows audio after a tap. Starts the music the first time. */
export function unlockAudio() {
  const c = setup();
  if (!c) return;
  if (c.state !== 'running') void c.resume();
  // a silent blip completes the unlock on older iOS
  const b = c.createBuffer(1, 1, 22050);
  const s = c.createBufferSource();
  s.buffer = b;
  s.connect(c.destination);
  s.start(0);
  if (!musicOn) startMusic();
}

// ---------- tiny synth ----------
type ToneOpts = { type?: OscillatorType; gain?: number; attack?: number; glideTo?: number; dest?: AudioNode; bell?: boolean };
function tone(freq: number, at: number, dur: number, o: ToneOpts = {}) {
  const c = ctx!;
  const g = c.createGain();
  const peak = o.gain ?? 0.3;
  const a = o.attack ?? 0.005;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + a);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  g.connect(o.dest ?? fx!);
  const osc = c.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, at);
  if (o.glideTo) osc.frequency.exponentialRampToValueAtTime(o.glideTo, at + dur);
  osc.connect(g);
  osc.start(at);
  osc.stop(at + dur + 0.02);
  if (o.bell) {
    // a quiet overtone two octaves up gives a bell / music-box colour
    const g2 = c.createGain();
    g2.gain.setValueAtTime(0.0001, at);
    g2.gain.exponentialRampToValueAtTime(peak * 0.25, at + a);
    g2.gain.exponentialRampToValueAtTime(0.0001, at + dur * 0.5);
    g2.connect(o.dest ?? fx!);
    const o2 = c.createOscillator();
    o2.frequency.setValueAtTime(freq * 4, at);
    o2.connect(g2);
    o2.start(at);
    o2.stop(at + dur);
  }
}
function noise(at: number, dur: number, from: number, to: number, gain: number) {
  const c = ctx!;
  const len = Math.ceil(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 1.2;
  f.frequency.setValueAtTime(from, at);
  f.frequency.exponentialRampToValueAtTime(to, at + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f);
  f.connect(g);
  g.connect(fx!);
  src.start(at);
  src.stop(at + dur);
}
function duck(at: number, length: number) {
  if (!music || !musicOn) return;
  music.gain.cancelScheduledValues(at);
  music.gain.setTargetAtTime(MUSIC_LEVEL * 0.3, at, 0.05);
  music.gain.setTargetAtTime(MUSIC_LEVEL, at + length, 0.4);
}

const C5 = 523.25, E5 = 659.25, G5 = 783.99, A5 = 880, C6 = 1046.5, E6 = 1318.5, G6 = 1568;
const RECIPES: Record<SoundName, (t: number) => void> = {
  click: (t) => tone(520, t, 0.05, { type: 'triangle', gain: 0.2, glideTo: 380 }),
  key: (t) => {
    tone(190, t, 0.09, { gain: 0.5, glideTo: 120 }); // low thock
    tone(380, t, 0.03, { type: 'triangle', gain: 0.08 }); // a touch of attack so it is heard on small speakers
  },
  pop: (t) => tone(420, t, 0.09, { gain: 0.22, glideTo: 860 }),
  popDown: (t) => tone(760, t, 0.1, { gain: 0.16, glideTo: 360 }),
  flip: (t) => noise(t, 0.26, 900, 3800, 0.2),
  correct: (t) => {
    duck(t, 1.2);
    [C5, E5, G5].forEach((f, i) => tone(f, t + i * 0.09, 0.5, { type: 'triangle', gain: 0.3, bell: true }));
    tone(C6, t + 0.27, 0.8, { type: 'triangle', gain: 0.32, bell: true });
    tone(G6, t + 0.36, 0.35, { gain: 0.08 });
  },
  wrong: (t) => {
    duck(t, 0.8);
    tone(311, t, 0.2, { type: 'triangle', gain: 0.32, glideTo: 290 });
    tone(233, t + 0.17, 0.34, { type: 'triangle', gain: 0.32, glideTo: 220 });
  },
  hint: (t) => {
    duck(t, 0.9);
    [G6, E6, C6 * 2, E6].forEach((f, i) => tone(f, t + i * 0.07, 0.3, { gain: 0.09 }));
  },
  done: (t) => {
    duck(t, 0.9);
    tone(A5, t, 0.35, { type: 'triangle', gain: 0.28, bell: true });
    tone(E6, t + 0.11, 0.6, { type: 'triangle', gain: 0.28, bell: true });
  },
  undo: (t) => tone(660, t, 0.16, { type: 'triangle', gain: 0.18, glideTo: 420 }),
  box: (t) => {
    duck(t, 1.6);
    [G5 / 2, C5, E5, G5].forEach((f, i) => tone(f, t + i * 0.12, 0.35, { type: 'triangle', gain: 0.28, bell: true }));
    [C5, E5, G5, C6].forEach((f) => tone(f, t + 0.5, 1.0, { type: 'triangle', gain: 0.14, bell: true }));
  },
  chapter: (t) => {
    duck(t, 2.6);
    [C5, E5, G5, C6, G5, C6, E6].forEach((f, i) => tone(f, t + i * 0.13, 0.4, { type: 'triangle', gain: 0.27, bell: true }));
    [C5, E5, G5, C6, E6].forEach((f) => tone(f, t + 0.95, 1.6, { type: 'triangle', gain: 0.12, bell: true }));
    [G6, E6 * 2, G6 * 2].forEach((f, i) => tone(f, t + 1.0 + i * 0.09, 0.4, { gain: 0.05 }));
  },
};

export function play(name: SoundName) {
  if (testLog) (window.__sounds ??= []).push(name);
  const c = ctx;
  if (!c || c.state !== 'running') return;
  try {
    RECIPES[name](c.currentTime + 0.005);
  } catch {
    /* never let a sound break the app */
  }
}

// ---------- background music: a playlist of recorded calm tracks ----------
// CC0 music by Juhani Junkala (public/music/CREDITS.txt), loudness-matched. One <audio> element streams the
// tracks in turn (little memory) and is routed through the music gain, so ducking and pausing still apply.
const TRACKS = ['1-childhood-friends', '2-peaceful-days', '3-sand-castles', '4-summer-memories'].map((t) => `/music/${t}.m4a`);
let player: HTMLAudioElement | null = null;
let track = Math.floor(Math.random() * TRACKS.length);

function startMusic() {
  const c = ctx;
  if (!c || !music || musicOn) return;
  musicOn = true;
  if (!player) {
    const el = new Audio();
    el.preload = 'auto';
    el.muted = muted;
    el.addEventListener('ended', () => {
      track = (track + 1) % TRACKS.length;
      el.src = TRACKS[track];
      void el.play().catch(() => {});
    });
    c.createMediaElementSource(el).connect(music);
    el.src = TRACKS[track];
    player = el;
  }
  music.gain.cancelScheduledValues(c.currentTime);
  music.gain.setValueAtTime(0, c.currentTime);
  music.gain.linearRampToValueAtTime(MUSIC_LEVEL, c.currentTime + 3); // fade in
  void player.play().catch(() => {
    musicOn = false; // not allowed yet: the next tap tries again
  });
}

/** Silence everything now: pause the music and suspend (or, when the page is going away, close) the engine. */
function stopAll(close: boolean) {
  player?.pause();
  musicOn = false;
  const c = ctx;
  if (!c) return;
  try {
    music?.gain.cancelScheduledValues(c.currentTime);
    music?.gain.setValueAtTime(0, c.currentTime);
  } catch {
    /* closed already */
  }
  if (close) {
    player?.removeAttribute('src');
    player = null; // tied to the closed engine; a new one is made next time
    ctx = fx = music = null;
    void c.close().catch(() => {});
  } else void c.suspend().catch(() => {});
}

// development: when this file is hot-reloaded, the old copy must not keep playing its music
if (import.meta.hot) import.meta.hot.dispose(() => stopAll(true));

if (testLog) (window as unknown as { __audio: () => object }).__audio = () => ({ state: ctx?.state ?? 'none', musicOn, playing: !!player && !player.paused, track: player?.src.split('/').pop() ?? null });
if (testLog) (window as unknown as { __audioEnd: () => void }).__audioEnd = () => { if (player?.duration) player.currentTime = player.duration - 0.3; };

/** Which sound a tap on this element makes (null: none). Keys and board cells tap; other controls click. */
export function tapSound(el: Element | null): SoundName | null {
  const ctl = el?.closest('button, a[href], [role="button"], [role="checkbox"], [role="radio"], [role="tab"]');
  if (!ctl || (ctl as HTMLButtonElement).disabled || ctl.getAttribute('aria-disabled') === 'true') return null;
  return ctl.matches('.numkey, .pz-cell, .sv-cell, .choice') ? 'key' : 'click';
}


// ---------- window open / close ----------
// Deferred one tick: an open and a close in the same tick cancel out (React's StrictMode mounts, unmounts and
// remounts in development, which would otherwise sound like a window closing).
let pendingWin: { name: 'pop' | 'popDown'; id: number } | null = null;
function windowSound(name: 'pop' | 'popDown') {
  if (pendingWin && pendingWin.name !== name) {
    clearTimeout(pendingWin.id);
    pendingWin = null;
    return;
  }
  if (pendingWin) return;
  pendingWin = { name, id: window.setTimeout(() => { pendingWin = null; play(name); }, 0) };
}
/**
 * pop when a window opens (and when `key` changes, e.g. the next problem), pop-down when it closes.
 * `open: false` for windows that announce themselves with their own sound (the fanfares).
 */
export function useWindowSound(key?: unknown, { open = true }: { open?: boolean } = {}) {
  useEffect(() => {
    if (open) windowSound('pop');
    else if (pendingWin?.name === 'popDown') {
      // a window that opens with its own sound swallows a close in the same tick (StrictMode's re-mount,
      // or the passcode window closing as the fanfare opens)
      clearTimeout(pendingWin.id);
      pendingWin = null;
    }
  }, [key, open]);
  useEffect(() => () => windowSound('popDown'), []);
}
