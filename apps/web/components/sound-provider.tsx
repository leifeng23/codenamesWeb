"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { Howl } from "howler";

type SoundName =
  | "click"
  | "reveal"
  | "correct"
  | "neutral"
  | "enemy"
  | "assassin"
  | "start"
  | "win"
  | "lose";

interface SoundContextValue {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  play: (name: SoundName) => void;
}

const SoundContext = createContext<SoundContextValue | null>(null);

interface Note {
  freq: number;
  start: number; // 秒
  dur: number; // 秒
  gain?: number;
  type?: "sine" | "triangle" | "square";
}

function renderNote(data: Float32Array, sampleRate: number, note: Note) {
  const startIdx = Math.floor(note.start * sampleRate);
  const length = Math.floor(note.dur * sampleRate);
  const gain = note.gain ?? 1;
  for (let i = 0; i < length; i++) {
    const idx = startIdx + i;
    if (idx >= data.length) break;
    const t = i / sampleRate;
    const env = Math.exp(-5 * (t / note.dur)) * (1 - Math.exp(-60 * t)); // 起音+衰减
    let wave: number;
    const phase = 2 * Math.PI * note.freq * t;
    if (note.type === "triangle") {
      wave = (2 / Math.PI) * Math.asin(Math.sin(phase));
    } else if (note.type === "square") {
      wave = Math.sign(Math.sin(phase));
    } else {
      wave = Math.sin(phase);
    }
    data[idx] += wave * env * gain;
  }
}

function makeSound(notes: Note[]) {
  const sampleRate = 44100;
  const totalDur = Math.max(...notes.map((n) => n.start + n.dur)) + 0.02;
  const data = new Float32Array(Math.ceil(sampleRate * totalDur));
  for (const note of notes) renderNote(data, sampleRate, note);
  // 归一防爆音
  let peak = 0;
  for (const v of data) peak = Math.max(peak, Math.abs(v));
  if (peak > 1) for (let i = 0; i < data.length; i++) data[i] /= peak;
  return URL.createObjectURL(new Blob([encodeWav(data, sampleRate)], { type: "audio/wav" }));
}

function makeTone(frequency: number, duration = 0.12, type: Note["type"] = "sine") {
  return makeSound([{ freq: frequency, start: 0, dur: duration, type }]);
}

function encodeWav(samples: Float32Array, sampleRate: number) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (const sample of samples) {
    view.setInt16(offset, Math.max(-1, Math.min(1, sample)) * 0x7fff, true);
    offset += 2;
  }
  return buffer;
}

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(true);
  const sounds = useMemo(
    () => ({
      click: new Howl({ src: [makeTone(620, 0.1)], volume: 0.2 }),
      reveal: new Howl({ src: [makeTone(360, 0.18)], volume: 0.24 }),
      // 猜对：上扬的清脆双音
      correct: new Howl({
        src: [
          makeSound([
            { freq: 660, start: 0, dur: 0.14, type: "triangle" },
            { freq: 990, start: 0.08, dur: 0.22, type: "triangle" }
          ])
        ],
        volume: 0.32
      }),
      // 中立：低沉闷响
      neutral: new Howl({ src: [makeTone(160, 0.26, "sine")], volume: 0.3 }),
      // 猜错对方色：下行的负面提示
      enemy: new Howl({
        src: [
          makeSound([
            { freq: 380, start: 0, dur: 0.16, type: "square", gain: 0.5 },
            { freq: 240, start: 0.12, dur: 0.26, type: "square", gain: 0.5 }
          ])
        ],
        volume: 0.3
      }),
      // 刺客：低频爆鸣
      assassin: new Howl({
        src: [
          makeSound([
            { freq: 110, start: 0, dur: 0.5, type: "square", gain: 0.7 },
            { freq: 55, start: 0.04, dur: 0.6, type: "sine", gain: 0.9 }
          ])
        ],
        volume: 0.4
      }),
      start: new Howl({ src: [makeTone(780, 0.2, "triangle")], volume: 0.24 }),
      // 胜利：上行三连音号角
      win: new Howl({
        src: [
          makeSound([
            { freq: 523, start: 0, dur: 0.18, type: "triangle" },
            { freq: 659, start: 0.16, dur: 0.18, type: "triangle" },
            { freq: 784, start: 0.32, dur: 0.34, type: "triangle" },
            { freq: 1046, start: 0.32, dur: 0.34, type: "triangle", gain: 0.6 }
          ])
        ],
        volume: 0.34
      }),
      // 失败：下行低音
      lose: new Howl({
        src: [
          makeSound([
            { freq: 392, start: 0, dur: 0.22, type: "sine" },
            { freq: 311, start: 0.2, dur: 0.26, type: "sine" },
            { freq: 196, start: 0.42, dur: 0.42, type: "sine" }
          ])
        ],
        volume: 0.32
      })
    }),
    []
  );

  const value = useMemo(
    () => ({
      enabled,
      setEnabled,
      play(name: SoundName) {
        if (enabled) sounds[name].play();
      }
    }),
    [enabled, sounds]
  );

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

export function useSound() {
  const context = useContext(SoundContext);
  if (!context) throw new Error("useSound must be used inside SoundProvider");
  return context;
}
