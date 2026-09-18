// 発声の入口。提供された収録ボイスだけを使う。
import { playClip } from './voiceClips';

export function initSpeech() {
  // 実音声のみを使うため、端末の音声合成は初期化しない。
}

/** 呼び出し元との互換性を保つ。実音声の解錠は unlockSfx が担当する。 */
export function unlockSpeech() {}

export function speakKana(kana: string, opts: { excited?: boolean; romaji?: string } = {}) {
  void kana;
  if (!opts.romaji) return;
  playClip(opts.romaji, opts.excited);
}
