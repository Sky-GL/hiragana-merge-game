import { useCallback, useEffect, useRef, useState } from 'react';
import EvolutionTree from './components/EvolutionTree';
import HandHint from './components/HandHint';
import HowToPlay from './components/HowToPlay';
import LevelBar from './components/LevelBar';
import LevelUpToast from './components/LevelUpToast';
import { ComboPill, Confetti, MissToast } from './components/PopExtras';
import ResultOverlay from './components/ResultOverlay';
import StageClearToast from './components/StageClearToast';
import TitleScreen from './components/TitleScreen';
import { PopEngine, type NextMedal } from './game/engine';
import { FINAL_TIERS } from './game/popFinal';
import {
  addExp, emptyPop, loadPop, markCleared, recordBest, recordCombo, recordKey, savePop,
  type PopMode, type PopSave,
} from './game/popStore';
import { unlockSfx } from './game/sfx';
import { speakChar } from './game/speech';
import { STAGE_COUNT, getStage, shade, type Stage } from './game/stages';
import { preloadClips } from './game/voiceClips';

const SEEN_KEY = 'kanapop.seenHelp';

type Toast =
  | { kind: 'level'; level: number }
  | { kind: 'miss'; title: string; sub: string }
  | { kind: 'clear'; stage: Stage; title: string; subtitle?: string; icon: string };
type Over = { score: number; grand: boolean; maxCombo: number; misses: number; newCombo: boolean };

const hasSeenHelp = () => {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
};

const markHelpSeen = () => {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* 保存できなくても動作に影響させない */
  }
};

const ROUND_BTN =
  'flex h-10 items-center justify-center rounded-full border border-white/70 bg-white/45 text-[#6B4E68] shadow-sm backdrop-blur-md active:scale-95';

