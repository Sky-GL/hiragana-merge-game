// 収録済みボイスの再生。1文字ずつ収録された WAV だけを使う。
import { getAudioContext } from './sfx';

const BASE = '/voice/';

// 提供された個別収録のボイス(public/voice/clips/<名前>.wav)。ここに無い文字は無音にする
const CLIP_NAMES = [
  'a', 'i', 'u', 'e', 'o',
  'ka', 'ki', 'ku', 'ke', 'ko',
  'sa', 'shi', 'su', 'se', 'so',
  'ta', 'chi', 'tsu', 'te', 'to',
  'na', 'ni', 'nu', 'ne', 'no',
  'ha', 'hi', 'fu', 'he', 'ho',
  'ma', 'mi', 'mu', 'me', 'mo',
  'ya', 'yu', 'yo',
  'ra', 'ri', 'ru', 're', 'ro',
  'wa', 'wo', 'n',
  'ga', 'ji', 'da', 'de', 'do', 'ba', 'po',
  'sha', 'sho', 'cho',
] as const;

const voiceFileByClip: Record<string, string> = Object.fromEntries(CLIP_NAMES.map((name) => [name, `clips/${name}.wav`]));

const buffers = new Map<string, AudioBuffer>();
const inflight = new Set<string>();
const pendingPlays: Array<{ clip: string; excited: boolean }> = [];
const failed = new Set<string>(); // 読み込みに失敗したクリップ(次の preload で再試行する)

function startPlayback(ctx: AudioContext, buf: AudioBuffer, excited: boolean) {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = excited ? 1.08 : 1;
  const amp = ctx.createGain();
  amp.gain.value = 1;
  src.connect(amp).connect(ctx.destination);
  src.start();
}

function playPending(ctx: AudioContext, clip: string, buf: AudioBuffer) {
  const queued = pendingPlays.filter((play) => play.clip === clip);
  if (queued.length === 0) return;
  for (let index = pendingPlays.length - 1; index >= 0; index--) {
    if (pendingPlays[index].clip === clip) pendingPlays.splice(index, 1);
  }
  for (const { excited } of queued) {
    try {
      startPlayback(ctx, buf, excited);
    } catch {
      /* 音声出力に失敗しても続行する */
    }
  }
}

async function fetchClip(ctx: AudioContext, clip: string): Promise<AudioBuffer | null> {
  const file = voiceFileByClip[clip];
  if (!file) return null;
  try {
    const res = await fetch(BASE + encodeURIComponent(file));
    if (!res.ok) return null;
    return await ctx.decodeAudioData(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/** 遊ぶステージの音声だけを読み込む(初回のユーザー操作後に呼ぶ)。読み込み中のものは重ねて読まない */
export function preloadClips(clips: string[]) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const missing = clips.filter((c) => voiceFileByClip[c] && !buffers.has(c) && !inflight.has(c));
  if (missing.length === 0) return;
  missing.forEach((c) => {
    inflight.add(c);
    failed.delete(c);
  });

  void Promise.all(
    missing.map(async (c) => {
      const buf = await fetchClip(ctx, c);
      inflight.delete(c);
      if (buf) {
        buffers.set(c, buf);
        playPending(ctx, c, buf);
      } else {
        // 読めなかった分の待機は捨て、通信が戻れば次の preload で再試行される
        failed.add(c);
        for (let i = pendingPlays.length - 1; i >= 0; i--) if (pendingPlays[i].clip === c) pendingPlays.splice(i, 1);
      }
    }),
  );
}

/** 収録ボイスがあるクリップ名か */
export const hasClip = (clip: string) => !!voiceFileByClip[clip];

/** 収録ボイスを鳴らす(読み込み中なら読み込み後に鳴らす)。鳴らせるなら true */
export function playClip(clip: string, excited = false): boolean {
  const ctx = getAudioContext();
  if (!ctx || !voiceFileByClip[clip] || failed.has(clip)) return false;
  const buf = buffers.get(clip);
  if (!buf) {
    pendingPlays.push({ clip, excited });
    preloadClips([clip]);
    return true;
  }
  try {
    startPlayback(ctx, buf, excited);
  } catch {
    /* 再生に失敗しても続行する */
  }
  return true;
}
