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
import { loadBest, loadSavedStage, type KanaGame } from './game/engine';
import {
  addExp,
  loadProgress,
  newlyUnlockedKind,
  unlockNextStage,
  type Progress,
} from './game/progress';
import { getStage, shade, STAGE_COUNT, STAGES } from './game/stages';
import { initSpeech, speakKana, unlockSpeech } from './game/speech';
import { unlockSfx } from './game/sfx';
import { preloadClips } from './game/voiceClips';

const SEEN_KEY = 'kanapop.seenHelp';

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
  const [progress, setProgress] = useState<Progress>({ stageLayoutVersion: 2, level: 1, exp: 0, unlockedStages: 1 });
  const [stageId, setStageId] = useState(1);
  const [toast, setToast] = useState<{ level: number; kind: number | null } | null>(null);
  const [clearToast, setClearToast] = useState<number | null>(null);
  const [tiltEnabled, setTiltEnabled] = useState(false);

  const stage = getStage(stageId);

  // コールバックから常に最新値を読むための控え
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const stageIdRef = useRef(stageId);
  stageIdRef.current = stageId;
  const toastTimer = useRef<number | null>(null);
  const clearTimer = useRef<number | null>(null);

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
    }
    return () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
      if (clearTimer.current !== null) window.clearTimeout(clearTimer.current);
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

  /** 最終文字まで育てたら次のステージを解放（ゲームはそのまま続けられる） */
  const handleStageClear = useCallback(() => {
    const p = progressRef.current;
    const current = stageIdRef.current;
    if (current < p.unlockedStages || p.unlockedStages >= STAGE_COUNT) return; // 解放済みなら何もしない
    const next = unlockNextStage(p, STAGE_COUNT);
    progressRef.current = next;
    setProgress(next);
    setClearToast(next.unlockedStages);
    if (clearTimer.current !== null) window.clearTimeout(clearTimer.current);
    clearTimer.current = window.setTimeout(() => setClearToast(null), 3000);
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

  const closeHelp = () => {
    markHelpSeen();
    setHelp(false);
  };

  const retry = () => {
    unlockSpeech();
    unlockSfx();
    setFinished(false);
    setScore(0);
    setUnlocked(0);
    gameRef.current?.restart();
  };

  const goHome = () => {
    setFinished(false);
    setScore(0);
    setShowHint(true);
    setTiltEnabled(false);
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
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-full border border-white/70 bg-white/45 px-4 py-1.5 shadow-sm backdrop-blur-md">
            <span className="text-sm">👑</span>
            <span className="font-round text-sm font-bold leading-none text-[#A98EBE]">{best}</span>
          </div>
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
            className="rounded-full border border-white/70 bg-white/45 px-3 py-1.5 text-xs font-bold text-[#6B4E68] shadow-sm backdrop-blur-md active:scale-95"
          >
            {tiltEnabled ? '📱 Tilt: ON' : '📱 Tilt: OFF'}
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
              g.restoreSession();
            }}
            callbacks={{
              onScore: setScore,
              onNext: setNextLevel,
              onFinish: handleFinish,
              onFirstInteract: () => setShowHint(false),
              onUnlockLevel: (l) => setUnlocked((u) => Math.max(u, l)),
              onExp: handleExp,
              onStageClear: handleStageClear,
            }}
          />
          <HandHint visible={showHint && !finished && !help} />
        </div>
        <LevelUpToast
          level={toast?.level ?? null}
          unlockedChar={toast?.kind != null ? stage.chars[toast.kind] ?? null : null}
        />
        <StageClearToast stage={clearToast ? STAGES[clearToast - 1] : null} />
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
