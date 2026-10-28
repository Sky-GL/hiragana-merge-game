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
  /** ふつうモードでの半径 */
  radius: number;
  /** ふつうモードでの色 */
  base: string;
};

export type Stage = {
  id: number;
  title: string;
  /** ステージ一覧に出す代表文字 */
  cover: string;
  chars: KanaChar[];
};

/** [かな, ローマ字, 収録ボイス名(省略時はローマ字)] */
type Item = [string, string, string?];

type Row = { title: string; cover: string; items: Item[] };

// 5文字に満たない行は、直前の行の末尾の文字(復習)で埋めて5文字にそろえる。
const ROWS: Row[] = [
  { title: 'あ行', cover: 'あ', items: [['あ', 'a'], ['い', 'i'], ['う', 'u'], ['え', 'e'], ['お', 'o']] },
  { title: 'か行', cover: 'か', items: [['か', 'ka'], ['き', 'ki'], ['く', 'ku'], ['け', 'ke'], ['こ', 'ko']] },
  { title: 'さ行', cover: 'さ', items: [['さ', 'sa'], ['し', 'shi'], ['す', 'su'], ['せ', 'se'], ['そ', 'so']] },
  { title: 'た行', cover: 'た', items: [['た', 'ta'], ['ち', 'chi'], ['つ', 'tsu'], ['て', 'te'], ['と', 'to']] },
  { title: 'な行', cover: 'な', items: [['な', 'na'], ['に', 'ni'], ['ぬ', 'nu'], ['ね', 'ne'], ['の', 'no']] },
  { title: 'は行', cover: 'は', items: [['は', 'ha'], ['ひ', 'hi'], ['ふ', 'fu'], ['へ', 'he'], ['ほ', 'ho']] },
  { title: 'ま行', cover: 'ま', items: [['ま', 'ma'], ['み', 'mi'], ['む', 'mu'], ['め', 'me'], ['も', 'mo']] },
  { title: 'や行', cover: 'や', items: [['め', 'me'], ['も', 'mo'], ['や', 'ya'], ['ゆ', 'yu'], ['よ', 'yo']] },
  { title: 'ら行', cover: 'ら', items: [['ら', 'ra'], ['り', 'ri'], ['る', 'ru'], ['れ', 're'], ['ろ', 'ro']] },
  { title: 'わ・ん', cover: 'わ', items: [['れ', 're'], ['ろ', 'ro'], ['わ', 'wa'], ['を', 'o', 'wo'], ['ん', 'n']] },
  { title: 'が行', cover: 'が', items: [['が', 'ga'], ['ぎ', 'gi'], ['ぐ', 'gu'], ['げ', 'ge'], ['ご', 'go']] },
  { title: 'ざ行', cover: 'ざ', items: [['ざ', 'za'], ['じ', 'ji'], ['ず', 'zu'], ['ぜ', 'ze'], ['ぞ', 'zo']] },
  { title: 'だ行', cover: 'だ', items: [['だ', 'da'], ['ぢ', 'ji', 'dji'], ['づ', 'zu', 'dzu'], ['で', 'de'], ['ど', 'do']] },
  { title: 'ば行', cover: 'ば', items: [['ば', 'ba'], ['び', 'bi'], ['ぶ', 'bu'], ['べ', 'be'], ['ぼ', 'bo']] },
  { title: 'ぱ行', cover: 'ぱ', items: [['ぱ', 'pa'], ['ぴ', 'pi'], ['ぷ', 'pu'], ['ぺ', 'pe'], ['ぽ', 'po']] },
  { title: '拗音①', cover: 'きゃ', items: [['きゃ', 'kya'], ['しゃ', 'sha'], ['ちゃ', 'cha'], ['にゃ', 'nya'], ['ひゃ', 'hya']] },
  { title: '拗音②', cover: 'みゃ', items: [['みゃ', 'mya'], ['りゃ', 'rya'], ['ぎゃ', 'gya'], ['じゃ', 'ja'], ['びゃ', 'bya']] },
  { title: '拗音③', cover: 'きゅ', items: [['きゅ', 'kyu'], ['しゅ', 'shu'], ['ちゅ', 'chu'], ['にゅ', 'nyu'], ['ひゅ', 'hyu']] },
  { title: '拗音④', cover: 'みゅ', items: [['みゅ', 'myu'], ['りゅ', 'ryu'], ['ぎゅ', 'gyu'], ['じゅ', 'ju'], ['びゅ', 'byu']] },
  { title: '拗音⑤', cover: 'きょ', items: [['きょ', 'kyo'], ['しょ', 'sho'], ['ちょ', 'cho'], ['にょ', 'nyo'], ['ひょ', 'hyo']] },
  { title: '拗音⑥', cover: 'みょ', items: [['みょ', 'myo'], ['りょ', 'ryo'], ['ぎょ', 'gyo'], ['じょ', 'jo'], ['びょ', 'byo']] },
];

/** レベルごとのアクセント色(スチール→シアン→紫→橙→金)。隣り合うレベルで色相が大きく変わる */
const COLORS = ['#a5b4c4', '#38d0f0', '#a070ff', '#ff9a2e', '#ffd966'];

const MIN_R = 30;
const MAX_R = 56;

/** レベル0〜n-1 の半径を等比で補間(最小30 → 最大56) */
const radiusOf = (level: number, count: number) =>
  count <= 1 ? MIN_R : Math.round(MIN_R * Math.pow(MAX_R / MIN_R, level / (count - 1)));

export const STAGES: Stage[] = ROWS.map((row, i) => ({
  id: i + 1,
  title: row.title,
  cover: row.cover,
  chars: row.items.map(([kana, romaji, clip], level) => ({
    level,
    kana,
    romaji,
    clip: clip ?? romaji,
    radius: radiusOf(level, row.items.length),
    base: COLORS[level % COLORS.length],
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

/** "#RRGGBB" + 透明度 → rgba文字列(発光・縁取り用) */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
