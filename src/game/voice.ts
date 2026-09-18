// 自前のかわいいボイス（フォルマント合成）
// Web Speech の pitch は上限2.0で、しかも端末によっては無視される。
// 確実に「目一杯高い子供声」にするため、母音を Web Audio で合成する。
import { getAudioContext } from './sfx';

/** 基本周波数。上げるほど高く幼い声になる（実在の子供は 300〜450Hz 程度） */
const F0 = 520;
const F0_EXCITED = 600;

type Vowel = 'a' | 'i' | 'u' | 'e' | 'o';

/** 子供声に寄せた母音フォルマント [F1, F2, F3] */
const FORMANTS: Record<Vowel, [number, number, number]> = {
  a: [1100, 1700, 3100],
  i: [430, 3100, 3700],
  u: [440, 1150, 2700],
  e: [660, 2600, 3300],
  o: [580, 1050, 2900],
};

/** かな → 子音 + 母音 */
const KANA: Record<string, { c?: 'k' | 's'; v: Vowel }> = {
  あ: { v: 'a' }, い: { v: 'i' }, う: { v: 'u' }, え: { v: 'e' }, お: { v: 'o' },
  か: { c: 'k', v: 'a' }, き: { c: 'k', v: 'i' }, く: { c: 'k', v: 'u' },
  け: { c: 'k', v: 'e' }, こ: { c: 'k', v: 'o' },
  さ: { c: 's', v: 'a' },
};

let noiseBuffer: AudioBuffer | null = null;

function getNoise(ctx: AudioContext) {
  if (noiseBuffer) return noiseBuffer;
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  noiseBuffer = buf;
  return buf;
}

/** 子音（無声音）をノイズで作る */
function consonant(ctx: AudioContext, kind: 'k' | 's', start: number) {
  const src = ctx.createBufferSource();
  src.buffer = getNoise(ctx);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  const amp = ctx.createGain();
  src.connect(bp).connect(amp).connect(ctx.destination);

  if (kind === 'k') {
    // 破裂音: ごく短いバースト
    bp.frequency.value = 2200;
    bp.Q.value = 1.2;
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(0.22, start + 0.006);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + 0.045);
    src.start(start);
    src.stop(start + 0.06);
    return 0.05; // 母音までの待ち時間
  }
  // 摩擦音 s: 長めの高域ノイズ
  bp.frequency.value = 5500;
  bp.Q.value = 0.9;
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(0.14, start + 0.03);
  amp.gain.setValueAtTime(0.14, start + 0.08);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + 0.13);
  src.start(start);
  src.stop(start + 0.15);
  return 0.12;
}

/** 母音本体。のこぎり波 → 3本のバンドパス（フォルマント）で「あいうえお」を作る */
function vowel(ctx: AudioContext, v: Vowel, start: number, f0: number) {
  const dur = 0.3;
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(f0 * 0.94, start);
  osc.frequency.linearRampToValueAtTime(f0, start + 0.06);
  osc.frequency.linearRampToValueAtTime(f0 * 1.06, start + dur); // 語尾を上げて可愛く

  // ビブラート
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 6.5;
  lfoGain.gain.value = f0 * 0.018;
  lfo.connect(lfoGain).connect(osc.frequency);
  lfo.start(start);
  lfo.stop(start + dur + 0.1);

  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, start);
  master.gain.exponentialRampToValueAtTime(0.5, start + 0.03);
  master.gain.setValueAtTime(0.5, start + dur * 0.6);
  master.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  master.connect(ctx.destination);

  const [f1, f2, f3] = FORMANTS[v];
  const levels = [1, 0.55, 0.3];
  [f1, f2, f3].forEach((f, i) => {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f;
    bp.Q.value = 7;
    const g = ctx.createGain();
    g.gain.value = levels[i];
    osc.connect(bp).connect(g).connect(master);
  });

  osc.start(start);
  osc.stop(start + dur + 0.05);
}

/**
 * かわいい声で1文字読む。
 * @returns 合成できたら true（できなければ呼び出し側が Web Speech にフォールバック）
 */
export function speakCute(kana: string, excited = false): boolean {
  const ctx = getAudioContext();
  const def = KANA[kana];
  if (!ctx || !def) return false;
  try {
    const t = ctx.currentTime + 0.01;
    const delay = def.c ? consonant(ctx, def.c, t) : 0;
    vowel(ctx, def.v, t + delay, excited ? F0_EXCITED : F0);
    return true;
  } catch {
    return false;
  }
}
