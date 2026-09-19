import Matter from 'matter-js';
import { getStage, type KanaChar } from './stages';
import { spawnPoolFor } from './progress';
import { burst, drawParticles, updateParticles, type Particle } from './particles';
import { drawJellyBall } from './draw';
import { speakKana, unlockSpeech } from './speech';
import { playDrop, playFinish, playMerge, unlockSfx } from './sfx';
import { preloadClips } from './voiceClips';

export const FIELD_W = 420;
export const FIELD_H = 660;
const WALL = 60;
const TOP_LINE = 118; // このラインを一定時間超えたら Finish
const PREVIEW_Y = 62;
const DROP_COOLDOWN = 380;
const OVER_GRACE = 1600; // ms
const FIXED_STEP = 1000 / 60; // 物理は固定ステップ（端末のfpsで挙動を変えない）
const BEST_KEY = 'kanapop.best';
const SESSION_KEY = 'kanapop.session';
const SESSION_VERSION = 3;

type SavedBall = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  angularVelocity: number;
  level: number;
};

type SavedSession = {
  version: number;
  stageId: number;
  score: number;
  nextLevel: number;
  unlocked: number;
  balls: SavedBall[];
};

function loadSession(): SavedSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<SavedSession>;
    if (saved.version !== SESSION_VERSION || !Number.isInteger(saved.stageId) || !Number.isFinite(saved.score) || !Number.isInteger(saved.nextLevel)
      || !Number.isInteger(saved.unlocked) || !Array.isArray(saved.balls)) return null;
    return saved as SavedSession;
  } catch {
    return null;
  }
}

export function loadSavedStage(): number | null {
  return loadSession()?.stageId ?? null;
}

export function clearSavedSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* 保存できない環境でもゲームは続行する */
  }
}

