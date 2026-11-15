import { STAGES, shade } from '../game/stages';
import type { PopMode } from '../game/popStore';

type Props = {
  best: number;
  playerLevel: number;
  mode: PopMode;
  /** クリア済みのステージ(★を付ける) */
  cleared: (stageId: number) => boolean;
  stageId: number;
  onMode: (mode: PopMode) => void;
  onSelectStage: (id: number) => void;
  onPlay: () => void;
  onHelp: () => void;
  onResetAll: () => void;
};

/** 表紙（タイトル画面）。ロゴ + モード切替 + PLAY + ステージ一覧(4列)。PLAYはスクロールなしで押せる位置に置く */
export default function TitleScreen({
  best,
  playerLevel,
  mode,
  cleared,
  stageId,
  onMode,
  onSelectStage,
  onPlay,
  onHelp,
  onResetAll,
}: Props) {
  const cover = STAGES[0].chars.slice(0, 5);
  const stage = STAGES[Math.max(0, Math.min(STAGES.length - 1, stageId - 1))];

  return (
    <div
      data-testid="title"
      className="relative flex h-full w-full flex-col items-center gap-3 overflow-y-auto px-5 pb-8 pt-5"
      style={{ touchAction: 'pan-y' }}
    >
      {/* 跳ねるカバーボール */}
      <div className="flex shrink-0 items-end gap-1">
        {cover.map((c, i) => (
          <div
            key={c.kana}
            className="flex flex-col items-center justify-center rounded-full border border-white/80 shadow-[0_10px_20px_rgba(160,130,190,0.25)]"
            style={{
              width: 40 + i * 3,
              height: 40 + i * 3,
              background:
                'radial-gradient(circle at 32% 26%, ' + shade(c.base, 0.6) + ', ' + c.base + ' 60%, ' + shade(c.base, -0.12) + ')',
              animation: 'kp-bounce 1.8s ease-in-out ' + i * 0.12 + 's infinite',
            }}
          >
            <span className="font-round text-base font-bold leading-none text-[#5E4058]">{c.kana}</span>
            <span className="text-[9px] font-bold leading-none text-[#7A5B74]">{c.romaji}</span>
          </div>
        ))}
      </div>

      {/* ロゴ */}
      <div className="shrink-0 text-center">
        <h1 className="font-round text-5xl font-black tracking-tight text-[#F58FB0] drop-shadow-[0_4px_10px_rgba(245,143,176,0.35)]">
          Kana Pop
        </h1>
        <p className="mt-1 text-sm font-bold tracking-[0.18em] text-[#A98EBE]">MERGE &amp; LEARN JAPANESE</p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
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
        <button
          onClick={onHelp}
          aria-label="How to play"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/80 bg-white/50 text-base text-[#8A6E96] shadow-sm backdrop-blur-md active:scale-95"
        >
          ❓
        </button>
      </div>

      {/* モード切替: 📖 読みモード(既定) / 🫧 ふつう */}
      <div className="grid w-full max-w-[420px] shrink-0 grid-cols-2 gap-2">
        {(
          [
            ['read', '📖', 'READ', 'あ + a'],
            ['normal', '🫧', 'CLASSIC', 'あ + あ'],
          ] as const
        ).map(([m, icon, name, sample]) => (
          <button
            key={m}
            data-testid={'mode-' + m}
            onClick={() => onMode(m)}
            aria-pressed={mode === m}
            className={
              'flex flex-col items-center rounded-3xl border px-3 py-2 backdrop-blur-md transition-all active:scale-95 ' +
              (mode === m ? 'border-white bg-white/80 shadow-md ring-2 ring-[#F58FB0]/70' : 'border-white/70 bg-white/35')
            }
          >
            <span className="text-lg leading-none">{icon}</span>
            <span className="mt-0.5 text-[11px] font-black tracking-[0.14em] text-[#B4708C]">{name}</span>
            <span className="font-round text-sm font-bold text-[#6B4E68]">{sample}</span>
          </button>
        ))}
      </div>

      {/* PLAY: 選択中のステージの文字を添える */}
      <button
        data-testid="play"
        onClick={onPlay}
        className="flex w-full max-w-[420px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-full border-2 border-white bg-gradient-to-b from-[#FFC6DF] to-[#F58FB0] py-3 text-white shadow-[0_12px_26px_rgba(245,143,176,0.45)] transition-transform active:scale-95"
      >
        <span className="flex items-center gap-2">
          <span className="text-2xl">▶</span>
          <span className="font-round text-2xl font-black tracking-wide">PLAY</span>
        </span>
        <span className="font-round text-xs font-black tracking-[0.12em]">
          STAGE {stage.id} · {stage.label} <span className="ml-1 tracking-[0.18em]">{stage.chars.map((c) => c.kana).join(' ')}</span>
        </span>
      </button>

      {/* ステージ選択: 4列。選べるのは自由(ロックなし) */}
      <div className="grid w-full max-w-[420px] shrink-0 grid-cols-4 gap-x-2 gap-y-2.5 rounded-3xl border border-white/70 bg-white/35 px-3 py-3 backdrop-blur-md">
        {STAGES.map((s) => {
          const active = s.id === stageId;
          const c = s.chars[0];
          return (
            <button
              key={s.id}
              data-testid={'stage-' + s.id}
              onClick={() => onSelectStage(s.id)}
              aria-label={'Stage ' + s.id}
              className="flex flex-col items-center gap-0.5 active:scale-95"
            >
              <span
                className={
                  'relative flex h-12 w-12 flex-col items-center justify-center rounded-full border shadow-md transition-all ' +
                  (active ? 'scale-110 border-white ring-2 ring-[#F58FB0]/70' : 'border-white/70')
                }
                style={{
                  background: 'radial-gradient(circle at 32% 26%, ' + shade(c.base, 0.55) + ', ' + c.base + ' 62%, ' + shade(c.base, -0.14) + ')',
                }}
              >
                <span className="font-round font-bold leading-none text-[#5E4058]" style={{ fontSize: s.cover.length > 1 ? 13 : 17 }}>
                  {s.cover}
                </span>
                {cleared(s.id) && <span className="absolute -right-1 -top-1 text-sm drop-shadow">⭐</span>}
              </span>
              <span className="text-[9px] font-black tracking-wider text-[#A98EBE]">{s.id}</span>
            </button>
          );
        })}
      </div>

      <button
        onClick={onResetAll}
        className="shrink-0 text-[11px] font-black tracking-[0.12em] text-[#A98EBE] underline decoration-[#A98EBE]/40 underline-offset-4 active:opacity-60"
      >
        RESET ALL PROGRESS
      </button>

      <p className="shrink-0 text-[10px] font-bold tracking-[0.1em] text-[#8A6E96]/80">CREATED BY SKY</p>

      <style>{'@keyframes kp-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}'}</style>
    </div>
  );
}
