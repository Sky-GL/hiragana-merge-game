import { useCallback, useEffect, useRef, useState } from 'react';
import EvolutionTree from './components/EvolutionTree';
import GameCanvas from './components/GameCanvas';
import HandHint from './components/HandHint';
import HowToPlay from './components/HowToPlay';
import LevelBar from './components/LevelBar';
import LevelUpToast from './components/LevelUpToast';
import ResultOverlay from './components/ResultOverlay';
import StageClearToast from './components/StageClearToast';
import TitleScreen from './components/TitleScreen';
import { clearBest, clearSavedSession, loadBest, loadSavedStage, type KanaGame } from './game/engine';
import {
  addExp,
  clearProgress,
  loadProgress,
  newlyUnlockedKind,
  recordStageCompletion,
  unlockNextStage,
  type Progress,
} from './game/progress';
import { getStage, shade, STAGE_COUNT, type Stage } from './game/stages';
import { initSpeech, speakKana, unlockSpeech } from './game/speech';
import { unlockSfx } from './game/sfx';
import { preloadClips } from './game/voiceClips';

const SEEN_KEY = 'kanapop.seenHelp';
type ClearToast = { stage: Stage; title: string; subtitle?: string };

function hasSeenHelp() {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function markHelpSeen() {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* 保存できなくても動作に影響させない */
  }
}

