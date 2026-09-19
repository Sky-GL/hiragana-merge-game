// ステージ定義。1ステージ = 1本の進化チェーン（8〜12段階）。
// 全かなを行セットに分けて、クリアするたびに次のステージが解放される。
export type KanaChar = {
  level: number;
  kana: string;
  romaji: string;
  radius: number;
  base: string;
};

export type Stage = {
  id: number;
  label: string;
  /** 画面に出すのはこの代表文字だけ（説明文は使わない） */
  cover: string;
  chars: KanaChar[];
};

/**
 * 行ごとに色相と並びを変える。色が「何番目の文字か」の手がかりにならず、
 * ひらがなの形・音・並びそのものを見て遊べるようにする。
 */
const COLOR_BANK = ['#FFB6C1', '#FFD1BA', '#FFF2A3', '#B9F3CC', '#C1E3FE', '#D9C7F7', '#FFC6DF', '#A9E9E4', '#FFDFA6', '#CFE6AE', '#F7A8C0', '#C9D8F7'] as const;

const R_MIN = 26;
const R_MAX = 116;

/** かな + ローマ字（ローマ字は音声ファイル名にもなる） */
type Pair = [string, string];

const STAGE_SOURCE: Pair[][] = [
  // clips にあるユーザー提供の個別実音声だけを収録する。
  [['あ','a'],['い','i'],['う','u'],['え','e'],['お','o']],
  [['か','ka'],['き','ki'],['く','ku'],['け','ke'],['こ','ko']],
  [['さ','sa'],['し','shi'],['す','su'],['せ','se'],['そ','so']],
  [['た','ta'],['ち','chi'],['つ','tsu'],['て','te'],['と','to']],
  [['な','na'],['に','ni'],['ぬ','nu'],['ね','ne'],['の','no']],
  [['は','ha'],['ひ','hi'],['ふ','fu'],['へ','he'],['ほ','ho']],
  [['ま','ma'],['み','mi'],['む','mu'],['め','me'],['も','mo']],
  // 3文字だけの行は組にして、短すぎるステージを作らない。
  [['や','ya'],['ゆ','yu'],['よ','yo'],['わ','wa'],['を','wo'],['ん','n']],
  [['ら','ra'],['り','ri'],['る','ru'],['れ','re'],['ろ','ro']],
  [['が','ga'],['ぎ','gi'],['ぐ','gu'],['げ','ge'],['ご','go']],
  [['ざ','za'],['じ','ji'],['ず','zu'],['ぜ','ze'],['ぞ','zo']],
  [['だ','da'],['ぢ','dji'],['づ','dzu'],['で','de'],['ど','do']],
  [['ば','ba'],['び','bi'],['ぶ','bu'],['べ','be'],['ぼ','bo']],
  [['ぱ','pa'],['ぴ','pi'],['ぷ','pu'],['ぺ','pe'],['ぽ','po']],
  // 拗音も3文字行を2組ずつまとめ、短すぎるステージにしない。
  [['きゃ','kya'],['きゅ','kyu'],['きょ','kyo'],['しゃ','sha'],['しゅ','shu'],['しょ','sho']],
  [['ちゃ','cha'],['ちゅ','chu'],['ちょ','cho'],['にゃ','nya'],['にゅ','nyu'],['にょ','nyo']],
  [['ひゃ','hya'],['ひゅ','hyu'],['ひょ','hyo'],['みゃ','mya'],['みゅ','myu'],['みょ','myo']],
  [['りゃ','rya'],['りゅ','ryu'],['りょ','ryo'],['ぎゃ','gya'],['ぎゅ','gyu'],['ぎょ','gyo']],
  [['じゃ','ja'],['じゅ','ju'],['じょ','jo'],['ぢゃ','dya'],['ぢゅ','dyu'],['ぢょ','dyo']],
  [['びゃ','bya'],['びゅ','byu'],['びょ','byo'],['ぴゃ','pya'],['ぴゅ','pyu'],['ぴょ','pyo']],
];

const STAGE_LABELS = [
  'A-ROW', 'K-ROW', 'S-ROW', 'T-ROW', 'N-ROW', 'H-ROW', 'M-ROW', 'Y & W-ROW', 'R-ROW',
  'G-ROW', 'Z-ROW', 'D-ROW', 'B-ROW', 'P-ROW', 'KYA & SHA', 'CHA & NYA', 'HYA & MYA',
  'RYA & GYA', 'JA & DYA', 'BYA & PYA',
];

function colorFor(stageIndex: number, charIndex: number) {
  const stride = stageIndex % 2 === 0 ? 5 : 7;
  return COLOR_BANK[(stageIndex * 7 + charIndex * stride + stageIndex * stageIndex) % COLOR_BANK.length];
}

/** 10段階ステージの成長曲線を基準にする。行別の短いステージで最終文字だけ巨大化させない。 */
function radiusFor(i: number) {
  return Math.round(R_MIN * Math.pow(R_MAX / R_MIN, i / 9));
}

export const STAGES: Stage[] = STAGE_SOURCE.map((pairs, si) => ({
  id: si + 1,
  label: STAGE_LABELS[si],
  cover: pairs[0][0],
  chars: pairs.map(([kana, romaji], i) => ({
    level: i,
    kana,
    romaji,
    radius: radiusFor(i),
    base: colorFor(si, i),
  })),
}));

export const STAGE_COUNT = STAGES.length;

export function getStage(id: number): Stage {
  return STAGES[Math.max(0, Math.min(STAGE_COUNT - 1, id - 1))];
}

/** hex を明暗調整 */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) =>
    Math.round(amount >= 0 ? v + (255 - v) * amount : v * (1 + amount));
  return `rgb(${f((n >> 16) & 255)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}
