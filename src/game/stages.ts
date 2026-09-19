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
  /** 画面に出すのはこの代表文字だけ（説明文は使わない） */
  cover: string;
  chars: KanaChar[];
};

/** パステルキャンディ調。段階インデックスで循環させる */
const PALETTE = [
  '#FFB6C1', // ベビーピンク
  '#FFD1BA', // コーラルピーチ
  '#FFF2A3', // カスタードイエロー
  '#B9F3CC', // ピスタチオミント
  '#C1E3FE', // スカイラベンダー
  '#D9C7F7', // ライラック
  '#FFC6DF', // チェリーブロッサム
  '#A9E9E4', // アクアミント
  '#FFDFA6', // アプリコット
  '#CFE6AE', // マッチャ
  '#F7A8C0', // チェリー
  '#C9D8F7', // ペリウィンクル
];

const R_MIN = 26;
const R_MAX = 116;

/** かな + ローマ字（ローマ字は音声ファイル名にもなる） */
type Pair = [string, string];

const STAGE_SOURCE: Pair[][] = [
  // 1〜10: 清音・濁音・半濁音
  [['あ','a'],['い','i'],['う','u'],['え','e'],['お','o']],
  [['か','ka'],['き','ki'],['く','ku'],['け','ke'],['こ','ko']],
  [['さ','sa'],['し','shi'],['す','su'],['せ','se'],['そ','so']],
  [['た','ta'],['ち','chi'],['つ','tsu'],['て','te'],['と','to']],
  [['な','na'],['に','ni'],['ぬ','nu'],['ね','ne'],['の','no']],
  [['は','ha'],['ひ','hi'],['ふ','fu'],['へ','he'],['ほ','ho']],
  [['ま','ma'],['み','mi'],['む','mu'],['め','me'],['も','mo']],
  [['や','ya'],['ゆ','yu'],['よ','yo']],
  [['ら','ra'],['り','ri'],['る','ru'],['れ','re'],['ろ','ro']],
  [['わ','wa'],['を','wo'],['ん','n']],
  [['が','ga'],['ぎ','gi'],['ぐ','gu'],['げ','ge'],['ご','go']],
  [['ざ','za'],['じ','ji'],['ず','zu'],['ぜ','ze'],['ぞ','zo']],
  [['だ','da'],['ぢ','dji'],['づ','dzu'],['で','de'],['ど','do']],
  [['ば','ba'],['び','bi'],['ぶ','bu'],['べ','be'],['ぼ','bo']],
  [['ぱ','pa'],['ぴ','pi'],['ぷ','pu'],['ぺ','pe'],['ぽ','po']],
  // 16〜27: 拗音
  [['きゃ','kya'],['きゅ','kyu'],['きょ','kyo']],
  [['しゃ','sha'],['しゅ','shu'],['しょ','sho']],
  [['ちゃ','cha'],['ちゅ','chu'],['ちょ','cho']],
  [['にゃ','nya'],['にゅ','nyu'],['にょ','nyo']],
  [['ひゃ','hya'],['ひゅ','hyu'],['ひょ','hyo']],
  [['みゃ','mya'],['みゅ','myu'],['みょ','myo']],
  [['りゃ','rya'],['りゅ','ryu'],['りょ','ryo']],
  [['ぎゃ','gya'],['ぎゅ','gyu'],['ぎょ','gyo']],
  [['じゃ','ja'],['じゅ','ju'],['じょ','jo']],
  [['ぢゃ','dya'],['ぢゅ','dyu'],['ぢょ','dyo']],
  [['びゃ','bya'],['びゅ','byu'],['びょ','byo']],
  [['ぴゃ','pya'],['ぴゅ','pyu'],['ぴょ','pyo']],
];

/** 段階数に合わせて半径を等比で割り当てる（小さい→大きいの手触りを一定に保つ） */
function radiusFor(i: number, n: number) {
  if (n <= 1) return R_MIN;
  return Math.round(R_MIN * Math.pow(R_MAX / R_MIN, i / (n - 1)));
}

export const STAGES: Stage[] = STAGE_SOURCE.map((pairs, si) => ({
  id: si + 1,
  cover: pairs[0][0],
  chars: pairs.map(([kana, romaji], i) => ({
    level: i,
    kana,
    romaji,
    radius: radiusFor(i, pairs.length),
    base: PALETTE[i % PALETTE.length],
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
