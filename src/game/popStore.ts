// ポップ専用の進捗。Lvは遊んだ量の目安(出現する文字には影響しない)。
const KEY = 'kanapop-pop-v1';

export type PopMode = 'read' | 'normal';

export type PopSave = {
  level: number;
  exp: number;
  best: Record<string, number>;
  bestCombo: Record<string, number>;
  cleared: Record<string, boolean>;
  mode: PopMode;
};

// mode: 'read'=文字面+読み面のペアで合体(読む練習) / 'normal'=同じ文字どうしが合体(元のかなポップ)
export const emptyPop = (mode: PopMode = 'read'): PopSave => ({ level: 1, exp: 0, best: {}, bestCombo: {}, cleared: {}, mode });

/** ベスト/クリア記録のキー。モードごとに別々に持つ(読みモードは 'r1','r2'… / ふつうは '1','2'…) */
export const recordKey = (mode: PopMode, stage: number): string => (mode === 'read' ? `r${stage}` : String(stage));

const isRecord = (v: unknown): v is Record<string, never> => typeof v === 'object' && v !== null && !Array.isArray(v);

export const loadPop = (): PopSave => {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || 'null') as Partial<PopSave> | null;
    if (p && Number.isFinite(p.level) && (p.level as number) >= 1 && Number.isFinite(p.exp) && (p.exp as number) >= 0) {
      const base = emptyPop();
      return {
        level: Math.min(p.level as number, 99),
        exp: p.exp as number,
        best: isRecord(p.best) ? p.best : base.best,
        bestCombo: isRecord(p.bestCombo) ? p.bestCombo : base.bestCombo,
        cleared: isRecord(p.cleared) ? p.cleared : base.cleared,
        mode: p.mode === 'normal' ? 'normal' : 'read',
      };
    }
  } catch {
    /* 壊れていたら初期化 */
  }
  return emptyPop();
};

export const savePop = (p: PopSave) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* 保存不可でも遊べる */
  }
};

export const expToNext = (level: number) => 100 + (level - 1) * 90;

/** 経験値を加算。{ next, gained(上がったLv数) } を返す(保存は呼び出し側) */
export const addExp = (p: PopSave, amount: number): { next: PopSave; gained: number } => {
  let { level, exp } = p;
  exp += amount;
  let gained = 0;
  while (level < 99 && exp >= expToNext(level)) {
    exp -= expToNext(level);
    level += 1;
    gained += 1;
  }
  return { next: { ...p, level, exp }, gained };
};

export const recordBest = (p: PopSave, key: string, score: number): PopSave =>
  score > (p.best[key] || 0) ? { ...p, best: { ...p.best, [key]: score } } : p;

export const markCleared = (p: PopSave, key: string): PopSave =>
  p.cleared[key] ? p : { ...p, cleared: { ...p.cleared, [key]: true } };

/** 最大コンボの自己ベスト(モードごと)。{ next, isNew } を返す(保存は呼び出し側) */
export const recordCombo = (p: PopSave, key: string, combo: number): { next: PopSave; isNew: boolean } => {
  const prev = p.bestCombo[key] || 0;
  if (combo <= prev) return { next: p, isNew: false };
  return { next: { ...p, bestCombo: { ...p.bestCombo, [key]: combo } }, isNew: prev > 0 || combo >= 3 };
};
