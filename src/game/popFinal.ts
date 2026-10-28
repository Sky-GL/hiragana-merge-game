// 最終形(ステージの最後の文字)の進化段階の定義と飾りの描画:
//   最終形+最終形 → 👑最終形 → (👑+👑) 💎最終形 → (💎+💎) 🌈最終形 → (🌈+🌈) ステージクリア
//   バッジは 1 → 👑2 → 💎4 → 🌈8。同じバッジどうしだけが合体する。
// クラウン・ダイヤ・虹は「降ってくるアイテム」ではなく、最終形が育っていく段階を表す。
export type FinalTier = { tier: number; icon: string; name: string; badge: number; color: string; burst: string[] };

export const FINAL_TIERS: FinalTier[] = [
  { tier: 0, icon: '', name: '最終形', badge: 1, color: '#ffd966', burst: ['#ffd966', '#ffe9a0', '#ffffff', '#e0902f'] },
  { tier: 1, icon: '👑', name: 'クラウン', badge: 2, color: '#ffcf4a', burst: ['#ffcf4a', '#ffe9a0', '#ffffff', '#e0902f'] },
  { tier: 2, icon: '💎', name: 'ダイヤ', badge: 4, color: '#58d8ff', burst: ['#58d8ff', '#bff3ff', '#ffffff', '#3f7fe0'] },
  { tier: 3, icon: '🌈', name: '虹', badge: 8, color: '#ff9ad5', burst: ['#ff4d4d', '#ff9a2e', '#f2d03b', '#3ddc84', '#38d0f0', '#a070ff'] },
];

// ステージクリアに必要な最終形の数(2^4)
export const FINALS_TO_CLEAR = 16;

const RAINBOW = ['#ff4d4d', '#ff9a2e', '#f2d03b', '#3ddc84', '#38d0f0', '#4f7cff', '#a070ff'];

// アイコンは原点中心・サイズ s の相対座標で描く
const drawRainbow = (ctx: CanvasRenderingContext2D, s: number) => {
  ctx.lineCap = 'butt';
  RAINBOW.forEach((c, i) => {
    ctx.strokeStyle = c;
    ctx.lineWidth = s * 0.085;
    ctx.beginPath();
    ctx.arc(0, s * 0.2, s * (0.6 - i * 0.075), Math.PI, Math.PI * 2);
    ctx.stroke();
  });
};

const drawGem = (ctx: CanvasRenderingContext2D, s: number) => {
  const P = (x: number, y: number): [number, number] => [x * s, y * s];
  const pts = [P(-0.3, -0.42), P(0.3, -0.42), P(0.5, -0.1), P(0, 0.52), P(-0.5, -0.1)];
  const g = ctx.createLinearGradient(-s * 0.5, -s * 0.4, s * 0.5, s * 0.5);
  g.addColorStop(0, '#e6fbff');
  g.addColorStop(0.5, '#58d8ff');
  g.addColorStop(1, '#2f7fe0');
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = Math.max(1.5, s * 0.04);
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(...P(-0.5, -0.1));
  ctx.lineTo(...P(0.5, -0.1));
  ctx.moveTo(...P(-0.3, -0.42));
  ctx.lineTo(...P(-0.14, -0.1));
  ctx.lineTo(...P(0, 0.52));
  ctx.moveTo(...P(0.3, -0.42));
  ctx.lineTo(...P(0.14, -0.1));
  ctx.lineTo(...P(0, 0.52));
  ctx.lineWidth = Math.max(1, s * 0.025);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.stroke();
};

const drawCrown = (ctx: CanvasRenderingContext2D, s: number) => {
  const P = (x: number, y: number): [number, number] => [x * s, y * s];
  const pts = [P(-0.52, 0.34), P(-0.52, -0.3), P(-0.26, -0.02), P(0, -0.46), P(0.26, -0.02), P(0.52, -0.3), P(0.52, 0.34)];
  const g = ctx.createLinearGradient(0, -s * 0.5, 0, s * 0.4);
  g.addColorStop(0, '#fff0b0');
  g.addColorStop(0.55, '#ffcf4a');
  g.addColorStop(1, '#d98a1f');
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = '#8a5410';
  ctx.lineWidth = Math.max(1.5, s * 0.045);
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.fillStyle = 'rgba(138, 84, 16, 0.55)';
  ctx.fillRect(-s * 0.52, s * 0.2, s * 1.04, s * 0.1);
  const jewels: [number, number, string][] = [[-0.52, -0.3, '#ff5a5a'], [0, -0.46, '#58d8ff'], [0.52, -0.3, '#ff5a5a']];
  for (const [x, y, c] of jewels) {
    ctx.beginPath();
    ctx.arc(x * s, y * s, s * 0.085, 0, Math.PI * 2);
    ctx.fillStyle = c;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = Math.max(1, s * 0.025);
    ctx.stroke();
  }
};

const ICONS: (((ctx: CanvasRenderingContext2D, s: number) => void) | null)[] = [null, drawCrown, drawGem, drawRainbow];

/**
 * 最終形メダルの飾り(メダル中心が原点、s=メダル半径)。
 *  - 全ての最終形: 右上にバッジ(1/2/4/8)
 *  - 👑/💎/🌈: 内側に段階色のリング(虹は7色)と、メダルの上に大きなアイコン
 */
export const drawFinalDecor = (ctx: CanvasRenderingContext2D, s: number, tier: number, t = 0) => {
  const info = FINAL_TIERS[tier];

  if (tier >= 1) {
    let ring: string | CanvasGradient = info.color;
    if (tier === 3) {
      const g = ctx.createLinearGradient(-s, -s, s, s);
      RAINBOW.forEach((c, i) => g.addColorStop(i / (RAINBOW.length - 1), c));
      ring = g;
    }
    ctx.save();
    ctx.strokeStyle = ring;
    ctx.lineWidth = Math.max(2.5, s * (tier === 3 ? 0.1 : 0.07));
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.86, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // アイコンはゆっくり上下に揺らして「進化した」ことを目立たせる
    ctx.save();
    ctx.translate(0, -s * (tier === 3 ? 1.02 : 1.16) + Math.sin(t / 260) * s * 0.04);
    ICONS[tier]?.(ctx, s * (tier === 3 ? 0.62 : 0.56));
    ctx.restore();
  }

  // バッジ(同じ数字どうしだけが合体する)
  const r = Math.max(10, s * 0.27);
  const bx = s * 0.66;
  const by = -s * 0.6;
  ctx.save();
  ctx.beginPath();
  ctx.arc(bx, by, r, 0, Math.PI * 2);
  ctx.fillStyle = '#eef3fa';
  ctx.fill();
  ctx.lineWidth = Math.max(2, s * 0.05);
  ctx.strokeStyle = info.color;
  ctx.stroke();
  ctx.fillStyle = '#0b121c';
  ctx.font = `900 ${r * 1.15}px "Noto Sans JP", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(info.badge), bx, by + r * 0.05);
  ctx.restore();
};
