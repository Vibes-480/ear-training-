// Transcription helper: slow down, loop and pick apart real recordings.
// Works with local audio/video files (with a waveform) and YouTube videos.

import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { audio } from "../audio/engine";
import { useMic } from "../audio/mic";
import { Piano } from "../components/Piano";
import { PitchMeter } from "../components/PitchMeter";
import { getSettings, type InstrumentId } from "../store/settings";

/** What both sources (file and YouTube) can do. */
interface Player {
  play(): void;
  pause(): void;
  playing(): boolean;
  time(): number;
  seek(t: number): void;
  duration(): number;
  setRate(r: number): void;
  rates: number[] | null;
  destroy(): void;
}

interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  getPlayerState(): number;
  getCurrentTime(): number;
  seekTo(t: number, allowSeekAhead: boolean): void;
  getDuration(): number;
  setPlaybackRate(r: number): void;
  getAvailablePlaybackRates(): number[];
  destroy(): void;
}
declare global {
  interface Window {
    YT?: { Player: new (el: HTMLElement, opts: unknown) => YTPlayer };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytPromise: Promise<void> | null = null;
function loadYouTube(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (!ytPromise) {
    ytPromise = new Promise((resolve, reject) => {
      window.onYouTubeIframeAPIReady = () => resolve();
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      s.onerror = () => reject(new Error("Couldn't load YouTube"));
      document.head.appendChild(s);
    });
  }
  return ytPromise;
}

export function youTubeId(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1, 12) || null;
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return v.slice(0, 11);
      const m = u.pathname.match(/\/(embed|shorts|live)\/([\w-]{11})/);
      if (m) return m[2];
    }
  } catch {
    // not a URL
  }
  return null;
}

