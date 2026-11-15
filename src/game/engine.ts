import Matter from 'matter-js';
import type { KanaChar, Stage } from './stages';
import { drawJellyBall, type JellyItem } from './draw';
import { burst, drawParticles, updateParticles, type Particle } from './particles';
import { Fx, MULT_COLORS, buzz, comboMult } from './popFx';
import { FINAL_TIERS } from './popFinal';
import { speakChar } from './speech';
import { playFinish, playPopComboUp, playPopDrop, playPopMergeCombo, playPopMiss, playPopSpecial, unlockSfx } from './sfx';
import type { PopMode } from './popStore';

// 「文字メダル」を落として、合体させて次の文字に進化させるマージゲームの本体。
// 物理は matter-js、描画は Canvas。React からは mount()/destroy() とコールバックだけで使う。

const { Engine, Bodies, Composite, Events, World } = Matter;

export const FIELD_W = 420;
export const FIELD_H = 660;
const WALL = 60;
const LINE_Y = 118; // この線より上にメダルがはみ出し続けるとゲームオーバー
const SPAWN_Y = 62;
const DROP_COOLDOWN = 380; // ms
const OVER_MS = 1600;
const STEP = 1000 / 60; // 物理は固定ステップ(端末のfpsで挙動を変えない)
// 読みモード: 色と大きさは全員同じにして、文字そのものを見ないと判別できないようにする。
// 「文字面」(あ)と「読み面」(a)の見分けだけは色で付ける(どの文字かは分からない)。
const READ_R = 32; // 盤面が詰まりやすいので小さめ(40だとボットでも0/6でクリアできなかった)
const GLYPH_BASE = '#FFC6DF'; // 文字面: ピンク
const READ_BASE = '#B9F3CC'; // 読み面: ミント
// 読みモードの最終形は、同じ段階どうしを弱く引き寄せる(質量あたりの加速度 = FINAL_ATTRACT*0.001)。
// 最終形は消えず動かせないので、離れて詰まるとペアが出会えずクリアできなくなるため。
const FINAL_ATTRACT = 0.6;
// ふつうモードのコンボは、この時間内に次の合体が起きないと途切れる(読みモードは時間では途切れない=考える時間を奪わない)
const COMBO_WINDOW = 6000;
const SNAP_GAP = 16; // 最終形は、この距離まで近づけば吸い付いて合体する
// 最終形が育つときの得点: (最後のレベル+1) × この値。🌈になったときは虹ボーナスも加算
const TIER_SCORE = [0, 15, 25, 40];
const RAINBOW_BONUS = 300;

/** 次に降るメダル。face 0=文字面 / 1=読み面 */
export type NextMedal = { level: number; face: 0 | 1 };

export type MissInfo = {
  hadCombo: number;
  dropped: NextMedal;
  other: NextMedal;
};

export type PopCallbacks = {
  onScore: (score: number) => void;
  onNext: (next: NextMedal) => void;
  onFirstInteract: () => void;
  onUnlock: (level: number) => void;
  onCombo: (combo: number, mult: number) => void;
  onMiss: (info: MissInfo) => void;
  onMerge: (level: number) => void;
  /** 最終形が 👑(1)/💎(2)/🌈(3) に進化した */
  onTier: (tier: number, points: number) => void;
  /** 🌈+🌈 が合体してステージクリア */
  onStageClear: () => void;
  /** ゲームオーバー(grand=true は全ステージクリア) */
  onFinish: (score: number, grand: boolean, stats: { maxCombo: number; misses: number }) => void;
};

type Medal = {
  level: number;
  finalTier: number;
  face: 0 | 1;
  born: number;
  pop: number;
  merging: boolean;
  /** 最初に何かに触れるまでは「落としたて」(読み間違いの判定に使う) */
  fresh?: boolean;
};

const medalOf = (b: Matter.Body): Medal | null => {
  const p = b.plugin as Partial<Medal> | undefined;
  return p && typeof p.level === 'number' ? (p as Medal) : null;
};

// ---------- 描画の部品 ----------
const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

const popCurve = (v: number) => (v <= 0 ? 0 : Math.sin(v * Math.PI * 0.9));