/** localStorage はプライベートブラウズや埋め込みで例外を投げるため必ず包む */
export function loadBest(): number {
  try {
    const v = Number(localStorage.getItem(BEST_KEY));
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch {
    return 0;
  }
}

function saveBest(v: number) {
  try {
    localStorage.setItem(BEST_KEY, String(v));
  } catch {
    /* 保存できない環境でもゲームは続行する */
  }
}

type Plugin = {
  level: number;
  born: number;
  pop: number;
  merging: boolean;
  clearUntil?: number;
  clearX?: number;
  clearY?: number;
};
const plug = (b: Matter.Body) => b.plugin as unknown as Plugin;

export type GameCallbacks = {
  onScore: (score: number) => void;
  onNext: (level: number) => void;
  onFinish: (score: number, best: number) => void;
  onFirstInteract: () => void;
  onUnlockLevel: (level: number) => void;
  onExp: (gain: number) => void;
  onStageClear: () => void;
};

export class KanaGame {
  private engine = Matter.Engine.create();
  private runnerId = 0;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private score = 0;
  private chars: KanaChar[] = getStage(1).chars;
  private spawnPool = spawnPoolFor(1);
  private challengeMode = false;
  private spawnBag: number[] = [];
  private recentSpawns: number[] = [];
  private openingSpawns: number[] = [];
  private nextLevel = this.spawnPool[0];
  private aimX = FIELD_W / 2;
  private pointerDown = false;
  private lastDrop = 0;
  private overTime = 0;
  private finished = false;
  private interacted = false;
  private lastFrame = 0;
  private accumulator = 0;
  private confettiT = 0;
  private stageId = 1;
  private unlocked = 0;
  private lastSave = 0;
  private stagePopTimer: number | null = null;
  private stageClearInProgress = false;
  private sessionSaveSuspended = false;
  private tiltX = 0;
  private tiltEnabled = false;
  private tiltNeutral: number | null = null;
  private cb: GameCallbacks;

  constructor(cb: GameCallbacks) {
    this.cb = cb;
    this.engine.gravity.y = 1.1;
    this.nextLevel = this.rollSpawn();
  }

  /** プレイヤーレベルに応じて出現する文字の種類を増やす（＝難易度カーブ） */
  setPlayerLevel(playerLevel: number) {
    this.spawnPool = this.poolFor(playerLevel);
    this.resetSpawnSequence();
    this.nextLevel = this.rollSpawn();
    this.cb.onNext(this.nextLevel);
  }

  /** チャレンジでは、最終文字の一つ前までを同じ頻度で出して判断を増やす。 */
  setChallengeMode(enabled: boolean, playerLevel: number) {
    this.challengeMode = enabled;
    this.spawnPool = this.poolFor(playerLevel);
    this.resetSpawnSequence();
    this.nextLevel = this.rollSpawn();
    this.cb.onNext(this.nextLevel);
  }

  /** 遊ぶ行セット（ステージ）を切り替える。盤面はリセットされる */
  setStage(stageId: number, preserveSession = false) {
    this.stageId = stageId;
    this.chars = getStage(stageId).chars;
    this.restart(!preserveSession);
  }

  private get maxLevel() {
    return this.chars.length - 1;
  }

  private poolFor(playerLevel: number) {
    if (!this.challengeMode) return spawnPoolFor(playerLevel);
    return Array.from({ length: Math.max(1, this.maxLevel) }, (_, level) => level);
  }

  private rollSpawn() {
    if (this.openingSpawns.length > 0) {
      const v = this.openingSpawns.shift()!;
      this.recentSpawns.push(v);
      if (this.recentSpawns.length > 2) this.recentSpawns.shift();
      return Math.min(v, this.maxLevel);
    }
    if (this.spawnBag.length === 0) {
      this.spawnBag = [...this.spawnPool];
      for (let i = this.spawnBag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.spawnBag[i], this.spawnBag[j]] = [this.spawnBag[j], this.spawnBag[i]];
      }
    }
    const repeatedTwice = this.recentSpawns.length === 2 && this.recentSpawns[0] === this.recentSpawns[1];
    const alternate = repeatedTwice ? this.spawnBag.findIndex((level) => level !== this.recentSpawns[1]) : 0;
    const v = this.spawnBag.splice(Math.max(0, alternate), 1)[0];
    this.recentSpawns.push(v);
    if (this.recentSpawns.length > 2) this.recentSpawns.shift();
    return Math.min(v, this.maxLevel); // 段階数が少ないステージでもはみ出さない
  }

  /** 開始直後は各文字を1回ずつ出し、それ以降は合体しやすい重み付き抽選にする。 */
  private resetSpawnSequence() {
    this.spawnBag = [];
    this.recentSpawns = [];
    this.openingSpawns = [...new Set(this.spawnPool)];
    for (let i = this.openingSpawns.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.openingSpawns[i], this.openingSpawns[j]] = [this.openingSpawns[j], this.openingSpawns[i]];
    }
  }

  mount(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resize();

    const o = { isStatic: true, restitution: 0.1, friction: 0.7 };
    Matter.Composite.add(this.engine.world, [
      Matter.Bodies.rectangle(FIELD_W / 2, FIELD_H + WALL / 2 - 6, FIELD_W, WALL, o),
      Matter.Bodies.rectangle(-WALL / 2 + 6, FIELD_H / 2, WALL, FIELD_H * 2, o),
      Matter.Bodies.rectangle(FIELD_W + WALL / 2 - 6, FIELD_H / 2, WALL, FIELD_H * 2, o),
    ]);

    Matter.Events.on(this.engine, 'collisionStart', this.onCollide);
    Matter.Events.on(this.engine, 'collisionActive', this.onCollide);

    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onUp);
    window.addEventListener('resize', this.resize);
    window.addEventListener('pagehide', this.saveSession);

    this.cb.onNext(this.nextLevel);
    this.lastFrame = performance.now();
    this.loop(this.lastFrame);
  }

  destroy() {
    cancelAnimationFrame(this.runnerId);
    this.canvas?.removeEventListener('pointerdown', this.onDown);
    this.canvas?.removeEventListener('pointermove', this.onMove);
    this.canvas?.removeEventListener('pointerup', this.onUp);
    this.canvas?.removeEventListener('pointercancel', this.onUp);
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('pagehide', this.saveSession);
    if (this.stagePopTimer !== null) window.clearTimeout(this.stagePopTimer);
    this.disableTilt();
    Matter.Events.off(this.engine, 'collisionStart', this.onCollide);
    Matter.Events.off(this.engine, 'collisionActive', this.onCollide);
    Matter.World.clear(this.engine.world, false);
    Matter.Engine.clear(this.engine);
  }

  restart(clearSaved = true) {
    if (this.stagePopTimer !== null) {
      window.clearTimeout(this.stagePopTimer);
      this.stagePopTimer = null;
    }
    this.stageClearInProgress = false;
    this.sessionSaveSuspended = false;
    for (const b of Matter.Composite.allBodies(this.engine.world)) {
      if (!b.isStatic) Matter.Composite.remove(this.engine.world, b);
    }
    this.particles.length = 0;
    this.pointerDown = false;
    this.lastDrop = 0;
    this.score = 0;
    this.overTime = 0;
    this.accumulator = 0;
    this.finished = false;
    this.confettiT = 0;
    this.unlocked = 0;
    this.resetSpawnSequence();
    if (clearSaved) clearSavedSession();
    this.nextLevel = this.rollSpawn();
    this.cb.onScore(0);
    this.cb.onNext(this.nextLevel);
  }

  /** 次ステージへ移るまで、完了済み旧盤面を保存・復元させない。 */
  prepareStageAdvance() {
    this.sessionSaveSuspended = true;
    clearSavedSession();
  }

  /** 端末の傾きを横方向の重力として使う。iPhone はこの呼び出し時に許可を求める。 */
  async enableTilt(): Promise<boolean> {
    const Orientation = window.DeviceOrientationEvent as (typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    }) | undefined;
    try {
      if (!Orientation) return false;
      if (Orientation.requestPermission && await Orientation.requestPermission() !== 'granted') return false;
      this.tiltX = 0;
      this.tiltNeutral = null;
      this.engine.gravity.x = 0;
      window.addEventListener('deviceorientation', this.onOrientation);
      window.addEventListener('deviceorientationabsolute', this.onOrientation);
      this.tiltEnabled = true;
      return true;
    } catch {
      return false;
    }
  }

  disableTilt() {
    this.tiltEnabled = false;
    this.tiltNeutral = null;
    this.tiltX = 0;
    this.engine.gravity.x = 0;
    window.removeEventListener('deviceorientation', this.onOrientation);
    window.removeEventListener('deviceorientationabsolute', this.onOrientation);
  }

  restoreSession(): boolean {
    const saved = loadSession();
    if (!saved || saved.stageId !== this.stageId || saved.balls.length === 0) return false;
    if (saved.nextLevel < 0 || saved.nextLevel > this.maxLevel || saved.unlocked < 0 || saved.unlocked > this.maxLevel) {
      clearSavedSession();
      return false;
    }
    for (const b of Matter.Composite.allBodies(this.engine.world)) {
      if (!b.isStatic) Matter.Composite.remove(this.engine.world, b);
    }
    const balls: Matter.Body[] = [];
    for (const ball of saved.balls) {
      if (!Number.isInteger(ball.level) || ball.level < 0 || ball.level > this.maxLevel
        || !Number.isFinite(ball.x) || !Number.isFinite(ball.y) || !Number.isFinite(ball.vx) || !Number.isFinite(ball.vy)) {
        clearSavedSession();
        return false;
      }
      const body = this.makeBall(Math.max(0, Math.min(FIELD_W, ball.x)), Math.max(0, Math.min(FIELD_H, ball.y)), ball.level);
      Matter.Body.setVelocity(body, { x: ball.vx, y: ball.vy });
      Matter.Body.setAngle(body, Number.isFinite(ball.angle) ? ball.angle : 0);
      Matter.Body.setAngularVelocity(body, Number.isFinite(ball.angularVelocity) ? ball.angularVelocity : 0);
      balls.push(body);
    }
    Matter.Composite.add(this.engine.world, balls);
    this.score = saved.score;
    this.nextLevel = saved.nextLevel;
    this.unlocked = saved.unlocked;
    this.finished = false;
    this.cb.onScore(this.score);
    this.cb.onNext(this.nextLevel);
    this.cb.onUnlockLevel(this.unlocked);
    return true;
  }

  private resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.canvas.width = FIELD_W * dpr;
    this.canvas.height = FIELD_H * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  private toFieldX(e: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    return ((e.clientX - rect.left) / rect.width) * FIELD_W;
  }

  private clampAim(x: number) {
    const r = this.chars[this.nextLevel].radius;
    return Math.max(r + 6, Math.min(FIELD_W - r - 6, x));
  }

  private onDown = (e: PointerEvent) => {
    if (this.finished) return;
    unlockSpeech();
    unlockSfx();
    preloadClips(this.chars.map((char) => char.romaji));
    this.pointerDown = true;
    this.aimX = this.clampAim(this.toFieldX(e));
    this.canvas.setPointerCapture(e.pointerId);
  };

  private onMove = (e: PointerEvent) => {
    if (!this.pointerDown || this.finished) return;
    this.aimX = this.clampAim(this.toFieldX(e));
  };

  private onUp = (e: PointerEvent) => {
    const wasDown = this.pointerDown;
    this.pointerDown = false; // 終了中でも押下状態は必ず解除する
    if (!wasDown || this.finished) return;
    this.aimX = this.clampAim(this.toFieldX(e));
    this.drop();
    if (!this.interacted) {
      this.interacted = true;
      this.cb.onFirstInteract();
    }
  };

  private drop() {
    const now = performance.now();
    if (now - this.lastDrop < DROP_COOLDOWN) return;
    this.lastDrop = now;
    const level = this.nextLevel;
    Matter.Composite.add(this.engine.world, this.makeBall(this.aimX, PREVIEW_Y, level));
    playDrop();
    speakKana(this.chars[level].kana, { romaji: this.chars[level].romaji });
    this.nextLevel = this.rollSpawn();
    this.cb.onNext(this.nextLevel);
  }

  private makeBall(x: number, y: number, level: number) {
    const c = this.chars[level];
    const body = Matter.Bodies.circle(x, y, c.radius, {
      restitution: 0.16,
      friction: 0.55,
      frictionStatic: 0.7,
      density: 0.0011,
      slop: 0.02,
    });
    const p: Plugin = { level, born: performance.now(), pop: 0, merging: false };
    body.plugin = p;
    return body;
  }

  private onCollide = (e: Matter.IEventCollision<Matter.Engine>) => {
    for (const pair of e.pairs) {
      const a = pair.bodyA;
      const b = pair.bodyB;
      if (a.isStatic || b.isStatic) continue;
      const pa = plug(a);
      const pb = plug(b);
      if (!pa || !pb || pa.merging || pb.merging) continue;
      if (pa.level !== pb.level || pa.level >= this.maxLevel) continue;
      pa.merging = true;
      pb.merging = true;
      this.merge(a, b, pa.level + 1);
    }
  };

  /** 衝突と同フレームで発声・エフェクト（0.1秒以内の即時強化） */
  private merge(a: Matter.Body, b: Matter.Body, nextLevel: number) {
    const x = (a.position.x + b.position.x) / 2;
    const y = (a.position.y + b.position.y) / 2;
    Matter.Composite.remove(this.engine.world, a);
    Matter.Composite.remove(this.engine.world, b);

    const isMax = nextLevel >= this.maxLevel;
    const body = this.makeBall(x, y, nextLevel);
    plug(body).pop = 1;
    Matter.Composite.add(this.engine.world, body);

    playMerge(nextLevel, isMax);
    speakKana(this.chars[nextLevel].kana, { excited: isMax, romaji: this.chars[nextLevel].romaji });
    burst(this.particles, x, y, isMax ? 2.2 : 1);

    this.score += (nextLevel + 1) * 10;
    this.cb.onScore(this.score);
    this.unlocked = Math.max(this.unlocked, nextLevel);
    this.cb.onUnlockLevel(nextLevel);
    this.cb.onExp(nextLevel + 1); // 大きい文字ほど経験値が多い
    if (isMax && this.stageClearInProgress) {
      // 同フレームに複数完成しても、チャレンジ回数は1回分だけにする。
      Matter.Composite.remove(this.engine.world, body);
      return;
    }

    if (isMax) {
      this.stageClearInProgress = true;
      const p = plug(body);
      p.clearUntil = performance.now() + 420;
      p.clearX = x;
      p.clearY = y;
      body.isSensor = true;
      Matter.Body.setVelocity(body, { x: 0, y: 0 });
      this.cb.onStageClear();
      // 最終文字は完成のごほうびとして弾けて消え、次の周回の盤面を圧迫しない。
      if (this.stagePopTimer !== null) window.clearTimeout(this.stagePopTimer);
      this.stagePopTimer = window.setTimeout(() => {
        Matter.Composite.remove(this.engine.world, body);
        this.stagePopTimer = null;
        this.stageClearInProgress = false;
        this.saveSession();
      }, 420);
    }
  }

  private step(dt: number) {
    // 実時間を固定ステップに割り、低fps端末でもスローモーションにしない（最大5ステップ）
    this.accumulator = Math.min(this.accumulator + dt * 1000, FIXED_STEP * 5);
    while (this.accumulator >= FIXED_STEP) {
      Matter.Engine.update(this.engine, FIXED_STEP);
      this.accumulator -= FIXED_STEP;
    }
    updateParticles(this.particles, dt);

    const now = performance.now();

    if (now - this.lastSave > 1000) {
      this.saveSession();
      this.lastSave = now;
    }

    let over = false;
    for (const b of Matter.Composite.allBodies(this.engine.world)) {
      if (b.isStatic) continue;
      const p = plug(b);
      if (p.clearUntil && now < p.clearUntil) {
        Matter.Body.setPosition(b, { x: p.clearX!, y: p.clearY! });
        Matter.Body.setVelocity(b, { x: 0, y: 0 });
        continue;
      }
      p.pop = Math.max(0, p.pop - dt * 3.2);
      if (now - p.born > 900 && b.position.y - this.chars[p.level].radius < TOP_LINE) over = true;
    }
    this.overTime = over ? this.overTime + dt * 1000 : 0;
    if (!this.finished && this.overTime > OVER_GRACE) this.finish();
  }

  private finish() {
    this.finished = true;
    clearSavedSession();
    const best = Math.max(this.score, loadBest());
    saveBest(best);
    playFinish();
    for (let i = 0; i < 4; i++) {
      burst(this.particles, FIELD_W * (0.2 + 0.2 * i), FIELD_H * 0.4, 1.4);
    }
    this.cb.onFinish(this.score, best);
  }

  private loop = (t: number) => {
    this.runnerId = requestAnimationFrame(this.loop);
    const dt = Math.min((t - this.lastFrame) / 1000, 0.05);
    this.lastFrame = t;
    if (!this.finished) {
      this.step(dt);
    } else {
      updateParticles(this.particles, dt);
      this.confettiT += dt;
      if (this.confettiT > 0.55) {
        this.confettiT = 0;
        burst(this.particles, Math.random() * FIELD_W, -10, 1.1);
      }
    }
    this.render(t);
  };

  private onOrientation = (event: DeviceOrientationEvent) => {
    if (!this.tiltEnabled || (event.gamma === null && event.beta === null)) return;
    const fallbackAngle = (window as Window & { orientation?: number }).orientation ?? 0;
    const rawAngle = screen.orientation?.angle ?? fallbackAngle;
    const angle = rawAngle === -90 ? 270 : rawAngle;
    const gamma = event.gamma ?? 0;
    const beta = event.beta ?? 0;
    const lateral = angle === 90 ? beta : angle === 270 ? -beta : gamma;
    if (this.tiltNeutral === null) {
      this.tiltNeutral = lateral;
      return;
    }
    const target = Math.max(-0.85, Math.min(0.85, (lateral - this.tiltNeutral) / 18));
    this.tiltX += (target - this.tiltX) * 0.18;
    this.engine.gravity.x = Math.abs(this.tiltX) < 0.035 ? 0 : this.tiltX;
  };

  private saveSession = () => {
    if (this.finished || this.sessionSaveSuspended) return;
    const balls = Matter.Composite.allBodies(this.engine.world)
      .filter((body) => !body.isStatic && !plug(body).clearUntil)
      .map((body): SavedBall => ({
        x: body.position.x,
        y: body.position.y,
        vx: body.velocity.x,
        vy: body.velocity.y,
        angle: body.angle,
        angularVelocity: body.angularVelocity,
        level: plug(body).level,
      }));
    if (balls.length === 0) {
      clearSavedSession();
      return;
    }
    try {
      const saved: SavedSession = { version: SESSION_VERSION, stageId: this.stageId, score: this.score, nextLevel: this.nextLevel, unlocked: this.unlocked, balls };
      localStorage.setItem(SESSION_KEY, JSON.stringify(saved));
    } catch {
      /* 保存できない環境でもゲームは続行する */
    }
  };

  private render(t: number) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, FIELD_W, FIELD_H);

    // ドロップボックス（すりガラス調の枠）
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    roundRect(ctx, 6, 30, FIELD_W - 12, FIELD_H - 36, 28);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.stroke();
    ctx.restore();

    // 上限ライン（赤やバツは使わず、やさしいラベンダーの点線がそっと光るだけ）
    const danger = Math.min(1, this.overTime / OVER_GRACE);
    ctx.save();
    ctx.setLineDash([10, 10]);
    ctx.lineWidth = 2 + danger * 2;
    ctx.strokeStyle = 'rgba(170, 140, 220, ' + (0.25 + danger * 0.45 + Math.sin(t / 220) * 0.12 * danger) + ')';
    ctx.beginPath();
    ctx.moveTo(18, TOP_LINE);
    ctx.lineTo(FIELD_W - 18, TOP_LINE);
    ctx.stroke();
    ctx.restore();

    // 落下ガイド & プレビューボール
    if (!this.finished) {
      const r = this.chars[this.nextLevel].radius;
      ctx.save();
      ctx.setLineDash([6, 12]);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(this.aimX, PREVIEW_Y + r);
      ctx.lineTo(this.aimX, FIELD_H - 20);
      ctx.stroke();
      ctx.restore();
      const bob = this.pointerDown ? 0 : Math.sin(t / 420) * 3;
      drawJellyBall(ctx, this.aimX, PREVIEW_Y + bob, this.chars[this.nextLevel], { alpha: 0.96 });
    }

    // ボール本体
    for (const b of Matter.Composite.allBodies(this.engine.world)) {
      if (b.isStatic) continue;
      const p = plug(b);
      const pop = popCurve(p.pop);
      const clearProgress = p.clearUntil
        ? Math.max(0, Math.min(1, 1 - (p.clearUntil - t) / 420))
        : 0;
      drawJellyBall(ctx, b.position.x, b.position.y, this.chars[p.level], {
        scale: 1 + 0.2 * pop + 0.32 * Math.sin(clearProgress * Math.PI),
        squash: -0.05 * pop - 0.08 * Math.sin(clearProgress * Math.PI),
        alpha: 1 - clearProgress * 0.65,
      });
    }

    drawParticles(ctx, this.particles);
  }
}

/** pop=1 でポンと膨らみ、0 へ滑らかに戻る */
function popCurve(v: number) {
  return v <= 0 ? 0 : Math.sin(v * Math.PI * 0.9);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
