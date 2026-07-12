"use client";

import type { Faction, GuessOutcome } from "@cosmere/shared";
import { cn } from "../../lib/utils";
import { ringColorClass } from "./labels";

export interface ActiveFx {
  cardId: string;
  outcome: GuessOutcome;
  faction: Faction;
  cx: number;
  cy: number;
  nonce: number;
}

/** 固定特效层：边缘闪光、刺客爆震、翻牌光环/火花。不受滚动容器裁剪、不被侧栏遮挡。 */
export function RevealFx({
  fx,
  edgeFlash,
  assassinBlast
}: {
  fx: ActiveFx | null;
  edgeFlash: string | null;
  assassinBlast: boolean;
}) {
  return (
    <>
      {edgeFlash ? <div className="edge-flash" style={{ boxShadow: `inset 0 0 140px 36px ${edgeFlash}` }} /> : null}
      {assassinBlast ? (
        <>
          <div className="assassin-overlay" />
          <div className="fx-shockwave" />
        </>
      ) : null}
      {fx ? (
        <div
          key={fx.nonce}
          className={cn("pointer-events-none fixed z-[80]", ringColorClass[fx.faction])}
          style={{ left: fx.cx, top: fx.cy }}
        >
          <span className="fx-ring-fixed" />
          {fx.outcome !== "neutral"
            ? Array.from({ length: 10 }, (_, i) => {
                const angle = (i / 10) * Math.PI * 2;
                return (
                  <span
                    key={i}
                    className="fx-spark"
                    style={
                      {
                        "--dx": `${Math.cos(angle) * 54}px`,
                        "--dy": `${Math.sin(angle) * 54}px`
                      } as React.CSSProperties
                    }
                  />
                );
              })
            : null}
        </div>
      ) : null}
    </>
  );
}
