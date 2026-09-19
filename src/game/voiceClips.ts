// 収録済みボイスの再生。1文字ずつ収録された WAV だけを使う。
import { getAudioContext } from './sfx';

const BASE = '/voice/';

const VOICE_ROWS = [
  ['00-KANA POP.wav', ['a', 'i', 'u', 'e', 'o']],
  ['01-KANA POP.wav', ['ka', 'ki', 'ku', 'ke', 'ko']],
  ['02-KANA POP.wav', ['sa', 'shi', 'su', 'se', 'so']],
  ['03-KANA POP.wav', ['ta', 'chi', 'tsu', 'te', 'to']],
  ['04-KANA POP.wav', ['na', 'ni', 'nu', 'ne', 'no']],
  ['05-KANA POP.wav', ['ha', 'hi', 'fu', 'he', 'ho']],
  ['06-KANA POP.wav', ['ma', 'mi', 'mu', 'me', 'mo']],
  ['07-KANA POP.wav', ['ya', 'yu', 'yo']],
  ['08-KANA POP.wav', ['ra', 'ri', 'ru', 're', 'ro']],
  ['09-KANA POP.wav', ['wa', 'wo', 'n']],
  ['10-KANA POP.wav', ['ga', 'gi', 'gu', 'ge', 'go']],
  ['11-KANA POP.wav', ['za', 'ji', 'zu', 'ze', 'zo']],
  ['12-KANA POP.wav', ['da', 'dji', 'dzu', 'de', 'do']],
  ['13-KANA POP.wav', ['ba', 'bi', 'bu', 'be', 'bo']],
  ['14-KANA POP.wav', ['pa', 'pi', 'pu', 'pe', 'po']],
  ['15-KANA POP.wav', ['kya', 'kyu', 'kyo']],
  ['16-KANA POP.wav', ['sha', 'shu', 'sho']],
  ['17-KANA POP.wav', ['cha', 'chu', 'cho']],
  ['18-KANA POP.wav', ['nya', 'nyu', 'nyo']],
  ['19-KANA POP.wav', ['hya', 'hyu', 'hyo']],
  ['20-KANA POP.wav', ['mya', 'myu', 'myo']],
  ['21-KANA POP.wav', ['rya', 'ryu', 'ryo']],
  ['22-KANA POP.wav', ['gya', 'gyu', 'gyo']],
  ['23-KANA POP.wav', ['ja', 'ju', 'jo']],
  ['24-KANA POP.wav', ['dya', 'dyu', 'dyo']],
  ['25-KANA POP.wav', ['bya', 'byu', 'byo']],
  ['26-KANA POP.wav', ['pya', 'pyu', 'pyo']],
] as const;

const voiceFileByRomaji: Record<string, string> = Object.fromEntries(
  VOICE_ROWS.flatMap(([, romajis]) => romajis
    .map((romaji) => [romaji, `clips/${romaji}.wav`])),
);

const buffers = new Map<string, AudioBuffer>();
const pendingPlays: Array<{ romaji: string; excited: boolean }> = [];
let state: 'idle' | 'loading' | 'ready' | 'absent' = 'idle';

function startPlayback(ctx: AudioContext, buf: AudioBuffer, excited: boolean) {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = excited ? 1.08 : 1;
  const amp = ctx.createGain();
  amp.gain.value = 1;
  src.connect(amp).connect(ctx.destination);
  src.start();
}

function playPending(ctx: AudioContext, romaji: string, buf: AudioBuffer) {
  const queued = pendingPlays.filter((play) => play.romaji === romaji);
  if (queued.length === 0) return;
  for (let index = pendingPlays.length - 1; index >= 0; index--) {
    if (pendingPlays[index].romaji === romaji) pendingPlays.splice(index, 1);
  }
  for (const { excited } of queued) {
    try {
      startPlayback(ctx, buf, excited);
    } catch {
      /* 音声出力に失敗しても合成音声へは切り替えない */
    }
  }
}

async function fetchClip(ctx: AudioContext, romaji: string): Promise<AudioBuffer | null> {
  const file = voiceFileByRomaji[romaji];
  if (!file) return null;
  try {
    const res = await fetch(BASE + encodeURIComponent(file));
    if (!res.ok) return null;
    return await ctx.decodeAudioData(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * 遊ぶステージの音声だけを読み込む（初回のユーザー操作後に呼ぶ）。
 * 1つ目が無ければ音源未設置と判断して以降は読みに行かない。
 */
export function preloadClips(romajis: string[]) {
  const ctx = getAudioContext();
  if (!ctx || state === 'absent' || state === 'loading') return;
  const missing = romajis.filter((r) => voiceFileByRomaji[r] && !buffers.has(r));
  if (missing.length === 0) return;
  state = 'loading';

  void (async () => {
    const first = await fetchClip(ctx, missing[0]);
    if (!first && buffers.size === 0) {
      state = 'absent'; // 音源が置かれていない構成
      return;
    }
    if (first) {
      buffers.set(missing[0], first);
      playPending(ctx, missing[0], first);
    }
    await Promise.all(
      missing.slice(1).map(async (r) => {
        const b = await fetchClip(ctx, r);
        if (b) {
          buffers.set(r, b);
          playPending(ctx, r, b);
        }
      }),
    );
    state = 'ready';
  })();
}

/** 収録ボイスで鳴らせたら true */
export function playClip(romaji: string, excited = false): boolean {
  const ctx = getAudioContext();
  if (!ctx || !voiceFileByRomaji[romaji]) return false;
  const buf = buffers.get(romaji);
  if (!buf) {
    pendingPlays.push({ romaji, excited });
    return true;
  }
  try {
    startPlayback(ctx, buf, excited);
    return true;
  } catch {
    return true;
  }
}