export default function App() {
  const [save, setSave] = useState<PopSave>(loadPop);
  const saveRef = useRef(save);
  const [stageId, setStageId] = useState(1);
  const [phase, setPhase] = useState<'title' | 'play'>('title');
  const [help, setHelp] = useState(false);
  const [score, setScore] = useState(0);
  const [next, setNext] = useState<NextMedal>({ level: 0, face: 0 }); // 次に降るメダル
  const [combo, setCombo] = useState({ n: 0, mult: 1 });
  const [confetti, setConfetti] = useState(0); // ステージクリアの紙吹雪(表示するたびに値を変えて再生成)
  const [tier, setTier] = useState(0); // このステージで最終形が育った最高の段階(0=最終形/1=👑/2=💎/3=🌈)
  const [unlocked, setUnlocked] = useState(0); // このプレイで到達した最大レベル
  const [over, setOver] = useState<Over | null>(null);
  const [hint, setHint] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);
  const [paused, setPaused] = useState(false);
  const [tiltOn, setTiltOn] = useState(false);

  const engineRef = useRef<PopEngine | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const toastTimer = useRef<number | null>(null);
  const advanceTimer = useRef<number | null>(null);
  const stage = getStage(stageId);
  const mode = save.mode;
  const nextLevel = next.level;

  const commit = useCallback((n: PopSave) => {
    saveRef.current = n;
    setSave(n);
    savePop(n);
  }, []);

  const showToast = useCallback((t: Toast, ms: number) => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    setToast(t);
    toastTimer.current = window.setTimeout(() => setToast(null), ms);
  }, []);

  const resetRound = useCallback(() => {
    setScore(0);
    setUnlocked(0);
    setTier(0);
    setCombo({ n: 0, mult: 1 });
    setConfetti(0);
    setOver(null);
    setToast(null);
    setPaused(false);
    setTiltOn(false);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
      if (advanceTimer.current !== null) window.clearTimeout(advanceTimer.current);
    },
    [],
  );

  // プレイ画面に入ったらエンジンを起動、離れたら破棄
  useEffect(() => {
    if (phase !== 'play' || !canvasRef.current) return undefined;
    const gameMode = saveRef.current.mode;
    const key = recordKey(gameMode, stageId);
    preloadClips(stage.chars.map((c) => c.clip));
    const engine = new PopEngine(stage, {
      onScore: setScore,
      onNext: setNext,
      onFirstInteract: () => setHint(false),
      onUnlock: (lv) => setUnlocked((u) => Math.max(u, lv)),
      onCombo: (n, mult) => setCombo({ n, mult }),
      // 読み間違い: コンボが途切れるだけ(罰は軽く)。間違えやすい2文字の読みを並べて教える
      onMiss: ({ hadCombo, dropped, other }) => {
        const a = stage.chars[dropped.level];
        const b = stage.chars[other.level];
        showToast(
          {
            kind: 'miss',
            title: hadCombo >= 3 ? '💭 COMBO ' + hadCombo + ' ENDED' : '💭 NOT QUITE',
            sub: `${a.kana} = ${a.romaji}  ／  ${b.kana} = ${b.romaji}`,
          },
          2000,
        );
      },
      onMerge: (lv) => {
        const { next: n, gained } = addExp(saveRef.current, lv + 1);
        commit(n);
        if (gained > 0) showToast({ kind: 'level', level: n.level }, 2200);
      },
      // 最終形が 👑/💎/🌈 に進化した
      onTier: (t, points) => {
        setTier((cur) => Math.max(cur, t));
        const info = FINAL_TIERS[t];
        const final = stage.chars[stage.chars.length - 1];
        showToast(
          {
            kind: 'clear',
            stage,
            icon: info.icon,
            title: `${final.kana} ×${info.badge}`,
            subtitle: t === 3 ? `RAINBOW BONUS! +300 (+${points})` : `+${points}`,
          },
          2200,
        );
      },
      // 🌈+🌈 が合体してステージクリア。次のステージがあれば自動で進む
      onStageClear: () => {
        setConfetti(Date.now());
        commit(markCleared(saveRef.current, key));
        if (stageId < STAGE_COUNT) {
          const nextStage = getStage(stageId + 1);
          showToast({ kind: 'clear', stage: nextStage, icon: '🎉', title: 'STAGE ' + stageId + ' CLEAR!', subtitle: 'NEXT · ' + nextStage.label }, 1800);
          advanceTimer.current = window.setTimeout(() => {
            resetRound();
            setStageId(stageId + 1);
          }, 1500);
        } else {
          showToast({ kind: 'clear', stage, icon: '🏆', title: 'ALL CLEAR!', subtitle: 'ALL STAGES CLEARED' }, 2500);
          advanceTimer.current = window.setTimeout(() => engine.finish(true), 1200);
        }
      },
      onFinish: (s, grand, stats) => {
        const withBest = recordBest(saveRef.current, key, s);
        const { next: n, isNew } = recordCombo(withBest, key, stats.maxCombo);
        commit(n);
        setOver({ score: s, grand, maxCombo: stats.maxCombo, misses: stats.misses, newCombo: isNew });
      },
    }, gameMode);
    engine.mount(canvasRef.current);
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [phase, stageId, stage, commit, showToast, resetRound]);

  const play = () => {
    unlockSfx();
    resetRound();
    setHint(true);
    if (!hasSeenHelp()) setHelp(true); // 初回だけ遊び方を自動表示
    setPhase('play');
  };

  const retry = () => {
    if (advanceTimer.current !== null) window.clearTimeout(advanceTimer.current);
    unlockSfx();
    resetRound();
    engineRef.current?.restart();
  };

  const goHome = () => {
    if (advanceTimer.current !== null) window.clearTimeout(advanceTimer.current);
    resetRound();
    setPhase('title');
  };

  const closeHelp = () => {
    markHelpSeen();
    setHelp(false);
  };

  const listen = () => {
    unlockSfx();
    preloadClips(stage.chars.map((c) => c.clip));
    speakChar(stage.chars[Math.min(nextLevel, stage.chars.length - 1)]);
  };

  const togglePause = () => {
    if (over) return;
    if (paused) engineRef.current?.resume();
    else engineRef.current?.pause();
    setPaused(!paused);
  };

  const toggleTilt = async () => {
    const engine = engineRef.current;
    if (!engine) return;
    if (tiltOn) {
      engine.disableTilt();
      setTiltOn(false);
      return;
    }
    unlockSfx();
    const ok = await engine.enableTilt();
    if (engineRef.current === engine) setTiltOn(ok);
    else engine.disableTilt();
  };

  const setMode = (m: PopMode) => commit({ ...saveRef.current, mode: m });

  const resetAllProgress = () => {
    if (!window.confirm('すべての学習進行とBESTをリセットしますか？')) return;
    commit(emptyPop(saveRef.current.mode));
    setStageId(1);
  };

  const bestNow = save.best[recordKey(mode, stageId)] || 0;

  // ---------- タイトル(ステージ選択) ----------
  if (phase === 'title') {
    return (
      <div className="relative h-full w-full">
        <TitleScreen
          best={bestNow}
          playerLevel={save.level}
          mode={mode}
          cleared={(id) => !!save.cleared[recordKey(mode, id)]}
          stageId={stageId}
          onMode={setMode}
          onSelectStage={setStageId}
          onPlay={play}
          onHelp={() => setHelp(true)}
          onResetAll={resetAllProgress}
        />
        <HowToPlay visible={help} onClose={closeHelp} />
      </div>
    );
  }

  // ---------- プレイ ----------
  const nextChar = stage.chars[Math.min(nextLevel, stage.chars.length - 1)];

  return (
    <div className="relative h-full w-full">
      <div className="flex h-full w-full flex-col items-center gap-2 overflow-y-auto px-3 pb-3 pt-3" style={{ touchAction: 'pan-y' }}>
        {/* 操作ボタン */}
        <div className="flex w-full max-w-[460px] shrink-0 items-center justify-between px-0.5">
          <button data-testid="home" onClick={goHome} aria-label="Return to home" className={ROUND_BTN + ' px-3 text-[15px] font-black'}>
            HOME
          </button>
          <div className="flex items-center gap-1">
            <button data-testid="pause" onClick={togglePause} aria-label={paused ? 'Resume game' : 'Pause game'} className={ROUND_BTN + ' w-10 text-lg font-black'}>
              {paused ? '▶' : 'Ⅱ'}
            </button>
            <button data-testid="retry" onClick={retry} aria-label="Reset current game" className={ROUND_BTN + ' w-10 text-xl font-black'}>
              ↻
            </button>
            <button onClick={toggleTilt} aria-label={tiltOn ? 'Disable tilt controls' : 'Enable tilt controls'} className={ROUND_BTN + ' w-10 text-[15px] font-black'}>
              {tiltOn ? '📱✓' : '📱×'}
            </button>
            <button onClick={() => setHelp(true)} aria-label="How to play" className={ROUND_BTN + ' w-10 text-base'}>
              ❓
            </button>
          </div>
        </div>

        {/* 進化ツリー（常時表示。5文字すべての読みと 👑💎🌈 の凡例つき） */}
        <div className="w-full max-w-[460px] shrink-0">
          <EvolutionTree chars={stage.chars} unlocked={unlocked} nextLevel={nextLevel} tier={tier} />
        </div>

        {/* Lv・経験値・スコア・ベスト（数字とバーだけの非言語UI） */}
        <div className="flex w-full max-w-[460px] shrink-0 items-center gap-2 px-1">
          <div className="min-w-0 flex-1">
            <LevelBar level={save.level} exp={save.exp} />
          </div>
          <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/70 bg-white/45 px-3 py-0.5 shadow-sm backdrop-blur-md">
            <span className="text-lg">⭐</span>
            <span data-testid="score" className="font-round text-2xl font-black leading-none text-[#6B4E68]">{score}</span>
          </div>
          <div className="flex h-7 shrink-0 items-center gap-1 rounded-full border border-white/70 bg-white/45 px-2 text-[#6B4E68] shadow-sm backdrop-blur-md" title="BEST SCORE">
            <span className="text-lg">👑</span>
            <span className="font-round text-base font-black leading-none">{bestNow}</span>
          </div>
        </div>

        {/* コンボは盤面の外に出す(盤面の中に置くと、上部を左右に動く「次のメダル」を隠すため)。高さは固定してレイアウトを揺らさない */}
        <div data-testid="combo-row" className="flex h-9 shrink-0 items-center justify-center">
          {combo.n >= 2 && !over ? (
            <ComboPill n={combo.n} mult={combo.mult} />
          ) : (
            <span className="text-[16px] font-black tracking-[0.2em] text-[#B49FC7]/70">🔥 COMBO</span>
          )}
        </div>

        {/* フィールド */}
        <div
          data-testid="field"
          className="relative flex w-full max-w-[460px] shrink-0 items-center justify-center"
          style={{ height: 'min(clamp(380px, calc(100dvh - 345px), 700px), calc((min(100vw, 460px) - 24px) * 660 / 420))' }}
        >
          <div className="relative flex h-full items-center justify-center">
            <canvas
              data-testid="canvas"
              ref={canvasRef}
              className="h-full w-auto max-w-full rounded-[30px]"
              style={{ aspectRatio: '420 / 660' }}
            />
            <HandHint visible={hint && !over && !help} />
          </div>
          {paused && !over && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center rounded-[30px] bg-[#6B4E68]/35 backdrop-blur-sm">
              <p className="font-round text-3xl font-black tracking-[0.12em] text-white drop-shadow">PAUSED</p>
              <button
                onClick={togglePause}
                className="mt-4 rounded-full border-2 border-white bg-gradient-to-b from-[#FFC6DF] to-[#F58FB0] px-8 py-3 font-round text-2xl font-black text-white shadow-lg active:scale-95"
              >
                ▶ RESUME
              </button>
            </div>
          )}
          {confetti > 0 && <Confetti key={confetti} />}
          <LevelUpToast level={toast?.kind === 'level' ? toast.level : null} unlockedChar={null} />
          {toast?.kind === 'miss' && <MissToast title={toast.title} sub={toast.sub} />}
          <StageClearToast
            stage={toast?.kind === 'clear' ? toast.stage : null}
            title={toast?.kind === 'clear' ? toast.title : ''}
            subtitle={toast?.kind === 'clear' ? toast.subtitle : undefined}
            icon={toast?.kind === 'clear' ? toast.icon : undefined}
          />
          <ResultOverlay
            visible={!!over}
            grandFinale={!!over?.grand}
            chars={stage.chars}
            score={over?.score ?? 0}
            best={Math.max(bestNow, over?.score ?? 0)}
            unlocked={unlocked}
            maxCombo={over?.maxCombo ?? 0}
            newCombo={!!over?.newCombo}
            misses={over?.misses ?? 0}
            showMisses={mode === 'read'}
            onRetry={retry}
            onHome={goHome}
          />
        </div>

        {/* 発音: 読みモードでは文字・ローマ字を出さない(答えになるため)。聞きたいときだけ発音を鳴らす */}
        <button
          data-testid="listen"
          onClick={listen}
          aria-label="Listen"
          className="flex shrink-0 items-center gap-2 rounded-full border border-white/80 px-4 py-1.5 shadow-md active:scale-95"
          style={{
            background:
              mode === 'read'
                ? 'linear-gradient(180deg, #FFFFFF, #F3E9FA)'
                : 'radial-gradient(circle at 30% 25%, ' + shade(nextChar.base, 0.5) + ', ' + nextChar.base + ' 70%)',
          }}
        >
          <span className="text-2xl">🔊</span>
          {mode === 'read' ? (
            <span className="font-round text-lg font-black tracking-wide text-[#7A5B74]">次のメダルの発音を聞く</span>
          ) : (
            <>
              <span className="font-round text-2xl font-bold leading-none text-[#5E4058]">{nextChar.kana}</span>
              <span className="text-base font-bold text-[#7A5B74]">{nextChar.romaji}</span>
            </>
          )}
        </button>
      </div>
      <HowToPlay visible={help} onClose={closeHelp} />
    </div>
  );
}
