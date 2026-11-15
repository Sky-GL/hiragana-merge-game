// ステージ定義。1ステージ = 5文字。小さい文字 → 大きい文字の順に進化し、最後の文字が最終形。
// 5文字なのは、クリアに最終形が16個(2^4)必要で、文字数が多いと必要数が倍々になってクリアできないため。
export type KanaChar = {
  level: number;
  /** 文字面に出すひらがな */
  kana: string;
  /** 読み面に出すヘボン式ローマ字 */
  romaji: string;
  /** 収録ボイスのファイル名(romaji と異なる文字だけ別指定) */
  clip: string;
  /** ふつうモードでの半径（読みモードは全員同じ） */
  radius: number;
  /** ふつうモードでの色（読みモードは文字面/読み面の2色だけ） */
  base: string;
};

export type Stage = {
  id: number;
  label: string;
  /** 画面に出すのはこの代表文字だけ（説明文は使わない） */
  cover: string;
  chars: KanaChar[];
};

/** [かな, ローマ字, 収録ボイス名(省略時はローマ字)] */
type Item = [string, string, string?];

type Row = { label: string; cover: string; items: Item[] };

// 5文字に満たない行は、直前の行の末尾の文字(復習)で埋めて5文字にそろえる。
const ROWS: Row[] = [
  { label: 'A-ROW', cover: 'あ', items: [['あ', 'a'], ['い', 'i'], ['う', 'u'], ['え', 'e'], ['お', 'o']] },
  { label: 'K-ROW', cover: 'か', items: [['か', 'ka'], ['き', 'ki'], ['く', 'ku'], ['け', 'ke'], ['こ', 'ko']] },
  { label: 'S-ROW', cover: 'さ', items: [['さ', 'sa'], ['し', 'shi'], ['す', 'su'], ['せ', 'se'], ['そ', 'so']] },
  { label: 'T-ROW', cover: 'た', items: [['た', 'ta'], ['ち', 'chi'], ['つ', 'tsu'], ['て', 'te'], ['と', 'to']] },
  { label: 'N-ROW', cover: 'な', items: [['な', 'na'], ['に', 'ni'], ['ぬ', 'nu'], ['ね', 'ne'], ['の', 'no']] },
  { label: 'H-ROW', cover: 'は', items: [['は', 'ha'], ['ひ', 'hi'], ['ふ', 'fu'], ['へ', 'he'], ['ほ', 'ho']] },
  { label: 'M-ROW', cover: 'ま', items: [['ま', 'ma'], ['み', 'mi'], ['む', 'mu'], ['め', 'me'], ['も', 'mo']] },
  { label: 'Y-ROW', cover: 'や', items: [['め', 'me'], ['も', 'mo'], ['や', 'ya'], ['ゆ', 'yu'], ['よ', 'yo']] },
  { label: 'R-ROW', cover: 'ら', items: [['ら', 'ra'], ['り', 'ri'], ['る', 'ru'], ['れ', 're'], ['ろ', 'ro']] },
  { label: 'W & N', cover: 'わ', items: [['れ', 're'], ['ろ', 'ro'], ['わ', 'wa'], ['を', 'o', 'wo'], ['ん', 'n']] },
  { label: 'G-ROW', cover: 'が', items: [['が', 'ga'], ['ぎ', 'gi'], ['ぐ', 'gu'], ['げ', 'ge'], ['ご', 'go']] },
  { label: 'Z-ROW', cover: 'ざ', items: [['ざ', 'za'], ['じ', 'ji'], ['ず', 'zu'], ['ぜ', 'ze'], ['ぞ', 'zo']] },
  { label: 'D-ROW', cover: 'だ', items: [['だ', 'da'], ['ぢ', 'ji', 'dji'], ['づ', 'zu', 'dzu'], ['で', 'de'], ['ど', 'do']] },
  { label: 'B-ROW', cover: 'ば', items: [['ば', 'ba'], ['び', 'bi'], ['ぶ', 'bu'], ['べ', 'be'], ['ぼ', 'bo']] },
  { label: 'P-ROW', cover: 'ぱ', items: [['ぱ', 'pa'], ['ぴ', 'pi'], ['ぷ', 'pu'], ['ぺ', 'pe'], ['ぽ', 'po']] },
  { label: 'KYA', cover: 'きゃ', items: [['きゃ', 'kya'], ['しゃ', 'sha'], ['ちゃ', 'cha'], ['にゃ', 'nya'], ['ひゃ', 'hya']] },
  { label: 'MYA', cover: 'みゃ', items: [['みゃ', 'mya'], ['りゃ', 'rya'], ['ぎゃ', 'gya'], ['じゃ', 'ja'], ['びゃ', 'bya']] },
  { label: 'KYU', cover: 'きゅ', items: [['きゅ', 'kyu'], ['しゅ', 'shu'], ['ちゅ', 'chu'], ['にゅ', 'nyu'], ['ひゅ', 'hyu']] },
  { label: 'MYU', cover: 'みゅ', items: [['みゅ', 'myu'], ['りゅ', 'ryu'], ['ぎゅ', 'gyu'], ['じゅ', 'ju'], ['びゅ', 'byu']] },
  { label: 'KYO', cover: 'きょ', items: [['きょ', 'kyo'], ['しょ', 'sho'], ['ちょ', 'cho'], ['にょ', 'nyo'], ['ひょ', 'hyo']] },
  { label: 'MYO', cover: 'みょ', items: [['みょ', 'myo'], ['りょ', 'ryo'], ['ぎょ', 'gyo'], ['じょ', 'jo'], ['びょ', 'byo']] },
];

/**
 * 行ごとに色相と並びを変える。色が「何番目の文字か」の手がかりにならず、
 * ひらがなの形・音・並びそのものを見て遊べるようにする。
 */
const COLOR_BANK = ['#FFB6C1', '#FFD1BA', '#FFF2A3', '#B9F3CC', '#C1E3FE', '#D9C7F7', '#FFC6DF', '#A9E9E4', '#FFDFA6', '#CFE6AE', '#F7A8C0', '#C9D8F7'] as const;

const R_MIN = 26;
const R_MAX = 116;

function colorFor(stageIndex: number, charIndex: number) {
  const stride = stageIndex % 2 === 0 ? 5 : 7;
  return COLOR_BANK[(stageIndex * 7 + charIndex * stride + stageIndex * stageIndex) % COLOR_BANK.length];
}

/** 10段階ステージの成長曲線を基準にする。行別の短いステージで最終文字だけ巨大化させない。 */
function radiusFor(i: number) {
  return Math.round(R_MIN * Math.pow(R_MAX / R_MIN, i / 9));
}

export const STAGES: Stage[] = ROWS.map((row, si) => ({
  id: si + 1,
  label: row.label,
  cover: row.cover,
  chars: row.items.map(([kana, romaji, clip], level) => ({
    level,
    kana,
    romaji,
    clip: clip ?? romaji,
    radius: radiusFor(level),
    base: colorFor(si, level),
  })),
}));

export const STAGE_COUNT = STAGES.length;

export function getStage(id: number): Stage {
  return STAGES[Math.max(0, Math.min(STAGE_COUNT - 1, id - 1))];
}

/** "#RRGGBB" を明るく(amount>0)/暗く(amount<0)する。メダルのグラデーション用 */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.round(amount >= 0 ? v + (255 - v) * amount : v * (1 + amount));
  return `rgb(${f((n >> 16) & 255)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}
