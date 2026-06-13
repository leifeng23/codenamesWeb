"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Points } from "three";

function Stars() {
  const ref = useRef<Points>(null);
  const positions = useMemo(() => {
    const data = new Float32Array(900);
    for (let i = 0; i < data.length; i += 3) {
      data[i] = (Math.random() - 0.5) * 24;
      data[i + 1] = (Math.random() - 0.5) * 14;
      data[i + 2] = (Math.random() - 0.5) * 12;
    }
    return data;
  }, []);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.018;
      ref.current.rotation.x += delta * 0.006;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial color="#9ee9ff" size={0.035} sizeAttenuation transparent opacity={0.72} />
    </points>
  );
}

export function Starfield() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 opacity-80">
      <Canvas camera={{ position: [0, 0, 8], fov: 62 }}>
        <Stars />
      </Canvas>
    </div>
  );
}
