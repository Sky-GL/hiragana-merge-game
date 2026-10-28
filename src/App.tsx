import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Bubble, Confetti, HowTo } from './components/PopParts';
import { PopEngine, type NextMedal } from './game/engine';
import { FINAL_TIERS } from './game/popFinal';
import {
  addExp, emptyPop, expToNext, loadPop, markCleared, recordBest, recordCombo, recordKey, savePop,
  type PopMode, type PopSave,
} from './game/popStore';
import { unlockSfx } from './game/sfx';
import { STAGES, STAGE_COUNT, getStage } from './game/stages';
import { speakChar } from './game/speech';
import { preloadClips } from './game/voiceClips';

const SEEN_KEY = 'kanapop.seenHelp';

type Toast = { kind: 'level'; level: number } | { kind: 'tier' | 'clear' | 'miss'; text: string; sub: string };
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

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<PopEngine | null>(null);
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

  useEffect(() => {
    return () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
      if (advanceTimer.current !== null) window.clearTimeout(advanceTimer.current);
    };
  }, []);

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
            text: hadCombo >= 3 ? `✗ コンボ ${hadCombo} が途切れた` : '✗ ちがうよ',
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
            kind: 'tier',
            text: `${info.icon} ${final.kana} ×${info.badge}`,
            sub: t === 3 ? `🌈 RAINBOW BONUS +300 (+${points}点)` : `+${points}点`,
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
          showToast({ kind: 'clear', text: `🎉 STAGE ${stageId} クリア!`, sub: `次は STAGE ${stageId + 1}「${nextStage.title}」` }, 1800);
          advanceTimer.current = window.setTimeout(() => {
            resetRound();
            setStageId(stageId + 1);
          }, 1500);
        } else {
          showToast({ kind: 'clear', text: '🏆 全ステージ制覇!', sub: 'おめでとうございます' }, 2500);
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

  const toTitle = () => {
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
    if (!window.confirm('すべての進行とベスト記録をリセットしますか?')) return;
    commit(emptyPop(saveRef.current.mode));
    setStageId(1);
  };

  // ---------- タイトル(ステージ選択) ----------
  // スマホで一画面に収まるよう、PLAYはモード選択の直下(ステージ一覧より上)に置く。
  if (phase === 'title') {
    const bestHere = save.best[recordKey(mode, stageId)] || 0;
    return (
      <div className="pop-root">
        <div className="screen pop">
          <div className="pop-topbar">
            <span className="pop-brand">KANA POP</span>
            <div className="pop-topbar-right">
              <span className="pop-pill sm">Lv <strong>{save.level}</strong></span>
              {bestHere > 0 && <span className="pop-pill sm">👑 <strong>{bestHere}</strong></span>}
              <button className="btn ghost sm" onClick={() => setHelp(true)} aria-label="あそびかた">❓</button>
            </div>
          </div>
          <div className="pop-title">
            <h1>かなポップ</h1>

            <div className="pop-modes">
              <button className={`pop-mode ${mode === 'read' ? 'sel' : ''}`} onClick={() => setMode('read')}>
                <strong>📖 読みモード</strong>
                <span>文字 <b>あ</b> と読み <b>a</b> のペアで合体。文字を読まないと進めません</span>
              </button>
              <button className={`pop-mode ${mode === 'normal' ? 'sel' : ''}`} onClick={() => setMode('normal')}>
                <strong>🫧 ふつう</strong>
                <span>同じ文字どうしが合体(元のかなポップと同じ)</span>
              </button>
            </div>

            <button className="btn primary big pulse pop-play" onClick={play}>
              <span className="pop-play-main">▶ PLAY</span>
              <span className="pop-play-sub">
                STAGE {stageId} {stage.title}
                <span className="pop-play-glyphs">{stage.chars.map((c) => c.kana).join(' ')}</span>
              </span>
            </button>

            <p className="pop-pick">ステージを選ぶ</p>
            <div className="pop-stages">
              {STAGES.map((s) => (
                <button key={s.id} className={`pop-stage ${s.id === stageId ? 'sel' : ''}`} onClick={() => setStageId(s.id)}>
                  <Bubble item={{ ...s.chars[0], kana: s.cover }} size={38} hideLabel />
                  <span className="pop-stage-no">{s.id}{save.cleared[recordKey(mode, s.id)] ? ' ★' : ''}</span>
                  <strong>{s.title}</strong>
                </button>
              ))}
            </div>
            <button className="btn ghost sm pop-reset" onClick={resetAllProgress}>進行をリセット</button>
          </div>
          {help && <HowTo mode={mode} onClose={closeHelp} />}
        </div>
      </div>
    );
  }

  // ---------- プレイ ----------
  const cur = stage.chars[Math.min(nextLevel, stage.chars.length - 1)];
  const need = expToNext(save.level);
  const bestNow = save.best[recordKey(mode, stageId)] || 0;

  return (
    <div className="pop-root">
      <div className="screen pop">
        <div className="pop-top">
          <button className="btn ghost sm" onClick={toTitle}>← ステージ選択</button>
          <div className="pop-top-right">
            <button className="btn ghost sm" onClick={togglePause} aria-label={paused ? '再開' : '一時停止'}>{paused ? '▶' : 'Ⅱ'}</button>
            <button className="btn ghost sm" onClick={retry} aria-label="やり直す">↻</button>
            <button className="btn ghost sm" onClick={toggleTilt} aria-label="傾き操作">{tiltOn ? '📱✓' : '📱×'}</button>
            <button className="btn ghost sm" onClick={() => setHelp(true)} aria-label="あそびかた">❓</button>
          </div>
        </div>

        <div className="pop-chain">
          {stage.chars.map((c, i) => (
            <span key={`${c.kana}${i}`} className="pop-chain-item">
              <Bubble item={c} size={42} active={i === nextLevel} dim={i > unlocked} />
              <span className="pop-arrow">▸</span>
            </span>
          ))}
          {/* 最終形の進化: 👑2 → 💎4 → 🌈8 → 次のステージ。到達した段階が点灯する */}
          {FINAL_TIERS.slice(1).map((f) => (
            <span key={f.tier} className="pop-chain-item">
              <span className={`pop-tier ${tier >= f.tier ? 'on' : ''}`} style={{ '--tc': f.color } as CSSProperties}>
                <span className="pop-tier-icon">{f.icon}</span>
                <span className="pop-tier-n">{f.badge}</span>
              </span>
              <span className="pop-arrow">▸</span>
            </span>
          ))}
          <span className="pop-tier next">NEXT</span>
        </div>

        <div className="pop-bar">
          <span className="pop-pill sm">Lv <strong>{save.level}</strong></span>
          <div className="pop-exp"><div style={{ width: `${Math.min(100, (save.exp / need) * 100)}%` }} /></div>
          <span className="pop-pill sm">⭐ <strong>{score}</strong></span>
          <span className="pop-pill sm">👑 <strong>{Math.max(bestNow, 0)}</strong></span>
        </div>

        {/* コンボは盤面の外に出す(盤面の中に置くと、上部を左右に動く「次のメダル」を隠すため)。高さは固定してレイアウトを揺らさない */}
        <div className="pop-combo-row">
          {combo.n >= 2 && !over ? (
            <div key={combo.n} className={`pop-combo m${combo.mult}`}>
              🔥 <b>{combo.n}</b> COMBO <span>×{combo.mult}</span>
            </div>
          ) : (
            <span className="pop-combo-hint">合体を続けるとコンボ!</span>
          )}
        </div>

        <div className="pop-field">
          <canvas ref={canvasRef} className="pop-canvas" />
          {hint && !over && !help && <div className="pop-hand">👆</div>}
          {confetti > 0 && <Confetti key={confetti} />}

          {toast?.kind === 'level' && <div className="pop-toast">✨ Lv {toast.level} ✨</div>}
          {toast && toast.kind !== 'level' && (
            <div className={`pop-toast ${toast.kind === 'miss' ? 'miss' : ''}`}>{toast.text}<small>{toast.sub}</small></div>
          )}

          {paused && !over && (
            <div className="pop-overlay in-field">
              <div className="pop-card">
                <h2>PAUSED</h2>
                <button className="btn primary" onClick={togglePause}>▶ つづける</button>
              </div>
            </div>
          )}

          {over && (
            <div className="pop-overlay in-field">
              <div className="pop-card">
                <h2>{over.grand ? '🏆 ALL CLEAR!' : 'Finish! 🎉'}</h2>
                <div className="pop-score">
                  <span>SCORE</span>
                  <strong>{over.score}</strong>
                  <small>BEST {Math.max(bestNow, over.score)}</small>
                </div>
                <div className="pop-stats">
                  <span>🔥 最大コンボ <strong>{over.maxCombo}</strong>{over.newCombo && <em> NEW!</em>}</span>
                  {mode === 'read' && <span>✗ 読み間違い <strong>{over.misses}</strong></span>}
                </div>
                <p className="pop-learned">今回出会った文字</p>
                <div className="pop-learned-row">
                  {stage.chars.slice(0, unlocked + 1).map((c, i) => (
                    <Bubble key={`${c.kana}${i}`} item={c} size={44} />
                  ))}
                </div>
                <div className="cta-row">
                  <button className="btn" onClick={toTitle}>🏠 ステージ選択</button>
                  <button className="btn primary" onClick={retry}>↻ もう一回</button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="pop-listen">
          {mode === 'read' ? (
            // 読みモードでは文字・ローマ字を出さない(答えになるため)。聞きたいときだけ発音を鳴らす
            <button className="btn" onClick={listen}>🔊 次のメダルの発音を聞く</button>
          ) : (
            <button className="btn" onClick={listen}>
              🔊 <span className="pop-listen-glyph">{cur.kana}</span> <small>{cur.romaji}</small>
            </button>
          )}
        </div>
        {help && <HowTo mode={mode} onClose={closeHelp} />}
      </div>
    </div>
  );
}
