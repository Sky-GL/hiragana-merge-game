// 「気持ちよさ」の演出(画面の揺れ・浮き上がる得点・衝撃波・フラッシュ)とコンボ倍率。
// ゲームのルールには関与しない(見た目だけ)。

export const COMBO_STEP = 3; // 3コンボごとに倍率が上がる
export const MAX_MULT = 5;
export const comboMult = (combo: number) => Math.min(MAX_MULT, 1 + Math.floor(combo / COMBO_STEP));

// 倍率ごとの色(×1=白 → ×5=紫)。得点の浮き上がりや衝撃波、盤面の枠の光に使う
export const MULT_COLORS = ['#ffffff', '#ffffff', '#ffd966', '#ff9a2e', '#ff5a5a', '#e0409a'];

// OSの「視差効果を減らす」設定の人には、揺れと振動を出さない
export const reducedMotion = () => {
  try {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

export const buzz = (pattern: number | number[]) => {
  try {
    if (!reducedMotion()) navigator.vibrate?.(pattern);
  } catch {
    /* 非対応端末では何もしない */
  }
};

type Popup = { x: number; y: number; text: string; color: string; size: number; life: number };
type Wave = { x: number; y: number; max: number; color: string; life: number };

export class Fx {
  popups: Popup[] = [];
  waves: Wave[] = [];
  shakeMag = 0;
  flashA = 0;
  flashColor = '#ffffff';
  reduced = reducedMotion();

  clear() {
    this.popups.length = 0;
    this.waves.length = 0;
    this.shakeMag = 0;
    this.flashA = 0;
  }

  /** 浮き上がる文字(+30 など) */
  popup(x: number, y: number, text: string, color = '#fff', size = 20) {
    this.popups.push({ x, y, text, color, size, life: 1 });
  }

  /** 広がる衝撃波のリング */
  wave(x: number, y: number, max: number, color = '#fff') {
    this.waves.push({ x, y, max, color, life: 1 });
  }

  shake(mag: number) {
    if (!this.reduced) this.shakeMag = Math.max(this.shakeMag, mag);
  }

  flash(alpha: number, color = '#ffffff') {
    this.flashA = Math.max(this.flashA, alpha);
    this.flashColor = color;
  }

  step(dt: number) {
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.y -= 46 * dt;
      p.life -= dt / 0.95;
      if (p.life <= 0) this.popups.splice(i, 1);
    }
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i];
      w.life -= dt / 0.45;
      if (w.life <= 0) this.waves.splice(i, 1);
    }
    this.shakeMag *= Math.pow(0.0008, dt); // 約0.3秒でほぼ収まる
    if (this.shakeMag < 0.2) this.shakeMag = 0;
    this.flashA = Math.max(0, this.flashA - dt * 2.4);
  }

  /** 描画の前後で呼ぶ。盤面全体を揺らす */
  beginShake(ctx: CanvasRenderingContext2D) {
    ctx.save();
    if (this.shakeMag > 0) ctx.translate((Math.random() - 0.5) * 2 * this.shakeMag, (Math.random() - 0.5) * 2 * this.shakeMag);
  }

  endShake(ctx: CanvasRenderingContext2D) {
    ctx.restore();
  }

  drawWaves(ctx: CanvasRenderingContext2D) {
    for (const w of this.waves) {
      const k = 1 - w.life;
      ctx.save();
      ctx.globalAlpha = Math.max(0, w.life) * 0.8;
      ctx.strokeStyle = w.color;
      ctx.lineWidth = 2 + 5 * w.life;
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.max * (0.25 + 0.75 * k), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawPopups(ctx: CanvasRenderingContext2D) {
    for (const p of this.popups) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, p.life * 1.6);
      const s = p.size * (1 + 0.35 * Math.max(0, p.life - 0.8) * 5); // 出だしだけ少し大きく弾む
      ctx.font = `900 ${s}px system-ui, -apple-system, "Segoe UI", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(3, s * 0.2);
      ctx.strokeStyle = 'rgba(5, 9, 16, 0.92)';
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
      ctx.restore();
    }
  }

  drawFlash(ctx: CanvasRenderingContext2D, w: number, h: number) {
    if (this.flashA <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = Math.min(0.6, this.flashA);
    ctx.fillStyle = this.flashColor;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}
