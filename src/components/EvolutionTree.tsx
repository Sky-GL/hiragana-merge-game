import { useEffect, useRef } from 'react';
import { shade, type KanaChar } from '../game/stages';

type Props = { chars: KanaChar[]; unlocked: number; nextLevel: number };

/** 五十音順を知らないユーザーのための常時表示進化ツリー（あ→い→う→…） */
export default function EvolutionTree({ chars, unlocked, nextLevel }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[data-active="1"]');
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [unlocked, nextLevel, chars]);

  return (
    <div
      ref={ref}
      className="no-scrollbar flex w-full items-center gap-1 overflow-x-auto rounded-3xl border border-white/70 bg-white/35 px-3 py-2 shadow-[0_8px_24px_rgba(160,130,190,0.18)] backdrop-blur-md"
    >
      {chars.map((c, i) => {
        const known = i <= unlocked;
        const active = i === nextLevel;
        return (
          <div key={c.kana} className="flex shrink-0 items-center gap-1">
            <div
              data-active={active ? '1' : '0'}
              className={
                'flex h-11 w-11 flex-col items-center justify-center rounded-full border transition-all duration-300 ' +
                (active ? 'scale-110 border-white ring-2 ring-white/90 ' : 'border-white/60 ') +
                (known ? 'shadow-md' : 'opacity-45 saturate-50')
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
            {i < chars.length - 1 && <span className="text-[10px] text-[#B49FC7]">▸</span>}
          </div>
        );
      })}
    </div>
  );
}