// ---------- ゲーム本体 ----------
export class PopEngine {
  private cb: PopCallbacks;
  private pairMode: boolean;
  private chars: KanaChar[];
  private engine = Engine.create();
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private score = 0;
  private aimX = FIELD_W / 2;
  private pointerDown = false;
  private lastDrop = 0;
  private overTime = 0;
  private finished = false;
  private paused = false;
  private stageClearing = false; // 🌈+🌈 が合体した後、次のステージへ移るまでの間
  private interacted = false;
  private accumulator = 0;
  private lastFrame = 0;
  private confettiT = 0;
  private rafId = 0;
  private bag: number[] = []; // 出す順にシャッフルしたメダルの袋(level*2+face)。空になったら詰め直す
  private lastSpawn = -1;
  private fx = new Fx();
  private combo = 0;
  private maxCombo = 0;
  private misses = 0;
  private lastMergeAt = 0;
  private next: NextMedal;
  private tiltX = 0;
  private tiltEnabled = false;
  private tiltNeutral: number | null = null;

  /**
   * @param stage  STAGES の1要素(5文字)
   * @param mode   'normal'=同じ文字どうしが合体(元のかなポップ) / 'read'=文字面+読み面のペアが合体(読む練習)
   */
  constructor(stage: Stage, cb: PopCallbacks, mode: PopMode = 'normal') {
    this.cb = cb;
    this.pairMode = mode === 'read';
    this.chars = stage.chars;
    this.engine.gravity.y = 1.1;
    this.next = this.rollSpawn();
  }

  private get maxLevel() {
    return this.chars.length - 1;
  }

  /**
   * 次に降らせるメダルを決める。学習のため、ステージの文字を「シャッフルした袋」から1周ずつ出す。
   * 1周の間に各文字がちょうど1回ずつ出るので偏らない。最終形(最後の文字)も学習のため文字面で1周に1回降る
   * (合体でしか出ないと、その文字を見る機会が少なくなるため)。
   * 読みモードでは各文字が文字面・読み面の2枚ずつ袋に入る(ペアになる相手が必ず降ってくる)。
   */
  private rollSpawn(): NextMedal {
    if (this.bag.length === 0) {
      const bag: number[] = [];
      for (let lv = 0; lv < this.maxLevel; lv++) {
        bag.push(lv * 2);
        if (this.pairMode) bag.push(lv * 2 + 1);
      }
      bag.push(this.maxLevel * 2); // 最終形は文字面のみ(面を問わず合体するので相手探しは不要)
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      // 袋の継ぎ目で同じメダルが続かないようにする(末尾から取り出す)
      if (bag.length > 1 && bag[bag.length - 1] === this.lastSpawn) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
      this.bag = bag;
    }
    this.lastSpawn = this.bag.pop() as number;
    return { level: this.lastSpawn >> 1, face: (this.lastSpawn & 1) as 0 | 1 };
  }

  /** メダルの半径。読みモードは全員同じ(大きさで文字が分からないように) */
  private rad(level: number) {
    return this.pairMode ? READ_R : this.chars[level].radius;
  }

  /** 描画用のアイテム。読みモードは色を統一し、読み面はローマ字だけを出す */
  private itemFor(level: number, face: number): JellyItem {
    const c = this.chars[level];
    if (!this.pairMode) return c;
    // 読み面はローマ字だけ、文字面はかなだけ。色と大きさは全員同じ
    return { radius: READ_R, base: face ? READ_BASE : GLYPH_BASE, kana: face ? c.romaji : c.kana, romaji: '', latin: !!face };
  }

  /**
   * 合体で生まれるメダルの面を決める。読みモードでは、同じ(level, 段階)の相手が足りない面を出す。
   * 乱数だと最終形が同じ面ばかり揃って、ペアが作れず行き詰まるため。
   */
  private pickFace(level: number, tier: number): 0 | 1 {
    if (!this.pairMode) return 0;
    if (level >= this.maxLevel) return 0; // 最終形は常に文字面(面を問わず合体するので)
    const count = [0, 0];
    for (const b of Composite.allBodies(this.engine.world)) {
      const m = medalOf(b);
      if (!b.isStatic && m && !m.merging && m.level === level && m.finalTier === tier) count[m.face] += 1;
    }
    if (count[0] === count[1]) return Math.random() < 0.5 ? 0 : 1;
    return count[0] < count[1] ? 0 : 1;
  }

