import { useMemo } from 'react';
import { shade, type KanaChar } from '../game/stages';

type Props = {
  visible: boolean;
  chars: KanaChar[];
  score: number;
  best: number;
  unlocked: number;
  onRetry: () => void;
  onHome: () => void;
};

const CONFETTI_COLORS = ['#FFB6C1', '#FFD1BA', '#FFF2A3', '#B9F3CC', '#C1E3FE', '#D9C7F7'];

/** 全肯定リザルト: GAME OVER もブザーも無し。Finish! と紙吹雪だけ */
export default function ResultOverlay({ visible, chars, score, best, unlocked, onRetry, onHome }: Props) {
  const confetti = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 2.5,
        dur: 2.6 + Math.random() * 2.2,
        size: 6 + Math.random() * 8,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        round: i % 2 === 0,
      })),
    [visible],
  );

  if (!visible) return null;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center overflow-hidden bg-white/35 backdrop-blur-md">
      {confetti.map((c, i) => (
        <span
          key={i}
          className="absolute top-[-20px]"
          style={{
            left: c.left + '%',
            width: c.size,
            height: c.size * (c.round ? 1 : 1.6),
            background: c.color,
            borderRadius: c.round ? '50%' : '3px',
            animation: 'kp-fall ' + c.dur + 's linear ' + c.delay + 's infinite',
          }}
        />
      ))}

      <div className="animate-pop relative mx-5 w-[300px] rounded-[34px] border border-white/80 bg-white/70 px-6 py-7 text-center shadow-[0_18px_50px_rgba(150,120,185,0.28)] backdrop-blur-xl">
        <div className="font-round text-4xl font-black tracking-wide text-[#F58FB0] drop-shadow-sm">
          Finish!
        </div>
        <div className="mt-1 text-2xl">🎉</div>

        <div className="mt-4 rounded-3xl bg-white/70 py-3">
          <div className="text-[11px] font-bold tracking-[0.2em] text-[#A98EBE]">SCORE</div>
          <div className="font-round text-5xl font-black leading-tight text-[#6B4E68]">{score}</div>
          <div className="mt-1 text-[11px] font-bold text-[#B39CC4]">BEST {best}</div>
        </div>

        {/* 今回覚えた文字たち（全肯定のごほうび表示） */}
        <div className="mt-4 flex flex-wrap justify-center gap-1.5">
          {chars.slice(0, unlocked + 1).map((c) => (
            <div
              key={c.kana}
              className="flex h-9 w-9 flex-col items-center justify-center rounded-full border border-white/80 shadow-sm"
              style={{
                background:
                  'radial-gradient(circle at 32% 28%, ' + shade(c.base, 0.5) + ', ' + c.base + ' 62%, ' + shade(c.base, -0.15) + ')',
              }}
            >
              <span className="font-round font-bold leading-none text-[#5E4058]" style={{ fontSize: c.kana.length > 1 ? 10 : 13 }}>{c.kana}</span>
              <span className="text-[7px] font-bold leading-none text-[#7A5B74]">{c.romaji}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-center gap-4">
          <button
            onClick={onHome}
            aria-label="Home"
            className="flex h-12 items-center justify-center rounded-full border border-white/80 bg-white/70 px-4 text-xs font-black text-[#6B4E68] shadow-md active:scale-95"
          >
            HOME
          </button>
          <button
            onClick={onRetry}
            aria-label="Play again"
            className="animate-floaty flex h-16 w-16 items-center justify-center rounded-full border-2 border-white bg-gradient-to-b from-[#FFC6DF] to-[#F58FB0] text-3xl text-white shadow-[0_10px_22px_rgba(245,143,176,0.45)] active:scale-95"
          >
            ↻
          </button>
        </div>
      </div>

      <style>{'@keyframes kp-fall{0%{transform:translateY(-20px) rotate(0deg);opacity:1}100%{transform:translateY(760px) rotate(540deg);opacity:0.9}}'}</style>
    </div>
  );
}
