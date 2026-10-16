import '@fontsource/noto-sans/400.css';
import '@fontsource/noto-sans/400-italic.css';
import '@fontsource/noto-sans/700.css';
import '@fontsource/cinzel/600.css';
import './style.css';
import { W, H, DURATION, FPS } from './config';
import { renderFrame } from './film';
import { setRenderScale } from './lib/fx';
import { renderScore, encodeWav } from './audio/score';

const params = new URLSearchParams(location.search);
const EXPORT = params.has('export');

const canvas = document.getElementById('screen') as HTMLCanvasElement;
const ctx = canvas.getContext('2d', { alpha: false })!;

async function loadFonts() {
  await Promise.all([
    document.fonts.load('400 38px "Noto Sans"', 'ğüşıöçİ'),
    document.fonts.load('italic 400 38px "Noto Sans"', 'ğüşıöçİ'),
    document.fonts.load('700 38px "Noto Sans"', 'ğüşıöçİ'),
    document.fonts.load('600 80px "Cinzel"', 'REBORN'),
  ]).catch(() => undefined);
}

// ── Export / QA mode: a bare 1920x1080 canvas driven by Playwright ──────────
if (EXPORT) {
  document.getElementById('tap')!.remove();
  document.getElementById('controls')!.remove();
  document.body.style.overflow = 'hidden';
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  canvas.width = W;
  canvas.height = H;
  setRenderScale(1);
  const subs = params.get('subs') !== '0';
  loadFonts().then(() => {
    const t0 = Number(params.get('t') ?? 0);
    renderFrame(ctx, t0, { subtitles: subs, scale: 1 });
    (window as any).__film = {
      W, H, FPS, DURATION,
      render: (t: number) => renderFrame(ctx, t, { subtitles: subs, scale: 1 }),
      /** renders the soundtrack offline and returns a WAV as base64 */
      audio: async () => {
        const buf = await renderScore();
        const wav = encodeWav(buf);
        let bin = '';
        const bytes = new Uint8Array(wav);
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return btoa(bin);
      },
    };
    document.title = 'ready';
  });
} else {
  startPlayer();
}

