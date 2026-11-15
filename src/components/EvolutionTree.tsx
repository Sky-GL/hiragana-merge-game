import { shade, type KanaChar } from '../game/stages';
import { FINAL_TIERS } from '../game/popFinal';

type Props = { chars: KanaChar[]; unlocked: number; nextLevel: number; tier: number };

/**
 * 五十音順を知らないユーザーのための常時表示進化ツリー（あ→い→う→…）。
 * 5文字すべての読みを常に出し（参照用）、未到達の文字は薄くする。続けて最終形の進化 👑2 → 💎4 → 🌈8 → NEXT を並べる。
 * 狭い画面でも全部見えるよう、はみ出す分は折り返す。
 */
export default function EvolutionTree({ chars, unlocked, nextLevel, tier }: Props) {
  return (
    <div
      data-testid="chain"
      className="flex w-full flex-wrap items-center justify-center gap-x-1 gap-y-1.5 rounded-3xl border border-white/70 bg-white/35 px-3 py-2 shadow-[0_8px_24px_rgba(160,130,190,0.18)] backdrop-blur-md"
    >
      {chars.map((c, i) => {
        const known = i <= unlocked;
        const active = i === nextLevel;
        return (
          <div key={c.kana + i} className="flex shrink-0 items-center gap-1">
            <div
              className={
                'flex h-11 w-11 flex-col items-center justify-center rounded-full border transition-all duration-300 ' +
                (active ? 'scale-110 border-white ring-2 ring-white/90 ' : 'border-white/60 ') +
                (known ? 'shadow-md' : 'opacity-60 saturate-50')
              }
              style={{
                background: known
                  ? 'radial-gradient(circle at 32% 28%, ' + shade(c.base, 0.5) + ', ' + c.base + ' 62%, ' + shade(c.base, -0.15) + ')'
                  : 'rgba(255,255,255,0.5)',
              }}
            >
              <span
                className="font-round font-bold leading-none text-[#5E4058]"
                style={{ fontSize: c.kana.length > 1 ? 11 : 15 }}
              >
                {c.kana}
              </span>
              <span className="mt-[1px] text-[8px] font-bold leading-none text-[#7A5B74]">{c.romaji}</span>
            </div>
            <span className="text-[10px] text-[#B49FC7]">▸</span>
          </div>
        );
      })}
      {FINAL_TIERS.slice(1).map((f) => {
        const on = tier >= f.tier;
        return (
          <div key={f.tier} className="flex shrink-0 items-center gap-1">
            <span
              className={'flex items-center gap-0.5 rounded-full border-2 bg-white/60 px-2 py-0.5 transition-all duration-300 ' + (on ? 'shadow-md' : 'opacity-50 saturate-50')}
              style={{ borderColor: on ? f.color : 'rgba(255,255,255,0.8)' }}
            >
              <span className="text-lg leading-none">{f.icon}</span>
              <span className="font-round text-[13px] font-black leading-none text-[#6B4E68]">{f.badge}</span>
            </span>
            <span className="text-[10px] text-[#B49FC7]">▸</span>
          </div>
        );
      })}
      <span className="shrink-0 rounded-full border-2 border-dashed border-[#D9C7F7] px-2 py-0.5 text-[10px] font-black tracking-wider text-[#A98EBE]">NEXT</span>
    </div>
  );
}
