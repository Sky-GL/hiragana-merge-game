import { shade, type KanaChar } from '../game/stages';

type Props = { level: number | null; unlockedChar: KanaChar | null };

/** レベルアップ演出。新しく出るようになった文字があればボールで見せる */
export default function LevelUpToast({ level, unlockedChar }: Props) {
  if (level === null) return null;
  const c = unlockedChar;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-1/3 z-30 flex justify-center px-6">
      <div className="animate-pop flex flex-col items-center gap-2 rounded-[28px] border border-white/80 bg-white/80 px-7 py-4 shadow-[0_14px_36px_rgba(150,120,185,0.3)] backdrop-blur-xl">
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl">✨</span>
          <span className="text-[11px] font-black tracking-[0.2em] text-[#B4708C]">LV</span>
          <span className="font-round text-4xl font-black leading-none text-[#F58FB0]">{level}</span>
          <span className="text-xl">✨</span>
        </div>

        {c && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#B49FC7]">＋</span>
            <span
              className="flex h-11 w-11 flex-col items-center justify-center rounded-full border border-white/90 shadow-md"
              style={{
                background:
                  'radial-gradient(circle at 32% 26%, ' + shade(c.base, 0.6) + ', ' + c.base + ' 60%, ' + shade(c.base, -0.12) + ')',
              }}
            >
              <span className="font-round font-bold leading-none text-[#5E4058]" style={{ fontSize: c.kana.length > 1 ? 12 : 16 }}>{c.kana}</span>
              <span className="text-[8px] font-bold leading-none text-[#7A5B74]">{c.romaji}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
