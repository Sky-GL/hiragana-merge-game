import { STAGES, shade } from '../game/stages';

type Props = {
  best: number;
  playerLevel: number;
  unlockedStages: number;
  stageId: number;
  onSelectStage: (id: number) => void;
  onPlay: () => void;
  onHelp: () => void;
};

/** 表紙（タイトル画面）。ロゴ + ステージ選択 + PLAY */
export default function TitleScreen({
  best,
  playerLevel,
  unlockedStages,
  stageId,
  onSelectStage,
  onPlay,
  onHelp,
}: Props) {
  const cover = STAGES[0].chars.slice(0, 5);

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-5 px-5 py-6">
      {/* 跳ねるカバーボール */}
      <div className="flex items-end gap-1">
        {cover.map((c, i) => (
          <div
            key={c.kana}
            className="flex flex-col items-center justify-center rounded-full border border-white/80 shadow-[0_10px_20px_rgba(160,130,190,0.25)]"
            style={{
              width: 44 + i * 4,
              height: 44 + i * 4,
              background:
                'radial-gradient(circle at 32% 26%, ' + shade(c.base, 0.6) + ', ' + c.base + ' 60%, ' + shade(c.base, -0.12) + ')',
              animation: 'kp-bounce 1.8s ease-in-out ' + i * 0.12 + 's infinite',
            }}
          >
            <span className="font-round text-lg font-bold leading-none text-[#5E4058]">{c.kana}</span>
            <span className="text-[9px] font-bold leading-none text-[#7A5B74]">{c.romaji}</span>
          </div>
        ))}
      </div>

      {/* ロゴ */}
      <div className="text-center">
        <h1 className="font-round text-5xl font-black tracking-tight text-[#F58FB0] drop-shadow-[0_4px_10px_rgba(245,143,176,0.35)]">
          Kana Pop
        </h1>
        <p className="mt-2 text-sm font-bold tracking-[0.18em] text-[#A98EBE]">MERGE &amp; LEARN JAPANESE</p>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-full border border-white/80 bg-gradient-to-b from-[#FFE1EC] to-[#FFC6DF] px-4 py-1.5 shadow-sm">
          <span className="text-[10px] font-black tracking-wider text-[#B4708C]">LV</span>
          <span className="font-round text-lg font-black leading-none text-[#6B4E68]">{playerLevel}</span>
        </div>
        {best > 0 && (
          <div className="flex items-center gap-2 rounded-full border border-white/70 bg-white/45 px-4 py-1.5 shadow-sm backdrop-blur-md">
            <span className="text-sm">👑</span>
            <span className="font-round text-base font-bold leading-none text-[#6B4E68]">{best}</span>
          </div>
        )}
      </div>

      {/* ステージ選択: 解放済みは代表文字、未解放は鍵 */}
      <div className="no-scrollbar flex w-full max-w-[420px] items-center gap-2 overflow-x-auto rounded-3xl border border-white/70 bg-white/35 px-3 py-2.5 backdrop-blur-md">
        {STAGES.map((s) => {
          const open = s.id <= unlockedStages;
          const active = s.id === stageId;
          const c = s.chars[0];
          return (
            <button
              key={s.id}
              disabled={!open}
              onClick={() => onSelectStage(s.id)}
              aria-label={'Stage ' + s.id}
              className={
                'flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-full border transition-all ' +
                (active ? 'scale-110 border-white ring-2 ring-[#F58FB0]/70 ' : 'border-white/70 ') +
                (open ? 'shadow-md active:scale-95' : 'opacity-40 saturate-0')
              }
              style={{
                background: open
                  ? 'radial-gradient(circle at 32% 26%, ' + shade(c.base, 0.55) + ', ' + c.base + ' 62%, ' + shade(c.base, -0.14) + ')'
                  : 'rgba(255,255,255,0.55)',
              }}
            >
              {open ? (
                <>
                  <span className="font-round text-base font-bold leading-none text-[#5E4058]">{s.cover}</span>
                  <span className="text-[8px] font-bold leading-none text-[#7A5B74]">{s.id}</span>
                </>
              ) : (
                <span className="text-base">🔒</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col items-center gap-3">
        <button
          onClick={onPlay}
          className="flex h-16 w-56 items-center justify-center gap-2 rounded-full border-2 border-white bg-gradient-to-b from-[#FFC6DF] to-[#F58FB0] text-white shadow-[0_12px_26px_rgba(245,143,176,0.45)] transition-transform active:scale-95"
        >
          <span className="text-2xl">▶</span>
          <span className="font-round text-2xl font-black tracking-wide">PLAY</span>
        </button>

        <button
          onClick={onHelp}
          className="flex items-center gap-2 rounded-full border border-white/80 bg-white/50 px-5 py-2 text-[#8A6E96] shadow-sm backdrop-blur-md active:scale-95"
        >
          <span className="text-base">❓</span>
          <span className="text-sm font-bold">How to play</span>
        </button>
      </div>

      <p className="absolute bottom-3 right-4 text-[10px] font-bold tracking-[0.1em] text-[#8A6E96]/80">CREATED BY SKY</p>

      <style>{'@keyframes kp-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}'}</style>
    </div>
  );
}
