import { shade, type KanaChar } from './stages';

/**
 * ぷるぷるジェリー文字ボール。
 * 放射グラデ + 右上/左上の白ツヤ + 下部インナーシャドウ + 点目/チーク + かな/ローマ字。
 */
export function drawJellyBall(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  c: KanaChar,
  opts: { scale?: number; alpha?: number; squash?: number; finalTier?: 0 | 1 | 2 | 3 } = {},
) {
  const scale = opts.scale ?? 1;
  const alpha = opts.alpha ?? 1;
  const squash = opts.squash ?? 0; // 落下/衝突時のぷるぷる
  const r = c.radius * scale;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(1 + squash, 1 - squash);

  // 接地影
  ctx.save();
  ctx.globalAlpha = alpha * 0.10;
  ctx.fillStyle = '#7A5B86';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.82, r * 0.78, r * 0.2, 0, 0, Math.PI * 2);
  ctx.filter = 'blur(2px)';
  ctx.fill();
  ctx.restore();

  // 本体（放射グラデーション）
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.1, 0, r * 0.1, r * 1.15);
  g.addColorStop(0, shade(c.base, 0.7));
  g.addColorStop(0.42, shade(c.base, 0.12));
  g.addColorStop(1, shade(c.base, -0.1));
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.shadowColor = 'rgba(165, 130, 190, 0.18)';
  ctx.shadowBlur = r * 0.22;
  ctx.shadowOffsetY = r * 0.12;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // 下部インナーシャドウ（立体感）
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip();
  const inner = ctx.createRadialGradient(0, r * 0.45, r * 0.35, 0, r * 0.45, r * 1.35);
  inner.addColorStop(0, 'rgba(0,0,0,0)');
  inner.addColorStop(1, 'rgba(150, 105, 160, 0.16)');
  ctx.fillStyle = inner;
  ctx.fillRect(-r, -r, r * 2, r * 2);
  // 縁のリムライト
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = Math.max(1.5, r * 0.06);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.99, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
  ctx.restore();

  // 白いオーバル型ツヤ 2箇所（右上・左上）
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.38, -r * 0.5, r * 0.26, r * 0.15, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = alpha * 0.6;
  ctx.beginPath();
  ctx.ellipse(r * 0.42, -r * 0.42, r * 0.15, r * 0.09, 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // チーク
  ctx.save();
  ctx.globalAlpha = alpha * 0.5;
  ctx.fillStyle = '#FF8FB0';
  ctx.beginPath();
  ctx.ellipse(-r * 0.52, r * 0.18, r * 0.16, r * 0.11, 0, 0, Math.PI * 2);
  ctx.ellipse(r * 0.52, r * 0.18, r * 0.16, r * 0.11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 点目 + うるうるハイライト
  const eyeY = -r * 0.06;
  const eyeX = r * 0.46;
  const eyeR = Math.max(1.6, r * 0.075);
  ctx.fillStyle = '#5A4152';
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(sx * eyeX, eyeY, eyeR, eyeR * 1.15, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(sx * eyeX - eyeR * 0.3, eyeY - eyeR * 0.4, eyeR * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }

  // かな（中央）
  ctx.fillStyle = 'rgba(105, 72, 98, 0.95)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const kanaSize = c.kana.length > 1 ? r * 0.58 : r * 0.82; // 拗音は2文字なので詰める
  ctx.font = `700 ${kanaSize}px "Zen Maru Gothic", "M PLUS Rounded 1c", sans-serif`;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = r * 0.12;
  ctx.lineJoin = 'round';
  ctx.strokeText(c.kana, 0, -r * 0.02);
  ctx.fillText(c.kana, 0, -r * 0.02);

  // ローマ字（直下）
  ctx.font = `700 ${Math.max(8, r * 0.3)}px "M PLUS Rounded 1c", sans-serif`;
  ctx.fillStyle = 'rgba(120, 88, 115, 0.85)';
  ctx.lineWidth = r * 0.06;
  ctx.strokeText(c.romaji, 0, r * 0.56);
  ctx.fillText(c.romaji, 0, r * 0.56);

  if (opts.finalTier === 1) {
    ctx.save();
    ctx.strokeStyle = '#FFCB4D';
    ctx.fillStyle = '#FFF4A5';
    ctx.lineWidth = Math.max(2, r * 0.06);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2);
    ctx.stroke();
    for (const sx of [-0.42, 0, 0.42]) {
      ctx.beginPath();
      ctx.moveTo(sx * r, -r * 1.22);
      ctx.lineTo((sx - 0.09) * r, -r * 1.03);
      ctx.lineTo((sx + 0.09) * r, -r * 1.03);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // 小さい線画だけでは変化が伝わりにくいため、段階を大きな記号でも明示する。
    ctx.font = `${Math.max(24, r * 0.72)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('👑', 0, -r * 1.08);
    ctx.restore();
  }

  if (opts.finalTier === 2) {
    ctx.save();
    ctx.strokeStyle = '#76DDF3';
    ctx.fillStyle = '#D8FAFF';
    ctx.lineWidth = Math.max(2, r * 0.06);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.36);
    ctx.lineTo(r * 0.2, -r * 1.12);
    ctx.lineTo(0, -r * 0.88);
    ctx.lineTo(-r * 0.2, -r * 1.12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.font = `${Math.max(22, r * 0.62)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💎', 0, -r * 1.08);
    ctx.restore();
  }

  if (opts.finalTier === 3) {
    ctx.save();
    const ring = ctx.createLinearGradient(-r, -r, r, r);
    ring.addColorStop(0, '#FF92B6');
    ring.addColorStop(0.28, '#FFD56E');
    ring.addColorStop(0.52, '#91E7B5');
    ring.addColorStop(0.76, '#8ACCF6');
    ring.addColorStop(1, '#CBA4F4');
    ctx.strokeStyle = ring;
    ctx.lineWidth = Math.max(4, r * 0.16);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.94, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = Math.max(1.5, r * 0.035);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.font = `${Math.max(16, r * 0.5)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🌈', 0, -r * 1.18);
    ctx.restore();
  }

  ctx.restore();
}
