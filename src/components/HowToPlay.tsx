import { getStage, shade } from '../game/stages';

const SAMPLE = getStage(1).chars;

type Props = { visible: boolean; onClose: () => void };

/** 遊び方（英語・3ステップ）。文章は最小限にして絵で見せる */
export default function HowToPlay({ visible, onClose }: Props) {
  if (!visible) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/40 px-5 backdrop-blur-md">
      <div className="animate-pop max-h-[calc(100dvh-32px)] w-full max-w-[330px] overflow-y-auto rounded-[34px] border border-white/80 bg-white/75 px-6 py-6 shadow-[0_18px_50px_rgba(150,120,185,0.28)] backdrop-blur-xl">
        <h2 className="text-center font-round text-2xl font-black text-[#F58FB0]">How to play</h2>

        <div className="mt-3 rounded-2xl border border-[#FFE6A4] bg-[#FFF9E5] px-3 py-3 text-center">
          <p className="text-[11px] font-black tracking-[0.08em] text-[#B78035]">CHALLENGE RULE</p>
          <p className="mt-1 text-[11px] font-bold leading-relaxed text-[#8A6E55]">
            FINAL + FINAL → 👑 FINAL
            <br />
            👑 FINAL + 👑 FINAL → 💎 FINAL
            <br />
            💎 FINAL + 💎 FINAL → 🌈 FINAL
            <br />
            🌈 FINAL + 🌈 FINAL → next row! (16 final letters)
            <br />
            🌈 FINAL made = RAINBOW BONUS +300
            <br />
            Level up: 100 EXP at Lv 1, +90 EXP each level
            <br />
            Auto-drop: 4 sec normal / 2 sec challenge
          </p>
        </div>

        <ol className="mt-4 flex flex-col gap-3">
          <Step n={1} text="Tap or drag, then release to drop a letter.">
            <div className="flex items-center gap-2">
              <Ball level={0} />
              <span className="text-2xl">👆</span>
              <span className="text-xl text-[#B49FC7]">↓</span>
            </div>
          </Step>

          <Step n={2} text="Two of the same letter merge into the next one.">
            <div className="flex items-center gap-1.5">
              <Ball level={0} />
              <span className="text-lg font-black text-[#B49FC7]">+</span>
              <Ball level={0} />
              <span className="text-lg font-black text-[#B49FC7]">=</span>
              <Ball level={1} />
            </div>
          </Step>

          <Step n={3} text="Listen — every letter says its own sound.">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🔊</span>
              <span className="font-round text-lg font-bold text-[#6B4E68]">
                あ = <span className="text-[#F58FB0]">&quot;a&quot;</span>
              </span>
            </div>
          </Step>
        </ol>

        <div className="mt-5 rounded-2xl bg-white/70 px-4 py-3 text-center">
          <p className="text-xs font-bold leading-relaxed text-[#8A6E96]">
            Keep the letters below the dotted line.
            <br />
            No penalties, no losing — just keep popping! 💕
          </p>
        </div>

        <button
          onClick={onClose}
          className="mx-auto mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-full border-2 border-white bg-gradient-to-b from-[#FFC6DF] to-[#F58FB0] text-white shadow-[0_10px_22px_rgba(245,143,176,0.45)] active:scale-95"
        >
          <span className="text-xl">▶</span>
          <span className="font-round text-xl font-black tracking-wide">Got it!</span>
        </button>
      </div>
    </div>
  );
}

function Step({ n, text, children }: { n: number; text: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F58FB0] text-xs font-black text-white">
        {n}
      </span>
      <div className="flex flex-col gap-2">
        {children}
        <p className="text-[13px] font-bold leading-snug text-[#7A5B74]">{text}</p>
      </div>
    </li>
  );
}

function Ball({ level }: { level: number }) {
  const c = SAMPLE[level];
  return (
    <span
      className="flex h-9 w-9 flex-col items-center justify-center rounded-full border border-white/80 shadow-sm"
      style={{
        background:
          'radial-gradient(circle at 32% 28%, ' + shade(c.base, 0.55) + ', ' + c.base + ' 62%, ' + shade(c.base, -0.14) + ')',
      }}
    >
      <span className="font-round text-[13px] font-bold leading-none text-[#5E4058]">{c.kana}</span>
      <span className="text-[7px] font-bold leading-none text-[#7A5B74]">{c.romaji}</span>
    </span>
  );
}
