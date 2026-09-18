import { expToNext } from '../game/progress';

type Props = { level: number; exp: number };

/** Lv バッジ + 経験値バー（数字とバーだけの非言語UI） */
export default function LevelBar({ level, exp }: Props) {
  const need = expToNext(level);
  const pct = Math.max(0, Math.min(100, (exp / need) * 100));

  return (
    <div className="flex w-full items-center gap-2">
      <div className="flex h-7 shrink-0 items-center gap-1 rounded-full border border-white/80 bg-gradient-to-b from-[#FFE1EC] to-[#FFC6DF] px-2.5 shadow-sm">
        <span className="text-[9px] font-black tracking-wider text-[#B4708C]">LV</span>
        <span className="font-round text-base font-black leading-none text-[#6B4E68]">{level}</span>
      </div>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full border border-white/70 bg-white/50">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#FFD59E] via-[#FFC6DF] to-[#D9C7F7] transition-[width] duration-500"
          style={{ width: pct + '%' }}
        />
      </div>
    </div>
  );
}
