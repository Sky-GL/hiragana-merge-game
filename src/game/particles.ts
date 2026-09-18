export type ParticleKind = 'heart' | 'star' | 'bubble';

export type Particle = {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number;
  size: number; rot: number; vr: number;
  kind: ParticleKind; color: string;
};

const PALETTE = ['#FF9EC4', '#FFD59E', '#FFF6A8', '#B7F2D6', '#C4DFFF', '#E0C8FF', '#FFFFFF'];

export function burst(list: Particle[], x: number, y: number, power = 1) {
  const count = 15 + Math.floor(Math.random() * 6); // 15〜20個
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const sp = (2.4 + Math.random() * 3.6) * power;
    const kind: ParticleKind = i % 3 === 0 ? 'heart' : i % 3 === 1 ? 'star' : 'bubble';
    list.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 1.2,
      life: 1, maxLife: 0.6 + Math.random() * 0.4,
      size: (5 + Math.random() * 7) * power,
      rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
      kind,
      color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
    });
  }
}

export function updateParticles(list: Particle[], dt: number) {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.x += p.vx; p.y += p.vy;
    p.vy += 0.18;      // 軽い重力
    p.vx *= 0.98; p.vy *= 0.98;
    p.rot += p.vr;
    p.life -= dt / p.maxLife;
    if (p.life <= 0) list.splice(i, 1);
  }
}

export function drawParticles(ctx: CanvasRenderingContext2D, list: Particle[]) {
  for (const p of list) {
    const a = Math.max(0, Math.min(1, p.life));
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    const s = p.size * (0.6 + a * 0.6);
    if (p.kind === 'heart') drawHeart(ctx, s);
    else if (p.kind === 'star') drawSparkle(ctx, s);
    else {
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawHeart(ctx: CanvasRenderingContext2D, s: number) {
  const r = s * 0.5;
  ctx.beginPath();
  ctx.moveTo(0, r * 0.55);
  ctx.bezierCurveTo(-r * 1.3, -r * 0.5, -r * 0.45, -r * 1.35, 0, -r * 0.45);
  ctx.bezierCurveTo(r * 0.45, -r * 1.35, r * 1.3, -r * 0.5, 0, r * 0.55);
  ctx.closePath();
  ctx.fill();
}

/** 4点キラキラ星 */
function drawSparkle(ctx: CanvasRenderingContext2D, s: number) {
  const r = s * 0.6, w = s * 0.16;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.quadraticCurveTo(w, -w, r, 0);
  ctx.quadraticCurveTo(w, w, 0, r);
  ctx.quadraticCurveTo(-w, w, -r, 0);
  ctx.quadraticCurveTo(-w, -w, 0, -r);
  ctx.closePath();
  ctx.fill();
}