  mount(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    this.resize();

    const wall = { isStatic: true, restitution: 0.1, friction: 0.7 };
    Composite.add(this.engine.world, [
      Bodies.rectangle(FIELD_W / 2, FIELD_H + WALL / 2 - 6, FIELD_W, WALL, wall),
      Bodies.rectangle(-WALL / 2 + 6, FIELD_H / 2, WALL, FIELD_H * 2, wall),
      Bodies.rectangle(FIELD_W + WALL / 2 - 6, FIELD_H / 2, WALL, FIELD_H * 2, wall),
    ]);
    Events.on(this.engine, 'collisionStart', this.onCollide);
    Events.on(this.engine, 'collisionActive', this.onCollide);
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onUp);
    window.addEventListener('resize', this.resize);

    // Canvas描画は未ロードのWebフォントを自動では待たないので、先に読み込みを促しておく
    document.fonts?.load('700 40px "Zen Maru Gothic"', 'あア').catch(() => {});

    // 自動テスト用: ?e2e を付けて開いたときだけ、エンジンを window から触れるようにする
    if (new URLSearchParams(window.location.search).has('e2e')) (window as unknown as { __pop?: PopEngine }).__pop = this;

    this.cb.onNext(this.next);
    this.lastFrame = performance.now();
    this.loop(this.lastFrame);
  }

  destroy() {
    cancelAnimationFrame(this.rafId);
    const c = this.canvas;
    c?.removeEventListener('pointerdown', this.onDown);
    c?.removeEventListener('pointermove', this.onMove);
    c?.removeEventListener('pointerup', this.onUp);
    c?.removeEventListener('pointercancel', this.onUp);
    window.removeEventListener('resize', this.resize);
    this.disableTilt();
    Events.off(this.engine, 'collisionStart', this.onCollide);
    Events.off(this.engine, 'collisionActive', this.onCollide);
    World.clear(this.engine.world, false);
    Engine.clear(this.engine);
    const w = window as unknown as { __pop?: PopEngine };
    if (w.__pop === this) delete w.__pop;
  }

  restart() {
    for (const b of Composite.allBodies(this.engine.world)) {
      if (!b.isStatic) Composite.remove(this.engine.world, b);
    }
    this.particles.length = 0;
    this.pointerDown = false;
    this.paused = false;
    this.lastDrop = 0;
    this.score = 0;
    this.overTime = 0;
    this.accumulator = 0;
    this.finished = false;
    this.stageClearing = false;
    this.confettiT = 0;
    this.bag = [];
    this.lastSpawn = -1;
    this.fx.clear();
    this.combo = 0;
    this.maxCombo = 0;
    this.misses = 0;
    this.next = this.rollSpawn();
    this.cb.onScore(0);
    this.cb.onNext(this.next);
    this.cb.onCombo(0, 1);
  }

  pause() {
    if (this.finished || this.paused) return;
    this.paused = true;
    this.pointerDown = false;
  }

  resume() {
    if (this.finished || !this.paused) return;
    this.paused = false;
    this.lastFrame = performance.now();
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

  // ---- 入力 ----
  private resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.canvas.width = FIELD_W * dpr;
    this.canvas.height = FIELD_H * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  private toFieldX(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    return ((e.clientX - r.left) / r.width) * FIELD_W;
  }

  private clampAim(x: number) {
    const r = this.rad(this.next.level);
    return Math.max(r + 6, Math.min(FIELD_W - r - 6, x));
  }

  private onDown = (e: PointerEvent) => {
    if (this.finished || this.stageClearing || this.paused) return;
    // 音声はユーザー操作内でないと鳴らせない環境があるので、ここで解錠する
    unlockSfx();
    this.pointerDown = true;
    this.aimX = this.clampAim(this.toFieldX(e));
    this.canvas.setPointerCapture(e.pointerId);
  };

  private onMove = (e: PointerEvent) => {
    if (!this.pointerDown || this.finished || this.stageClearing || this.paused) return;
    this.aimX = this.clampAim(this.toFieldX(e));
  };

  private onUp = (e: PointerEvent) => {
    const was = this.pointerDown;
    this.pointerDown = false;
    if (!was || this.finished || this.stageClearing || this.paused) return;
    this.aimX = this.clampAim(this.toFieldX(e));
    this.drop();
    if (!this.interacted) {
      this.interacted = true;
      this.cb.onFirstInteract();
    }
  };

  // ---- 物理 ----
  private makeBall(x: number, y: number, level: number, finalTier = 0, face: 0 | 1 = 0) {
    const b = Bodies.circle(x, y, this.rad(level), {
      restitution: 0.16,
      friction: 0.55,
      frictionStatic: 0.7,
      density: 0.0011,
      slop: 0.02,
    });
    const m: Medal = { level, finalTier, face, born: performance.now(), pop: 0, merging: false };
    b.plugin = m;
    return b;
  }

  private drop() {
    if (this.finished || this.stageClearing || this.paused) return;
    const now = performance.now();
    if (now - this.lastDrop < DROP_COOLDOWN) return;
    this.lastDrop = now;
    const { level: lv, face } = this.next;
    const ball = this.makeBall(this.aimX, SPAWN_Y, lv, 0, face);
    (ball.plugin as Medal).fresh = true;
    Composite.add(this.engine.world, ball);
    playPopDrop();
    speakChar(this.chars[lv]);
    this.next = this.rollSpawn();
    this.cb.onNext(this.next);
  }

  private onCollide = (ev: Matter.IEventCollision<Matter.Engine>) => {
    for (const pair of ev.pairs) {
      this.judgeContact(pair.bodyA, pair.bodyB);
      this.tryMergePair(pair.bodyA, pair.bodyB);
    }
  };

  /**
   * 読み間違いの判定(読みモードのみ)。落としたメダルが「最初に触れた相手」だけを見る:
   *  - 反対の面で、別の文字 → 読み間違い(本当の相手が盤面にいるときだけ)
   *  - 同じ文字の反対の面 → 正解のペア(合体する) / 同じ面・壁・床・最終形 → 判定しない
   * 山の中で偶然触れただけで罰しないよう、本当の相手がいない場合や、最初の接触以外は見ない。
   */
  private judgeContact(a: Matter.Body, b: Matter.Body) {
    for (const [x, y] of [[a, b], [b, a]]) {
      const m = medalOf(x);
      if (!m || !m.fresh) continue;
      m.fresh = false;
      const o = medalOf(y);
      if (!this.pairMode || m.merging || y.isStatic || !o || o.merging) continue;
      if (o.level >= this.maxLevel || o.face === m.face || o.level === m.level) continue;
      if (!this.mateExists(x)) continue;
      this.registerMiss(x, y);
    }
  }

  private mateExists(body: Matter.Body) {
    const m = medalOf(body) as Medal;
    return Composite.allBodies(this.engine.world).some((b) => {
      const o = medalOf(b);
      return b !== body && !b.isStatic && !!o && !o.merging && o.finalTier === 0 && o.level === m.level && o.face !== m.face;
    });
  }

  private registerMiss(dropped: Matter.Body, other: Matter.Body) {
    const d = medalOf(dropped) as Medal;
    const o = medalOf(other) as Medal;
    const hadCombo = this.combo;
    this.misses += 1;
    this.breakCombo();
    this.fx.popup(dropped.position.x, dropped.position.y - this.rad(d.level) - 6, '？', '#A98EBE', 26);
    this.fx.shake(2);
    playPopMiss();
    this.cb.onMiss({ hadCombo, dropped: { level: d.level, face: d.face }, other: { level: o.level, face: o.face } });
  }

  /** コンボを1つ進めて、現在の倍率を返す。倍率が上がった瞬間は音と光で知らせる */
  private bumpCombo() {
    const now = performance.now();
    if (!this.pairMode && this.combo > 0 && now - this.lastMergeAt > COMBO_WINDOW) this.combo = 0;
    const before = comboMult(this.combo);
    this.combo += 1;
    this.lastMergeAt = now;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    const mult = comboMult(this.combo);
    this.cb.onCombo(this.combo, mult);
    if (mult > before) {
      playPopComboUp(mult);
      this.fx.flash(0.16 + mult * 0.03, MULT_COLORS[mult]);
      this.fx.popup(FIELD_W / 2, FIELD_H * 0.36, `COMBO ×${mult}!`, MULT_COLORS[mult], 30);
      buzz([10, 25, 14]);
    }
    return mult;
  }

  private breakCombo() {
    if (this.combo === 0) return;
    this.combo = 0;
    this.cb.onCombo(0, 1);
  }

  /**
   * 合体の判定(元の「かなポップ」と同じルール)。
   *  - 同じレベルどうしなら次のレベルに進化
   *  - 最終形は「同じバッジ(finalTier)どうし」だけが合体: 無印→👑→💎→🌈、🌈+🌈 でステージクリア
   */
  private tryMergePair(a: Matter.Body, b: Matter.Body): boolean {
    if (a.isStatic || b.isStatic) return false;
    const ja = medalOf(a);
    const jb = medalOf(b);
    if (!ja || !jb || ja.merging || jb.merging || ja.level !== jb.level) return false;
    // 読みモードは「文字面 + 読み面」のペアだけが合体する(同じ面どうしは合体しない)。
    // ただし最終形(完成した文字)どうしは面を問わず、同じバッジなら合体する
    if (this.pairMode && ja.level < this.maxLevel && ja.face === jb.face) return false;

    if (ja.level >= this.maxLevel) {
      if (ja.level !== this.maxLevel || this.stageClearing || ja.finalTier !== jb.finalTier) return false;
      ja.merging = true;
      jb.merging = true;
      if (ja.finalTier < 3) this.evolveFinalPair(a, b, ja.finalTier + 1);
      else this.clearFinalPair(a, b);
      return true;
    }
    ja.merging = true;
    jb.merging = true;
    this.merge(a, b, ja.level + 1);
    return true;
  }

  /** 同じ段階の最終形どうしを弱く引き寄せる(離れて詰まった最終形が出会えるように) */
  private attractFinals() {
    const fin = Composite.allBodies(this.engine.world).filter((b) => {
      const m = medalOf(b);
      return !b.isStatic && !!m && m.level === this.maxLevel && !m.merging;
    });
    for (let i = 0; i < fin.length; i++) {
      for (let j = i + 1; j < fin.length; j++) {
        const a = fin[i];
        const b = fin[j];
        if ((medalOf(a) as Medal).finalTier !== (medalOf(b) as Medal).finalTier) continue;
        const dx = b.position.x - a.position.x;
        const dy = b.position.y - a.position.y;
        const d = Math.hypot(dx, dy);
        if (d < 1 || d > 260) continue;
        const f = FINAL_ATTRACT * 0.001; // 質量あたりの加速度(重力は 1.1*0.001)
        Matter.Body.applyForce(a, a.position, { x: (dx / d) * f * a.mass, y: (dy / d) * f * a.mass });
        Matter.Body.applyForce(b, b.position, { x: (-dx / d) * f * b.mass, y: (-dy / d) * f * b.mass });
      }
    }
  }

  /** 衝突イベントを取りこぼした分や、最終形どうしが少し離れているときに、近ければ合体させる */
  private snapMerge() {
    const bodies = Composite.allBodies(this.engine.world).filter((b) => !b.isStatic && medalOf(b));
    for (let i = 0; i < bodies.length; i++) {
      const ma = medalOf(bodies[i]) as Medal;
      if (ma.merging) continue;
      for (let j = i + 1; j < bodies.length; j++) {
        const mb = medalOf(bodies[j]) as Medal;
        if (mb.merging || ma.level !== mb.level || ma.finalTier !== mb.finalTier) continue;
        if (this.pairMode && ma.level < this.maxLevel && ma.face === mb.face) continue;
        const touch = this.rad(ma.level) + this.rad(mb.level);
        const limit = ma.level === this.maxLevel ? touch + SNAP_GAP : touch;
        const dx = bodies[i].position.x - bodies[j].position.x;
        const dy = bodies[i].position.y - bodies[j].position.y;
        if (dx * dx + dy * dy <= limit * limit && this.tryMergePair(bodies[i], bodies[j])) return;
      }
    }
  }

  private merge(a: Matter.Body, b: Matter.Body, level: number) {
    const x = (a.position.x + b.position.x) / 2;
    const y = (a.position.y + b.position.y) / 2;
    Composite.remove(this.engine.world, a);
    Composite.remove(this.engine.world, b);

    const isMax = level >= this.maxLevel;
    const ball = this.makeBall(x, y, level, 0, this.pickFace(level, 0));
    (ball.plugin as Medal).pop = 1;
    Composite.add(this.engine.world, ball);

    const mult = this.bumpCombo();
    const points = (level + 1) * 10 * mult;
    playPopMergeCombo(level, isMax, this.combo);
    speakChar(this.chars[level], { excited: isMax });
    burst(this.particles, x, y, (isMax ? 1.6 : 1) + mult * 0.12, mult > 1 ? [MULT_COLORS[mult], '#FFFFFF', '#FFD59E', '#FFC6DF'] : undefined);
    this.fx.wave(x, y, this.rad(level) * 2.4, MULT_COLORS[mult]);
    this.fx.popup(x, y - this.rad(level), mult > 1 ? `+${points} ×${mult}` : `+${points}`, MULT_COLORS[mult], 17 + mult * 2);
    this.fx.shake(1.2 + mult * 0.9 + (isMax ? 2.5 : 0));
    buzz(8);

    this.score += points;
    this.cb.onScore(this.score);
    this.cb.onUnlock(level);
    this.cb.onMerge(level);
  }

  /** 最終形+最終形 → 次の段階(👑/💎/🌈)の最終形 */
  private evolveFinalPair(a: Matter.Body, b: Matter.Body, tier: number) {
    const x = (a.position.x + b.position.x) / 2;
    const y = (a.position.y + b.position.y) / 2;
    Composite.remove(this.engine.world, a);
    Composite.remove(this.engine.world, b);
    const ball = this.makeBall(x, y, this.maxLevel, tier, this.pickFace(this.maxLevel, tier));
    (ball.plugin as Medal).pop = 1;
    Composite.add(this.engine.world, ball);

    const points = (this.maxLevel + 1) * TIER_SCORE[tier] + (tier === 3 ? RAINBOW_BONUS : 0);
    this.score += points;
    this.cb.onScore(this.score);
    this.bumpCombo();
    burst(this.particles, x, y, 1.6 + tier * 0.6, FINAL_TIERS[tier].burst);
    this.fx.wave(x, y, 150, FINAL_TIERS[tier].color);
    this.fx.popup(x, y - 70, `+${points}`, FINAL_TIERS[tier].color, 24);
    this.fx.shake(4 + tier * 2);
    this.fx.flash(0.2 + tier * 0.1, FINAL_TIERS[tier].color);
    buzz([15, 30, 25]);
    playPopSpecial(tier === 1 ? 'crown' : tier === 2 ? 'diamond' : 'rainbow');
    speakChar(this.chars[this.maxLevel], { excited: true });
    this.cb.onTier(tier, points);
  }

  /** 🌈+🌈 → 2つとも消えてステージクリア */
  private clearFinalPair(a: Matter.Body, b: Matter.Body) {
    this.stageClearing = true;
    this.pointerDown = false;
    const x = (a.position.x + b.position.x) / 2;
    const y = (a.position.y + b.position.y) / 2;
    Composite.remove(this.engine.world, a);
    Composite.remove(this.engine.world, b);
    for (let i = 0; i < 3; i++) burst(this.particles, x + (i - 1) * 40, y, 2.6, FINAL_TIERS[3].burst);
    playFinish();
    this.fx.shake(10);
    this.fx.flash(0.5, '#ffffff');
    this.fx.wave(x, y, 220, FINAL_TIERS[3].color);
    buzz([20, 40, 20, 40, 60]);
    speakChar(this.chars[this.maxLevel], { excited: true });
    this.cb.onStageClear();
  }

  private step(dt: number) {
    this.accumulator = Math.min(this.accumulator + dt * 1000, STEP * 5);
    while (this.accumulator >= STEP) {
      if (this.pairMode) this.attractFinals();
      Engine.update(this.engine, STEP);
      this.snapMerge();
      this.accumulator -= STEP;
    }
    updateParticles(this.particles, dt);
    this.fx.step(dt);

    // ラインを超えたまま一定時間たまっていたら終了(落としたてのメダルは猶予)
    const now = performance.now();
    if (!this.pairMode && this.combo > 0 && now - this.lastMergeAt > COMBO_WINDOW) this.breakCombo();
    let over = false;
    for (const b of Composite.allBodies(this.engine.world)) {
      const j = medalOf(b);
      if (b.isStatic || !j) continue;
      j.pop = Math.max(0, j.pop - dt * 3.2);
      if (now - j.born > 900 && b.position.y - this.rad(j.level) < LINE_Y) over = true;
    }
    this.overTime = over && !this.stageClearing ? this.overTime + dt * 1000 : 0;
    if (!this.finished && this.overTime > OVER_MS) this.finish();
  }

  /** ゲーム終了。grand=true は全ステージクリア(盤面を片付けてお祝い) */
  finish(grand = false) {
    this.finished = true;
    this.paused = false;
    if (grand) {
      for (const b of Composite.allBodies(this.engine.world)) {
        if (!b.isStatic) Composite.remove(this.engine.world, b);
      }
    }
    playFinish();
    for (let i = 0; i < 4; i++) burst(this.particles, FIELD_W * (0.2 + 0.2 * i), FIELD_H * 0.4, 1.4);
    this.cb.onFinish(this.score, grand, { maxCombo: this.maxCombo, misses: this.misses });
  }

  private loop = (t: number) => {
    this.rafId = requestAnimationFrame(this.loop);
    const dt = Math.min((t - this.lastFrame) / 1000, 0.05);
    this.lastFrame = t;
    if (this.finished) {
      updateParticles(this.particles, dt);
      this.fx.step(dt);
      this.confettiT += dt;
      if (this.confettiT > 0.55) {
        this.confettiT = 0;
        burst(this.particles, Math.random() * FIELD_W, -10, 1.1);
      }
    } else if (!this.paused) {
      this.step(dt);
    }
    this.render(t);
  };

  // ---- 描画 ----
  private render(t: number) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, FIELD_W, FIELD_H);
    this.fx.beginShake(ctx);

    // ドロップボックス（すりガラス調の枠）。コンボ中は枠が倍率の色で光る
    const mult = comboMult(this.combo);
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    roundRect(ctx, 6, 30, FIELD_W - 12, FIELD_H - 36, 28);
    ctx.fill();
    ctx.lineWidth = mult > 1 ? 3.5 : 2;
    ctx.strokeStyle = mult > 1 ? MULT_COLORS[mult] : 'rgba(255,255,255,0.75)';
    if (mult > 1) {
      ctx.shadowColor = MULT_COLORS[mult];
      ctx.shadowBlur = 8 + mult * 4 + Math.sin(t / 160) * 3;
    }
    ctx.stroke();
    ctx.restore();

    // 上限ライン（赤やバツは使わず、やさしいラベンダーの点線がそっと光るだけ）
    const danger = Math.min(1, this.overTime / OVER_MS);
    ctx.save();
    ctx.setLineDash([10, 10]);
    ctx.lineWidth = 2 + danger * 2;
    ctx.strokeStyle = 'rgba(170, 140, 220, ' + (0.25 + danger * 0.45 + Math.sin(t / 220) * 0.12 * danger) + ')';
    ctx.beginPath();
    ctx.moveTo(18, LINE_Y);
    ctx.lineTo(FIELD_W - 18, LINE_Y);
    ctx.stroke();
    ctx.restore();

    // 落下ガイド & プレビューボール
    if (!this.finished && !this.stageClearing) {
      const next = this.itemFor(this.next.level, this.next.face);
      ctx.save();
      ctx.setLineDash([6, 12]);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(this.aimX, SPAWN_Y + next.radius);
      ctx.lineTo(this.aimX, FIELD_H - 20);
      ctx.stroke();
      ctx.restore();
      const bob = this.pointerDown ? 0 : Math.sin(t / 420) * 3;
      drawJellyBall(ctx, this.aimX, SPAWN_Y + bob, next, { alpha: 0.96 });
    }

    // 最終形は飾り(王冠・宝石・虹)が上にはみ出すので、通常の文字を先に描いて最後に重ねる
    const bodies = Composite.allBodies(this.engine.world).filter((b) => !b.isStatic && medalOf(b));
    bodies.sort((a, b) => Number((medalOf(a) as Medal).level === this.maxLevel) - Number((medalOf(b) as Medal).level === this.maxLevel));
    for (const b of bodies) {
      const m = medalOf(b) as Medal;
      const pop = popCurve(m.pop);
      drawJellyBall(ctx, b.position.x, b.position.y, this.itemFor(m.level, m.face), {
        scale: 1 + 0.2 * pop,
        squash: -0.05 * pop,
        isFinal: m.level === this.maxLevel,
        finalTier: m.finalTier as 0 | 1 | 2 | 3,
      });
    }

    drawParticles(ctx, this.particles);
    this.fx.drawWaves(ctx);
    this.fx.drawPopups(ctx);
    this.fx.endShake(ctx);
    this.fx.drawFlash(ctx, FIELD_W, FIELD_H);
  }
}
