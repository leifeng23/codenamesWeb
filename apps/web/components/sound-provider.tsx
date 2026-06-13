"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { Howl } from "howler";

type SoundName = "click" | "reveal" | "assassin" | "start";

interface SoundContextValue {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  play: (name: SoundName) => void;
}

const SoundContext = createContext<SoundContextValue | null>(null);

function makeTone(frequency: number, duration = 0.12) {
  const sampleRate = 44100;
  const length = sampleRate * duration;
  const data = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    data[i] = Math.sin(2 * Math.PI * frequency * t) * Math.exp(-14 * t);
  }
  const wav = encodeWav(data, sampleRate);
  return URL.createObjectURL(new Blob([wav], { type: "audio/wav" }));
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
      click: new Howl({ src: [makeTone(620)], volume: 0.22 }),
      reveal: new Howl({ src: [makeTone(360, 0.18)], volume: 0.28 }),
      assassin: new Howl({ src: [makeTone(90, 0.3)], volume: 0.35 }),
      start: new Howl({ src: [makeTone(780, 0.2)], volume: 0.24 })
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
