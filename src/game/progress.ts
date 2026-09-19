// プレイヤーレベル（難易度カーブ兼ごほうび）
// レベルが上がるほど「出てくる文字の種類」が増える = 自然に難しくなる。
// 減点・降格は一切なし（全肯定設計）。
const KEY = 'kanapop.progress';
const STAGE_LAYOUT_VERSION = 8;

export type Progress = {
  stageLayoutVersion: number;
  level: number;
  exp: number;
  /** 解放済みステージ数（1 なら最初のステージだけ） */
  unlockedStages: number;
  /** 行ごとのチャレンジ完了回数 */
  stageCompletions: Record<number, number>;
};

/** 次のレベルまでに必要な EXP */
export function expToNext(level: number) {
  return 100 + (level - 1) * 90;
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Progress>;
      const level = Number(p.level);
      const exp = Number(p.exp);
      const us = Number(p.unlockedStages);
      const layoutVersion = Number(p.stageLayoutVersion);
      if ((layoutVersion === 5 || layoutVersion === 6 || layoutVersion === 7 || layoutVersion === STAGE_LAYOUT_VERSION) && Number.isFinite(level) && level >= 1 && Number.isFinite(exp) && exp >= 0) {
        // v5〜v7 は現在の9面目以降と並びが異なるため、ら行までの進行へ安全に戻す。
        const legacyUnlocked = Number.isFinite(us) && us >= 1 ? us : 1;
        return {
          stageLayoutVersion: STAGE_LAYOUT_VERSION,
          level: Math.min(level, 99),
          exp,
          unlockedStages: layoutVersion === 5 || layoutVersion === 6 || layoutVersion === 7
            ? Math.min(9, legacyUnlocked)
            : Math.min(11, legacyUnlocked),
          stageCompletions: typeof p.stageCompletions === 'object' && p.stageCompletions !== null
            ? p.stageCompletions as Record<number, number>
            : {},
        };
      }
    }
  } catch {
    /* 壊れていたら初期値から */
  }
  return { stageLayoutVersion: STAGE_LAYOUT_VERSION, level: 1, exp: 0, unlockedStages: 1, stageCompletions: {} };
}

export function saveProgress(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* 保存できなくても続行 */
  }
}

/** EXP を加算し、上がったレベル数も返す */
export function addExp(p: Progress, gain: number): { next: Progress; levelsGained: number } {
  let { level, exp } = p;
  exp += gain;
  let levelsGained = 0;
  while (level < 99 && exp >= expToNext(level)) {
    exp -= expToNext(level);
    level += 1;
    levelsGained += 1;
  }
  const next = { ...p, level, exp };
  saveProgress(next);
  return { next, levelsGained };
}

/** ステージクリアで次のステージを解放する */
export function unlockNextStage(p: Progress, total: number): Progress {
  const next = { ...p, unlockedStages: Math.min(total, p.unlockedStages + 1) };
  saveProgress(next);
  return next;
}

/** 学習の最初から試し直すため、保存済みの進行を削除する。 */
export function clearProgress() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* 保存できない環境でも画面上の進行は初期化する */
  }
}

/** 1周目を終えた行を記録し、次回の開始時にチャレンジ状態を復元する。 */
export function recordStageCompletion(p: Progress, stageId: number): { next: Progress; completions: number } {
  const completions = 1;
  const next = {
    ...p,
    stageCompletions: { ...p.stageCompletions, [stageId]: completions },
  };
  saveProgress(next);
  return { next, completions };
}

/** そのレベルで出現する文字の抽選プール（小さい文字ほど高確率） */
export function spawnPoolFor(playerLevel: number): number[] {
  // 最初から「あ・い・う」を出して、同じ文字だけが続く退屈さを避ける。
  const maxKind = Math.min(3, Math.max(2, Math.floor((playerLevel + 1) / 2)));
  const pool: number[] = [];
  for (let k = 0; k <= maxKind; k++) {
    const weight = Math.max(1, 4 - k); // 0:4回, 1:3回, 2:2回, 3:1回
    for (let i = 0; i < weight; i++) pool.push(k);
  }
  return pool;
}

/** レベルアップで新しく出るようになった文字（無ければ null） */
export function newlyUnlockedKind(prevLevel: number, nextLevel: number): number | null {
  const before = Math.min(3, Math.floor((prevLevel + 1) / 2));
  const after = Math.min(3, Math.floor((nextLevel + 1) / 2));
  return after > before ? after : null;
}