export default function App() {
  const gameRef = useRef<KanaGame | null>(null);
  const [phase, setPhase] = useState<'title' | 'play'>('title');
  const [help, setHelp] = useState(false);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [nextLevel, setNextLevel] = useState(0);
  const [unlocked, setUnlocked] = useState(0);
  const [showHint, setShowHint] = useState(true);
  const [finished, setFinished] = useState(false);
  const [progress, setProgress] = useState<Progress>({ stageLayoutVersion: 5, level: 1, exp: 0, unlockedStages: 1, stageCompletions: {} });
  const [stageId, setStageId] = useState(1);
  const [toast, setToast] = useState<{ level: number; kind: number | null } | null>(null);
  const [clearToast, setClearToast] = useState<ClearToast | null>(null);
  const [tiltEnabled, setTiltEnabled] = useState(false);

  const stage = getStage(stageId);

  // コールバックから常に最新値を読むための控え
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const stageIdRef = useRef(stageId);
  stageIdRef.current = stageId;
  const toastTimer = useRef<number | null>(null);
  const clearTimer = useRef<number | null>(null);
  const stageAdvanceTimer = useRef<number | null>(null);
  const stageClearPending = useRef(false);

  useEffect(() => {
    initSpeech();
    setBest(loadBest());
    const p = loadProgress();
    setProgress(p);
    const savedStage = loadSavedStage();
    if (savedStage !== null && savedStage >= 1 && savedStage <= STAGE_COUNT) {
      setStageId(savedStage);
      setPhase('play');
    } else {
      setStageId(p.unlockedStages); // 最後に解放されたステージから始める
      setPhase('play');
    }
    return () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
      if (clearTimer.current !== null) window.clearTimeout(clearTimer.current);
      if (stageAdvanceTimer.current !== null) window.clearTimeout(stageAdvanceTimer.current);
    };
  }, []);

  const handleFinish = useCallback((s: number, b: number) => {
    setScore(s);
    setBest(b);
    setFinished(true);
  }, []);

  const handleExp = useCallback((gain: number) => {
    const before = progressRef.current;
    const { next, levelsGained } = addExp(before, gain);
    progressRef.current = next;
    setProgress(next);
    if (levelsGained > 0) {
      gameRef.current?.setPlayerLevel(next.level);
      setToast({ level: next.level, kind: newlyUnlockedKind(before.level, next.level) });
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
      toastTimer.current = window.setTimeout(() => setToast(null), 2200);
    }
  }, []);

  /** 1周目はチャレンジを開始し、宝石つき最終文字2個で次行を解放する。 */
  const handleStageClear = useCallback((clearedByFinalPair: boolean) => {
    if (stageClearPending.current) return;
    const p = progressRef.current;
    const current = stageIdRef.current;
    if (current < p.unlockedStages) return; // 解放済み行の遊び直しでは進行しない

    stageClearPending.current = true;
    if (clearTimer.current !== null) window.clearTimeout(clearTimer.current);
    if (!clearedByFinalPair) {
      if ((p.stageCompletions[current] ?? 0) > 0) {
        stageClearPending.current = false;
        return;
      }
      const { next: challengeProgress } = recordStageCompletion(p, current);
      progressRef.current = challengeProgress;
      setProgress(challengeProgress);
      const finalKana = getStage(current).chars.slice(-1)[0].kana;
      setClearToast({
        stage: getStage(current),
        title: 'CHALLENGE START!',
        subtitle: 'BUILD 16 ' + finalKana + ' TO CLEAR',
      });
      clearTimer.current = window.setTimeout(() => setClearToast(null), 3000);
      gameRef.current?.setChallengeMode(true, progressRef.current.level);
      gameRef.current?.setFinalMergeMode('pair');
      stageClearPending.current = false;
      return;
    }

    if ((p.stageCompletions[current] ?? 0) === 0) {
      stageClearPending.current = false;
      return;
    }

    if (current < STAGE_COUNT) {
      const unlockedProgress = unlockNextStage(p, STAGE_COUNT);
      progressRef.current = unlockedProgress;
      setProgress(unlockedProgress);
      const nextStageId = unlockedProgress.unlockedStages;
      const nextStage = getStage(nextStageId);
      setClearToast({ stage: nextStage, title: nextStage.label + ' UNLOCKED' });
      gameRef.current?.prepareStageAdvance();
      stageAdvanceTimer.current = window.setTimeout(() => {
        stageIdRef.current = nextStageId;
        setStageId(nextStageId);
        setUnlocked(0);
        setFinished(false);
        // 指の案内は最初のあ行だけ。以降の行では盤面を隠さない。
        setShowHint(false);
        preloadClips(nextStage.chars.map((char) => char.romaji));
        gameRef.current?.setStage(nextStageId);
        gameRef.current?.setChallengeMode(false, progressRef.current.level);
        stageAdvanceTimer.current = null;
        stageClearPending.current = false;
      }, 650);
    } else {
      setClearToast({ stage: getStage(current), title: 'ALL ROWS COMPLETE!' });
      stageClearPending.current = false;
    }
    clearTimer.current = window.setTimeout(() => setClearToast(null), 3000);
  }, []);

  const handleChallengeBonus = useCallback((points: number) => {
    const current = stageIdRef.current;
    const finalKana = getStage(current).chars.slice(-1)[0].kana;
    setClearToast({
      stage: getStage(current),
      title: 'RAINBOW BONUS!',
      subtitle: '+' + points + ' • 8 ' + finalKana + ' REACHED',
    });
    if (clearTimer.current !== null) window.clearTimeout(clearTimer.current);
    clearTimer.current = window.setTimeout(() => setClearToast(null), 2200);
  }, []);

  const startGame = () => {
    unlockSpeech(); // 表紙のタップを音声解錠に使う
    unlockSfx();
    preloadClips(getStage(stageId).chars.map((c) => c.romaji)); // このステージの音声だけ読む
    if (!hasSeenHelp()) setHelp(true); // 初回だけ遊び方を自動表示
    setUnlocked(0);
    setScore(0);
    setPhase('play');
  };

  const resetAllProgress = () => {
    if (!window.confirm('すべての学習進行とBESTをリセットしますか？')) return;
    clearProgress();
    clearSavedSession();
    clearBest();
    const fresh: Progress = { stageLayoutVersion: 5, level: 1, exp: 0, unlockedStages: 1, stageCompletions: {} };
    progressRef.current = fresh;
    setProgress(fresh);
    stageIdRef.current = 1;
    setStageId(1);
    setScore(0);
    setBest(0);
    setUnlocked(0);
    setFinished(false);
    setShowHint(true);
    setClearToast(null);
    setPhase('play');
  };

  const closeHelp = () => {
    markHelpSeen();
    setHelp(false);
  };

  const resetGame = () => {
    unlockSpeech();
    unlockSfx();
    setFinished(false);
    setScore(0);
    setUnlocked(0);
    setClearToast(null);
    if (clearTimer.current !== null) {
      window.clearTimeout(clearTimer.current);
      clearTimer.current = null;
    }
    if (stageAdvanceTimer.current !== null) {
      window.clearTimeout(stageAdvanceTimer.current);
      stageAdvanceTimer.current = null;
    }
    stageClearPending.current = false;
    gameRef.current?.restart();
  };

  const retry = resetGame;

  const goHome = () => {
    setFinished(false);
    setScore(0);
    setShowHint(true);
    setTiltEnabled(false);
    setClearToast(null);
    if (clearTimer.current !== null) {
      window.clearTimeout(clearTimer.current);
      clearTimer.current = null;
    }
    if (stageAdvanceTimer.current !== null) {
      window.clearTimeout(stageAdvanceTimer.current);
      stageAdvanceTimer.current = null;
    }
    stageClearPending.current = false;
    gameRef.current?.restart();
    setPhase('title');
  };

  if (phase === 'title') {
    return (
      <div className="relative h-full w-full">
        <TitleScreen
          best={best}
          playerLevel={progress.level}
          unlockedStages={progress.unlockedStages}
          stageId={stageId}
          onSelectStage={setStageId}
          onPlay={startGame}
          onHelp={() => setHelp(true)}
          onResetAll={resetAllProgress}
        />
        <HowToPlay visible={help} onClose={closeHelp} />
      </div>
    );
  }

  const nextChar = stage.chars[Math.min(nextLevel, stage.chars.length - 1)];

  return (
    <div className="relative flex h-full w-full flex-col items-center gap-2 px-3 pb-3 pt-3">
      {/* 進化ツリー（常時表示） */}
      <div className="w-full max-w-[460px]">
        <EvolutionTree chars={stage.chars} unlocked={unlocked} nextLevel={nextLevel} />
      </div>

      {/* レベル + 経験値バー */}
      <div className="w-full max-w-[460px] px-1">
        <LevelBar level={progress.level} exp={progress.exp} />
      </div>

      {/* スコア: 数字とピクトグラムのみ */}
      <div className="flex w-full max-w-[460px] items-center justify-between px-1">
        <div className="flex items-center gap-2 rounded-full border border-white/70 bg-white/45 px-4 py-1.5 shadow-sm backdrop-blur-md">
          <span className="text-base">⭐</span>
          <span className="font-round text-xl font-black leading-none text-[#6B4E68]">{score}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-2 rounded-full border border-white/70 bg-white/45 px-4 py-1.5 shadow-sm backdrop-blur-md">
            <span className="text-sm">👑</span>
            <span className="font-round text-sm font-bold leading-none text-[#A98EBE]">{best}</span>
          </div>
          <button
            onClick={goHome}
            aria-label="Return to home"
            className="rounded-full border border-white/70 bg-white/45 px-3 py-1.5 text-xs font-black text-[#6B4E68] shadow-sm backdrop-blur-md active:scale-95"
          >
            HOME
          </button>
          <button
            onClick={resetGame}
            aria-label="Reset current game"
            title="RESET"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-white/45 text-lg font-black text-[#6B4E68] shadow-sm backdrop-blur-md active:scale-95"
          >
            ↻
          </button>
          <button
            onClick={() => setHelp(true)}
            aria-label="How to play"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-white/45 text-sm shadow-sm backdrop-blur-md active:scale-95"
          >
            ❓
          </button>
          <button
            onClick={async () => {
              if (tiltEnabled) {
                gameRef.current?.disableTilt();
                setTiltEnabled(false);
                return;
              }
              unlockSfx();
              setTiltEnabled(await gameRef.current?.enableTilt() ?? false);
            }}
            aria-label={tiltEnabled ? 'Disable tilt controls' : 'Enable tilt controls'}
            title={tiltEnabled ? 'Tilt: ON' : 'Tilt: OFF'}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-white/45 text-[11px] font-black text-[#6B4E68] shadow-sm backdrop-blur-md active:scale-95"
          >
            {tiltEnabled ? '📱✓' : '📱×'}
          </button>
        </div>
      </div>

      {/* フィールド */}
      <div className="relative flex min-h-0 w-full max-w-[460px] flex-1 items-center justify-center">
        <div className="relative flex h-full items-center justify-center">
          <GameCanvas
            onReady={(g) => {
              gameRef.current = g;
              g.setStage(stageIdRef.current, true);
              g.setPlayerLevel(progressRef.current.level);
              const completedRounds = progressRef.current.stageCompletions[stageIdRef.current] ?? 0;
              g.setChallengeMode(completedRounds > 0, progressRef.current.level);
              g.setFinalMergeMode(completedRounds > 0 ? 'pair' : 'pop');
              g.restoreSession();
            }}
            callbacks={{
              onScore: setScore,
              onNext: setNextLevel,
              onFinish: handleFinish,
              onFirstInteract: () => setShowHint(false),
              onUnlockLevel: (l) => setUnlocked((u) => Math.max(u, l)),
              onExp: handleExp,
              onChallengeBonus: handleChallengeBonus,
              onStageClear: handleStageClear,
            }}
          />
          <HandHint visible={showHint && !finished && !help} />
        </div>
        <LevelUpToast
          level={toast?.level ?? null}
          unlockedChar={toast?.kind != null ? stage.chars[toast.kind] ?? null : null}
        />
        <StageClearToast stage={clearToast?.stage ?? null} title={clearToast?.title ?? ''} subtitle={clearToast?.subtitle} />
        <ResultOverlay
          visible={finished}
          chars={stage.chars}
          score={score}
          best={best}
          unlocked={unlocked}
          onRetry={retry}
          onHome={goHome}
        />
      </div>

      {/* 発音リプレイ: いま持っている文字をタップで聞き直せる */}
      <button
        onClick={() => {
          unlockSpeech();
          unlockSfx();
          preloadClips(stage.chars.map((char) => char.romaji));
          speakKana(nextChar.kana, { romaji: nextChar.romaji });
        }}
        aria-label="Listen"
        className="flex items-center gap-2 rounded-full border border-white/80 px-4 py-1.5 shadow-md active:scale-95"
        style={{
          background:
            'radial-gradient(circle at 30% 25%, ' + shade(nextChar.base, 0.5) + ', ' + nextChar.base + ' 70%)',
        }}
      >
        <span className="text-lg">🔊</span>
        <span className="font-round text-lg font-bold leading-none text-[#5E4058]">{nextChar.kana}</span>
        <span className="text-xs font-bold text-[#7A5B74]">{nextChar.romaji}</span>
      </button>

      <HowToPlay visible={help} onClose={closeHelp} />
    </div>
  );
}
