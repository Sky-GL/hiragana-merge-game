// 発声の入口。提供された収録ボイスだけを使う(音声合成など、生成した声は使わない)。
import type { KanaChar } from './stages';
import { playClip } from './voiceClips';

/** 1文字を発音する。収録が無い文字は無音 */
export function speakChar(c: KanaChar, { excited = false }: { excited?: boolean } = {}) {
  playClip(c.clip, excited);
}
