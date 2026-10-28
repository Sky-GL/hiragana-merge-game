// Web Audio で作る「かわいい」効果音。声の直後に重ねて甘さを足す役目
let ctx: AudioContext | null = null;

/** ユーザー操作のタイミングで AudioContext を用意・再開する */
export function unlockSfx() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    /* 音が出せない環境でも無音で続行 */
  }
}

/** 他モジュール（ボイス合成）と AudioContext を共有する */
export function getAudioContext(): AudioContext | null {
  return ctx;
}

/** 単音。type と音量エンベロープでぷにっとした質感にする */
function tone(freq: number, start: number, dur: number, gain: number, type: OscillatorType = 'sine') {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(amp).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

/** 落としたとき: 軽い「ぽっ」 */
export function playDrop() {
  if (!ctx) return;
  try {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(760, t);
    osc.frequency.exponentialRampToValueAtTime(420, t + 0.09);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(0.08, t + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    osc.connect(amp).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.12);
  } catch {
    /* 無視 */
  }
}

/** 合体したとき: 進化が進むほど高くなる「ぽわん♪」＋キラキラ */
export function playMerge(level: number, excited = false) {
  if (!ctx) return;
  try {
    const t = ctx.currentTime;
    const base = 520 * Math.pow(1.06, level); // レベルが上がるほど華やかに
    tone(base, t, 0.16, 0.07);
    tone(base * 1.5, t + 0.05, 0.18, 0.055);
    tone(base * 2, t + 0.1, 0.22, 0.04);
    // キラッ
    tone(base * 4, t + 0.12, 0.12, 0.022, 'triangle');
    if (excited) {
      tone(base * 2.5, t + 0.2, 0.3, 0.05);
      tone(base * 3, t + 0.3, 0.35, 0.045);
    }
  } catch {
    /* 無視 */
  }
}

/** リザルト: ふわっと上がるアルペジオ */
export function playFinish() {
  if (!ctx) return;
  try {
    const t = ctx.currentTime;
    [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.12, 0.3, 0.06));
  } catch {
    /* 無視 */
  }
}

/** 現在時刻からの相対秒で単音を鳴らす(ポップの効果音用) */
function pt(freq: number, offset: number, dur: number, peak: number, type: OscillatorType = 'sine') {
  if (!ctx) return;
  tone(freq, ctx.currentTime + offset, dur, peak, type);
}

/** ポップ: 文字を落とした音 */
export function playPopDrop() {
  try {
    pt(760, 0, 0.09, 0.07);
    pt(500, 0.04, 0.08, 0.05);
  } catch {
    /* 無視 */
  }
}

/** ポップ: 合体音のコンボ版。進化するほど、コンボが続くほど高くなり、最終形は音を足して華やかにする */
export function playPopMergeCombo(level: number, big: boolean, combo: number) {
  try {
    const f = 520 * Math.pow(1.06, level) * (1 + Math.min(combo, 12) * 0.035);
    pt(f, 0, 0.16, 0.07);
    pt(f * 1.5, 0.05, 0.18, 0.055);
    pt(f * 2, 0.1, 0.22, 0.04);
    if (big) {
      pt(f * 2.5, 0.2, 0.3, 0.05);
      pt(f * 3, 0.3, 0.35, 0.045);
    }
  } catch {
    /* 無視 */
  }
}

/** ポップ: コンボ倍率が上がった瞬間の上昇アルペジオ(段階が上がるほど音数が増える) */
export function playPopComboUp(mult: number) {
  try {
    const base = 660 + mult * 60;
    [1, 1.25, 1.5, 2, 2.5].slice(0, Math.min(5, 2 + mult)).forEach((r, i) => pt(base * r, i * 0.06, 0.14, 0.07, 'triangle'));
  } catch {
    /* 無視 */
  }
}

/** ポップ: 読み間違い。やさしい低い2音(罰ではなく「ちがうよ」の合図) */
export function playPopMiss() {
  try {
    pt(300, 0, 0.12, 0.07, 'triangle');
    pt(240, 0.08, 0.16, 0.06, 'triangle');
  } catch {
    /* 無視 */
  }
}

/** ポップ: 最終形が 👑/💎/🌈 に進化したときの効果音。虹=上昇アルペジオ / ダイヤ=きらめき / クラウン=ファンファーレ */
export function playPopSpecial(kind: 'crown' | 'diamond' | 'rainbow') {
  try {
    const seq =
      kind === 'rainbow' ? [523, 659, 784, 880, 1047, 1319]
        : kind === 'diamond' ? [1568, 1976, 2349, 1976, 2637]
          : [523, 659, 784, 1047, 1319];
    seq.forEach((f, i) => pt(f, i * 0.07, kind === 'diamond' ? 0.16 : 0.28, 0.07, kind === 'diamond' ? 'triangle' : 'sine'));
  } catch {
    /* 無視 */
  }
}