function fmt(t: number): string {
  if (!isFinite(t)) return "0:00";
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

const FILE_RATES = [0.25, 0.4, 0.5, 0.6, 0.7, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5];

interface Loop {
  name: string;
  a: number;
  b: number;
}

export function TranscribePage() {
  const [source, setSource] = useState<"file" | "youtube">("file");
  const [fileName, setFileName] = useState<string | null>(null);
  const [ytInput, setYtInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [peaks, setPeaks] = useState<Float32Array | null>(null);
  const [rate, setRate] = useState(1);
  const [keepPitch, setKeepPitch] = useState(true);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [a, setA] = useState<number | null>(null);
  const [b, setB] = useState<number | null>(null);
  const [looping, setLooping] = useState(false);
  const [loops, setLoops] = useState<Loop[]>([]);
  const [hum, setHum] = useState(false);
  const [ready, setReady] = useState(false);

  const player = useRef<Player | null>(null);
  const mediaEl = useRef<HTMLAudioElement>(null);
  const ytBox = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const urlRef = useRef<string | null>(null);

  const { state: micState, reading } = useMic(hum);

  // ---- Sources ----
  const loadFile = async (file: File) => {
    setError(null);
    player.current?.destroy();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const url = URL.createObjectURL(file);
    urlRef.current = url;
    const el = mediaEl.current!;
    el.src = url;
    (el as HTMLAudioElement & { preservesPitch?: boolean; webkitPreservesPitch?: boolean }).preservesPitch = keepPitch;
    (el as HTMLAudioElement & { webkitPreservesPitch?: boolean }).webkitPreservesPitch = keepPitch;
    player.current = {
      play: () => void el.play(),
      pause: () => el.pause(),
      playing: () => !el.paused,
      time: () => el.currentTime,
      seek: (x) => (el.currentTime = Math.max(0, Math.min(x, el.duration || x))),
      duration: () => el.duration || 0,
      setRate: (r) => (el.playbackRate = r),
      rates: null,
      destroy: () => el.pause(),
    };
    setFileName(file.name);
    setReady(true);
    setPeaks(null);
    setA(null);
    setB(null);
    setLooping(false);
    el.playbackRate = rate;
    // Waveform: decode once and keep min/max per pixel column.
    try {
      const ctx = await audio.unlock();
      const buf = await ctx.decodeAudioData(await file.arrayBuffer());
      const data = buf.getChannelData(0);
      const cols = 1200;
      const p = new Float32Array(cols * 2);
      const per = Math.max(1, Math.floor(data.length / cols));
      for (let c = 0; c < cols; c++) {
        let mn = 1;
        let mx = -1;
        const start = c * per;
        for (let i = start; i < start + per && i < data.length; i += 4) {
          const v = data[i];
          if (v < mn) mn = v;
          if (v > mx) mx = v;
        }
        p[c * 2] = mn;
        p[c * 2 + 1] = mx;
      }
      setPeaks(p);
    } catch {
      // Some formats play but can't be decoded for a waveform; that's fine.
    }
  };

  const loadYT = async () => {
    const id = youTubeId(ytInput);
    if (!id) {
      setError("That doesn't look like a YouTube link.");
      return;
    }
    setError(null);
    player.current?.destroy();
    mediaEl.current?.pause();
    setPeaks(null);
    setA(null);
    setB(null);
    setLooping(false);
    try {
      await loadYouTube();
      const box = ytBox.current!;
      box.innerHTML = "";
      const host = document.createElement("div");
      box.appendChild(host);
      await new Promise<void>((resolve) => {
        const yt = new window.YT!.Player(host, {
          videoId: id,
          width: "100%",
          height: "100%",
          playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
          events: {
            onReady: () => {
              player.current = {
                play: () => yt.playVideo(),
                pause: () => yt.pauseVideo(),
                playing: () => yt.getPlayerState() === 1,
                time: () => yt.getCurrentTime(),
                seek: (x) => yt.seekTo(Math.max(0, x), true),
                duration: () => yt.getDuration(),
                setRate: (r) => yt.setPlaybackRate(r),
                rates: yt.getAvailablePlaybackRates(),
                destroy: () => yt.destroy(),
              };
              resolve();
            },
          },
        });
      });
      setFileName(null);
      setReady(true);
      setRate(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the video.");
    }
  };

  useEffect(
    () => () => {
      player.current?.destroy();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  // ---- Clock + looping ----
  const loopRef = useRef({ a, b, looping });
  loopRef.current = { a, b, looping };
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const p = player.current;
      if (p) {
        const now = p.time();
        const { a: la, b: lb, looping: lp } = loopRef.current;
        if (lp && la !== null && lb !== null && lb > la && now >= lb) p.seek(la);
        setT(now);
        setDur(p.duration());
        setIsPlaying(p.playing());
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const changeRate = (r: number) => {
    setRate(r);
    player.current?.setRate(r);
  };
  const toggle = () => {
    const p = player.current;
    if (!p) return;
    if (p.playing()) p.pause();
    else {
      if (looping && a !== null && b !== null && (p.time() < a || p.time() >= b)) p.seek(a);
      p.play();
    }
  };
  const nudge = (s: number) => player.current?.seek((player.current?.time() ?? 0) + s);

  // ---- Keyboard ----
  const kb = useRef({ toggle, nudge, t, a, b });
  kb.current = { toggle, nudge, t, a, b };
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && ["INPUT", "SELECT", "TEXTAREA"].includes(el.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = kb.current;
      if (e.key === " ") {
        e.preventDefault();
        k.toggle();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        k.nudge(e.shiftKey ? -1 : -5);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        k.nudge(e.shiftKey ? 1 : 5);
      } else if (e.key === "[") setA(k.t);
      else if (e.key === "]") {
        setB(k.t);
        if (k.a !== null && k.t > k.a) setLooping(true);
      } else if (e.key.toLowerCase() === "l") setLooping((x) => !x);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // ---- Waveform drawing ----
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    const h = c.clientHeight;
    if (c.width !== w * dpr || c.height !== h * dpr) {
      c.width = w * dpr;
      c.height = h * dpr;
    }
    const g = c.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const css = getComputedStyle(c);
    const accent = css.getPropertyValue("--accent").trim();
    const muted = css.getPropertyValue("--border").trim();
    const x = (sec: number) => (dur ? (sec / dur) * w : 0);
    if (a !== null && b !== null && b > a) {
      g.fillStyle = accent + "26";
      g.fillRect(x(a), 0, x(b) - x(a), h);
    }
    if (peaks) {
      const cols = peaks.length / 2;
      for (let px = 0; px < w; px++) {
        const ci = Math.floor((px / w) * cols);
        const mn = peaks[ci * 2];
        const mx = peaks[ci * 2 + 1];
        const played = dur && px <= x(t);
        g.fillStyle = played ? accent : muted;
        g.fillRect(px, h / 2 - mx * (h / 2), 1, Math.max(1, (mx - mn) * (h / 2)));
      }
    } else {
      g.fillStyle = muted;
      g.fillRect(0, h / 2 - 1, w, 2);
      g.fillStyle = accent;
      g.fillRect(0, h / 2 - 1, x(t), 2);
    }
    g.fillStyle = css.getPropertyValue("--text").trim();
    g.fillRect(x(t), 0, 2, h);
    for (const [m, label] of [
      [a, "A"],
      [b, "B"],
    ] as const) {
      if (m === null) continue;
      g.fillStyle = accent;
      g.fillRect(x(m) - 1, 0, 2, h);
      g.font = "bold 11px system-ui";
      g.fillText(label, x(m) + 3, 12);
    }
  }, [peaks, t, dur, a, b]);

  // Click to seek, drag to select a loop.
  const drag = useRef<{ start: number; moved: boolean } | null>(null);
  const secAt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * dur;
  };

  const instrument = (): InstrumentId => {
    const s = getSettings();
    return audio.state(s.instrument) === "ready" ? s.instrument : "synth";
  };
  const onKey = useCallback((m: number) => void audio.tap(m, instrument()), []);

  const rates = player.current?.rates ?? FILE_RATES;

  return (
    <div className="page">
      <Link to="/" className="back">
        ← Home
      </Link>
      <h1>Transcribe</h1>
      <p className="lede">Slow down and loop real recordings to work out parts by ear.</p>

      <div className="segmented wide" role="tablist">
        <button type="button" role="tab" aria-selected={source === "file"} className={source === "file" ? "on" : ""} onClick={() => setSource("file")}>
          Audio file
        </button>
        <button type="button" role="tab" aria-selected={source === "youtube"} className={source === "youtube" ? "on" : ""} onClick={() => setSource("youtube")}>
          YouTube
        </button>
      </div>

      <section className="card" style={{ marginTop: 16 }}>
        {source === "file" ? (
          <label className="file-drop">
            <input
              type="file"
              accept="audio/*,video/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void loadFile(f);
              }}
            />
            <span>{fileName ? `▶ ${fileName}` : "Choose an audio or video file from your device"}</span>
            <span className="muted small">MP3, WAV, M4A, MP4… It stays on your device.</span>
          </label>
        ) : (
          <form
            className="field-row"
            onSubmit={(e) => {
              e.preventDefault();
              void loadYT();
            }}
          >
            <input className="text-input" placeholder="Paste a YouTube link" value={ytInput} onChange={(e) => setYtInput(e.target.value)} aria-label="YouTube link" />
            <button type="submit" className="btn primary">
              Load
            </button>
          </form>
        )}
        {error && <p className="warn">{error}</p>}
        <audio ref={mediaEl} preload="auto" hidden />
        <div ref={ytBox} className={source === "youtube" && !fileName && ready ? "yt-box" : "yt-box empty"} />
      </section>

      {ready && (
        <section className="card transport">
          <canvas
            ref={canvas}
            className="waveform"
            aria-label="Waveform: click to jump, drag to select a loop"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              drag.current = { start: secAt(e), moved: false };
            }}
            onPointerMove={(e) => {
              if (!drag.current) return;
              const now = secAt(e);
              if (Math.abs(now - drag.current.start) > dur * 0.005) {
                drag.current.moved = true;
                setA(Math.min(drag.current.start, now));
                setB(Math.max(drag.current.start, now));
              }
            }}
            onPointerUp={(e) => {
              if (drag.current && !drag.current.moved) player.current?.seek(secAt(e));
              else if (drag.current?.moved) {
                setLooping(true);
                player.current?.seek(Math.min(drag.current.start, secAt(e)));
              }
              drag.current = null;
            }}
          />
          <div className="time-row tabular">
            <span>{fmt(t)}</span>
            <span className="muted">{fmt(dur)}</span>
          </div>

          <div className="transport-row">
            <button type="button" className="btn" onClick={() => nudge(-5)} aria-label="Back 5 seconds">
              −5s
            </button>
            <button type="button" className="btn primary play-btn" onClick={toggle}>
              {isPlaying ? "Pause" : "Play"}
            </button>
            <button type="button" className="btn" onClick={() => nudge(5)} aria-label="Forward 5 seconds">
              +5s
            </button>
          </div>

          <div className="field-inline">
            <span>Speed</span>
            <div className="chips">
              {[0.5, 0.75, 1].map((r) => (
                <button key={r} type="button" className={`chip ${rate === r ? "on" : ""}`} onClick={() => changeRate(r)}>
                  {Math.round(r * 100)}%
                </button>
              ))}
              <select value={rate} onChange={(e) => changeRate(Number(e.target.value))} aria-label="Exact speed">
                {rates.map((r) => (
                  <option key={r} value={r}>
                    {Math.round(r * 100)}%
                  </option>
                ))}
              </select>
            </div>
          </div>
          {source === "file" && (
            <label className="switch-row">
              <span>
                <span className="switch-label">Keep the pitch when slowing down</span>
                <span className="hint">Turn off to hear it an octave lower at half speed, handy for fast solos and bass lines</span>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={keepPitch}
                onChange={(e) => {
                  setKeepPitch(e.target.checked);
                  const el = mediaEl.current as (HTMLAudioElement & { preservesPitch?: boolean; webkitPreservesPitch?: boolean }) | null;
                  if (el) {
                    el.preservesPitch = e.target.checked;
                    el.webkitPreservesPitch = e.target.checked;
                  }
                }}
              />
            </label>
          )}

          <div className="loop-row">
            <button type="button" className="btn small" onClick={() => setA(t)}>
              Set A {a !== null && <span className="muted">{fmt(a)}</span>}
            </button>
            <button
              type="button"
              className="btn small"
              onClick={() => {
                setB(t);
                if (a !== null && t > a) setLooping(true);
              }}
            >
              Set B {b !== null && <span className="muted">{fmt(b)}</span>}
            </button>
            <button type="button" className={`btn small ${looping ? "primary" : ""}`} disabled={a === null || b === null || b <= a} onClick={() => setLooping((x) => !x)}>
              Loop {looping ? "on" : "off"}
            </button>
            <button
              type="button"
              className="btn small"
              disabled={a === null || b === null || b <= a}
              onClick={() => setLoops((l) => [...l, { name: `Section ${l.length + 1}`, a: a!, b: b! }])}
            >
              Save loop
            </button>
          </div>
          {loops.length > 0 && (
            <div className="chips" style={{ marginTop: 8 }}>
              {loops.map((l, i) => (
                <button
                  key={i}
                  type="button"
                  className="chip"
                  onClick={() => {
                    setA(l.a);
                    setB(l.b);
                    setLooping(true);
                    player.current?.seek(l.a);
                  }}
                >
                  {l.name} ({fmt(l.a)}–{fmt(l.b)})
                </button>
              ))}
            </div>
          )}
          <p className="hint" style={{ marginTop: 10 }}>
            Space play/pause · ← → jump 5 s (Shift: 1 s) · [ and ] set A and B · L loop · Drag on the waveform to select a loop
          </p>
        </section>
      )}

      <section className="card">
        <h2 className="card-title">Find the notes</h2>
        <p className="muted small">Tap the piano to match what you hear, or hum the note and read its name.</p>
        <Piano lo={36} hi={84} onKey={onKey} focusMidi={60} />
        <label className="switch-row" style={{ marginTop: 8 }}>
          <span>
            <span className="switch-label">Hum to find the note</span>
            <span className="hint">Uses the microphone. Pause the music or wear headphones so it hears only you.</span>
          </span>
          <input type="checkbox" role="switch" checked={hum} onChange={(e) => setHum(e.target.checked)} />
        </label>
        {hum && <PitchMeter reading={reading} state={micState} />}
      </section>
    </div>
  );
}
