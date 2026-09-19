import { shade, type Stage } from '../game/stages';

type Props = { stage: Stage | null; title: string; subtitle?: string };

/** ステージクリア演出。次に解放された行を代表文字で見せる（説明文なし） */
export default function StageClearToast({ stage, title, subtitle }: Props) {
  if (!stage) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-1/4 z-30 flex justify-center px-6">
      <div className="animate-pop flex flex-col items-center gap-2 rounded-[30px] border border-white/80 bg-white/85 px-8 py-5 shadow-[0_16px_40px_rgba(150,120,185,0.32)] backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🔓</span>
          <span className="font-round text-xl font-black tracking-wide text-[#F58FB0]">{title}</span>
        </div>
        {subtitle && <span className="text-xs font-black tracking-[0.12em] text-[#A98EBE]">{subtitle}</span>}
        <div className="flex items-center gap-1.5">
          {stage.chars.slice(0, 5).map((ch) => (
            <span
              key={ch.kana}
              className="flex h-10 w-10 flex-col items-center justify-center rounded-full border border-white/90 shadow-sm"
              style={{
                background:
                  'radial-gradient(circle at 32% 26%, ' + shade(ch.base, 0.6) + ', ' + ch.base + ' 60%, ' + shade(ch.base, -0.12) + ')',
              }}
            >
              <span
                className="font-round font-bold leading-none text-[#5E4058]"
                style={{ fontSize: ch.kana.length > 1 ? 11 : 15 }}
              >
                {ch.kana}
              </span>
              <span className="text-[7px] font-bold leading-none text-[#7A5B74]">{ch.romaji}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
