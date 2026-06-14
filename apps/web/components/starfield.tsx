"use client";

import { useEffect, useRef } from "react";

interface Star {
  x: number;
  y: number;
  z: number; // 视差层 0..1（越大越近、越亮、漂移越快）
  r: number;
  baseAlpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
  hue: number;
}

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  len: number;
}

export function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const context = canvasEl.getContext("2d");
    if (!context) return;
    const canvas = canvasEl; // 收窄后的非空引用，供闭包使用
    const ctx = context;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let stars: Star[] = [];
    const shooting: ShootingStar[] = [];

    function buildStars() {
      const density = Math.min(1.15, (width * height) / 1_500_000);
      const count = Math.floor(230 * density) + 80;
      stars = Array.from({ length: count }, () => {
        const z = Math.random();
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          z,
          r: (0.45 + z * 1.3) * dpr,
          baseAlpha: 0.22 + z * 0.32,
          twinkleSpeed: 0.5 + Math.random() * 1.4,
          twinklePhase: Math.random() * Math.PI * 2,
          // 冷色星空：青蓝到淡紫
          hue: 200 + Math.random() * 55
        };
      });
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth * dpr;
      height = window.innerHeight * dpr;
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      buildStars();
    }

    function spawnShootingStar() {
      const startX = Math.random() * width * 0.8;
      const startY = Math.random() * height * 0.4;
      const angle = Math.PI * (0.18 + Math.random() * 0.12);
      const speed = (6 + Math.random() * 5) * dpr;
      shooting.push({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 60 + Math.random() * 40,
        len: (90 + Math.random() * 120) * dpr
      });
    }

    let raf = 0;
    let last = performance.now();
    let shootTimer = 6 + Math.random() * 8;

    function frame(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, width, height);

      const t = now / 1000;
      for (const s of stars) {
        // 缓慢视差漂移
        s.x += s.z * 4 * dpr * dt;
        if (s.x > width + 4) s.x = -4;
        const twinkle = reduceMotion
          ? s.baseAlpha
          : s.baseAlpha * (0.55 + 0.45 * Math.sin(t * s.twinkleSpeed + s.twinklePhase));
        ctx.beginPath();
        ctx.fillStyle = `hsla(${s.hue}, 80%, 86%, ${twinkle})`;
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
        if (s.z > 0.82) {
          // 仅极少数近处亮星带微弱光晕
          ctx.beginPath();
          ctx.fillStyle = `hsla(${s.hue}, 90%, 88%, ${twinkle * 0.1})`;
          ctx.arc(s.x, s.y, s.r * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 流星
      if (!reduceMotion) {
        shootTimer -= dt;
        if (shootTimer <= 0) {
          spawnShootingStar();
          shootTimer = 11 + Math.random() * 12;
        }
        for (let i = shooting.length - 1; i >= 0; i--) {
          const m = shooting[i];
          m.life += 1;
          m.x += m.vx;
          m.y += m.vy;
          const fade = 1 - m.life / m.maxLife;
          if (fade <= 0) {
            shooting.splice(i, 1);
            continue;
          }
          const grad = ctx.createLinearGradient(m.x, m.y, m.x - m.vx / Math.hypot(m.vx, m.vy) * m.len, m.y - m.vy / Math.hypot(m.vx, m.vy) * m.len);
          grad.addColorStop(0, `rgba(190, 240, 255, ${0.9 * fade})`);
          grad.addColorStop(1, "rgba(190, 240, 255, 0)");
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.6 * dpr;
          ctx.beginPath();
          ctx.moveTo(m.x, m.y);
          ctx.lineTo(m.x - (m.vx / Math.hypot(m.vx, m.vy)) * m.len, m.y - (m.vy / Math.hypot(m.vx, m.vy)) * m.len);
          ctx.stroke();
        }
      }

      raf = requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="nebula-layer absolute inset-0" />
      <canvas ref={canvasRef} className="absolute inset-0 opacity-70" />
      <div className="vignette-layer absolute inset-0" />
    </div>
  );
}
