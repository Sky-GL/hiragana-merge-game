import { useState } from 'react';
import { MULT_COLORS } from '../game/popFx';

/** コンボ表示(盤面の外の専用の行に置く)。倍率が上がるほど縁の色が濃くなる */
export function ComboPill({ n, mult }: { n: number; mult: number }) {
  return (
    <div
      key={n}
      className="kp-bump flex items-baseline gap-1.5 rounded-full border-2 bg-white/75 px-3 py-0.5 shadow-md backdrop-blur-md"
      style={{ borderColor: MULT_COLORS[mult], boxShadow: '0 0 14px ' + MULT_COLORS[mult] + '66' }}
    >
      <span className="text-lg">🔥</span>
      <span className="font-round text-xl font-black leading-none" style={{ color: MULT_COLORS[mult] }}>{n}</span>
      <span className="text-[16px] font-black tracking-wider text-[#8A6E96]">COMBO</span>
      <span className="font-round text-lg font-black" style={{ color: MULT_COLORS[mult] }}>×{mult}</span>
    </div>
  );
}

/** 読み間違いのトースト。罰ではなく、2文字の読みを並べて教えるだけ */
export function MissToast({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-1/3 z-30 flex justify-center px-6">
      <div className="animate-pop flex flex-col items-center gap-1 rounded-[26px] border border-white/80 bg-white/85 px-6 py-3 shadow-[0_14px_36px_rgba(150,120,185,0.3)] backdrop-blur-xl">
        <span className="font-round text-xl font-black tracking-wide text-[#A98EBE]">{title}</span>
        <span className="font-round text-2xl font-black text-[#6B4E68]">{sub}</span>
      </div>
    </div>
  );
}

// ステージクリアの紙吹雪(CSSアニメーション。表示のたびに位置と色を作り直す。「視差効果を減らす」設定では出さない)
const CONFETTI_COLORS = ['#FFB6C1', '#FFD1BA', '#FFF2A3', '#B9F3CC', '#C1E3FE', '#D9C7F7'];

export function Confetti() {
  const [pieces] = useState(() =>
    Array.from({ length: 36 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      dur: 1.1 + Math.random() * 0.9,
      size: 6 + Math.random() * 8,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      round: i % 3 === 0,
    })),
  );
  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden rounded-[30px] motion-reduce:hidden" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-[-14px]"
          style={{
            left: p.left + '%',
            width: p.size,
            height: p.round ? p.size : p.size * 1.6,
            background: p.color,
            borderRadius: p.round ? '50%' : 3,
            animation: 'kp-fall ' + p.dur + 's linear ' + p.delay + 's forwards',
          }}
        />
      ))}
    </div>
  );
}
