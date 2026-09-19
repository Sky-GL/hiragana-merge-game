// プレイヤーレベル（難易度カーブ兼ごほうび）
// レベルが上がるほど「出てくる文字の種類」が増える = 自然に難しくなる。
// 減点・降格は一切なし（全肯定設計）。
const KEY = 'kanapop.progress';
const STAGE_LAYOUT_VERSION = 2;

export type Progress = {
  stageLayoutVersion: number;
  level: number;
  exp: number;
  /** 解放済みステージ数（1 なら最初のステージだけ） */
  unlockedStages: number;
};

/** 次のレベルまでに必要な EXP */
export function expToNext(level: number) {
  return 40 + (level - 1) * 35;
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Progress>;
      const level = Number(p.level);
      const exp = Number(p.exp);
      const us = Number(p.unlockedStages);
      if (p.stageLayoutVersion === STAGE_LAYOUT_VERSION && Number.isFinite(level) && level >= 1 && Number.isFinite(exp) && exp >= 0) {
        return {
          stageLayoutVersion: STAGE_LAYOUT_VERSION,
          level: Math.min(level, 99),
          exp,
          unlockedStages: Number.isFinite(us) && us >= 1 ? us : 1,
        };
      }
    }
  } catch {
    /* 壊れていたら初期値から */
  }
  return { stageLayoutVersion: STAGE_LAYOUT_VERSION, level: 1, exp: 0, unlockedStages: 1 };
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