// ── Player ───────────────────────────────────────────────────────────────────
function startPlayer() {
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const stage = $('stage');
  const tap = $('tap');
  const tapStatus = $('tapStatus');
  const controls = $('controls');
  const btnPlay = $<HTMLButtonElement>('btnPlay');
  const btnMute = $<HTMLButtonElement>('btnMute');
  const btnCC = $<HTMLButtonElement>('btnCC');
  const btnFS = $<HTMLButtonElement>('btnFS');
  const seekBar = $<HTMLInputElement>('seek');
  const timeEl = $('time');

  const icons = {
    play: '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>',
    replay: '<svg viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z"/></svg>',
    vol: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>',
    mute: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9zm18.6 3-3.1-3.1-1.4 1.4 3.1 3.1-3.1 3.1 1.4 1.4 3.1-3.1 3.1 3.1 1.4-1.4-3.1-3.1 3.1-3.1-1.4-1.4z"/></svg>',
    fs: '<svg viewBox="0 0 24 24"><path d="M4 4h6v2H6v4H4zm10 0h6v6h-2V6h-4zM4 14h2v4h4v2H4zm14 0h2v6h-6v-2h4z"/></svg>',
  };
  btnMute.innerHTML = icons.vol;
  btnFS.innerHTML = icons.fs;

  let subtitles = true;
  let muted = false;
  let playing = false;
  let offset = 0;
  let startedAt = 0;
  let scrubbing = false;
  let ac: AudioContext | null = null;
  let gain: GainNode | null = null;
  let source: AudioBufferSourceNode | null = null;
  let buffer: AudioBuffer | null = null;
  let wantPlay = false;
  let dirty = true;

  // render resolution follows the on-screen size (cheaper on phones)
  let scale = 1;
  function resize() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const want = Math.min(1, Math.max(0.4, (r.width * dpr) / W));
    scale = Math.round(want * 20) / 20;
    const cw = Math.round(W * scale), ch = Math.round(H * scale);
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }
    setRenderScale(scale);
    dirty = true;
  }
  window.addEventListener('resize', resize);
  resize();

  const clock = () => (ac ? ac.currentTime : performance.now() / 1000);
  const now = () => (playing ? Math.min(DURATION, offset + (clock() - startedAt)) : offset);

  // pre-render the soundtrack (Tone.Offline) as soon as the page loads
  const audioReady = renderScore()
    .then((b) => {
      buffer = b;
      tapStatus.textContent = '';
    })
    .catch((e) => {
      console.error(e);
      tapStatus.textContent = 'Ses üretilemedi — film sessiz oynayacak.';
    });

  function startSource() {
    if (!ac || !buffer || !gain) return;
    source?.stop();
    source = ac.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);
    source.start(0, Math.min(offset, buffer.duration - 0.01));
  }
  function stopSource() {
    try { source?.stop(); } catch { /* already stopped */ }
    source = null;
  }
  function play() {
    if (offset >= DURATION - 0.05) offset = 0;
    playing = true;
    startedAt = clock();
    startSource();
    updateButtons();
    pokeControls();
  }
  function pause() {
    offset = now();
    playing = false;
    stopSource();
    updateButtons();
    showControls(true);
  }
  function seekTo(t: number) {
    offset = Math.max(0, Math.min(DURATION, t));
    if (playing) {
      startedAt = clock();
      startSource();
    }
    dirty = true;
  }
  function updateButtons() {
    btnPlay.innerHTML = playing ? icons.pause : offset >= DURATION - 0.05 ? icons.replay : icons.play;
    btnMute.innerHTML = muted ? icons.mute : icons.vol;
    btnCC.classList.toggle('on', subtitles);
  }

  async function begin() {
    if (wantPlay) return;
    wantPlay = true;
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    ac = new AC();
    await ac.resume().catch(() => undefined);
    gain = ac.createGain();
    gain.connect(ac.destination);
    if (!buffer) tapStatus.textContent = 'Müzik hazırlanıyor…';
    await Promise.race([audioReady, new Promise((r) => setTimeout(r, 20000))]);
    tap.classList.add('gone');
    controls.classList.remove('hidden');
    play();
  }
  tap.addEventListener('click', begin);
  tap.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && begin());

  btnPlay.addEventListener('click', () => (playing ? pause() : play()));
  btnMute.addEventListener('click', () => {
    muted = !muted;
    if (gain) gain.gain.value = muted ? 0 : 1;
    updateButtons();
  });
  btnCC.addEventListener('click', () => {
    subtitles = !subtitles;
    dirty = true;
    updateButtons();
  });
  btnFS.addEventListener('click', async () => {
    const el = stage as any;
    if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
      (document.exitFullscreen ?? (document as any).webkitExitFullscreen)?.call(document);
    } else if (el.requestFullscreen) {
      await el.requestFullscreen().catch(() => undefined);
      (screen.orientation as any)?.lock?.('landscape').catch(() => undefined);
    } else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else stage.classList.toggle('pseudo-fs');
    setTimeout(resize, 300);
  });
  seekBar.addEventListener('input', () => {
    scrubbing = true;
    offset = Number(seekBar.value);
    dirty = true;
  });
  seekBar.addEventListener('change', () => {
    scrubbing = false;
    seekTo(Number(seekBar.value));
  });
  window.addEventListener('keydown', (e) => {
    if (!wantPlay) return;
    if (e.key === ' ' || e.key === 'k') { e.preventDefault(); playing ? pause() : play(); }
    else if (e.key === 'ArrowRight') seekTo(now() + 5);
    else if (e.key === 'ArrowLeft') seekTo(now() - 5);
    else if (e.key === 'm') btnMute.click();
    else if (e.key === 'c') btnCC.click();
    else if (e.key === 'f') btnFS.click();
    pokeControls();
  });

  // auto-hiding controls
  let hideTimer = 0;
  function showControls(stay = false) {
    if (!wantPlay) return;
    controls.classList.remove('hidden');
    stage.style.cursor = '';
    clearTimeout(hideTimer);
    if (!stay) hideTimer = window.setTimeout(() => {
      if (playing && !scrubbing) { controls.classList.add('hidden'); stage.style.cursor = 'none'; }
    }, 2600);
  }
  function pokeControls() { showControls(!playing); }
  stage.addEventListener('pointermove', () => pokeControls());
  canvas.addEventListener('click', () => {
    if (!wantPlay) return;
    if (controls.classList.contains('hidden')) pokeControls();
    else playing ? pause() : play();
  });

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  let lastFrame = -1;
  function loop() {
    let t = scrubbing ? offset : now();
    if (playing && t >= DURATION) {
      offset = DURATION;
      playing = false;
      stopSource();
      updateButtons();
      showControls(true);
      t = DURATION;
    }
    const f = Math.floor(Math.min(t, DURATION - 0.001) * FPS);
    if (f !== lastFrame || dirty) {
      lastFrame = f;
      dirty = false;
      renderFrame(ctx, f / FPS, { subtitles, scale });
      if (!scrubbing) seekBar.value = String(t);
      timeEl.textContent = `${fmt(t)} / ${fmt(DURATION)}`;
    }
    requestAnimationFrame(loop);
  }
  updateButtons();
  loadFonts().then(() => {
    dirty = true;
    requestAnimationFrame(loop);
  });
}
