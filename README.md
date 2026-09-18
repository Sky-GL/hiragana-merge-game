# Kana Pop — ひらがな進化マージパズル

**本番URL: https://kana-pop-seven.vercel.app**

日本語ゼロ知識のユーザー向け、ノンバーバルUIのマージパズル。
落として・くっついて・進化するたびに「ひらがな + ローマ字 + 音声」が同時に刷り込まれる。

- Vite + React + TypeScript + Tailwind CSS
- 物理: Matter.js（描画は Canvas 2D の自前レンダラ＝ジェリー表現のため）
- 音声: Web Speech API (`ja-JP`)

## 進化順

あ(a) → い(i) → う(u) → え(e) → お(o) → か(ka) → き(ki) → く(ku) → け(ke) → こ(ko) → さ(sa)

出現するのは あ/い/う/え の4種のみ。合体で先の文字が解放され、上部の進化ツリーが点灯していく。

## 画面構成

1. **表紙（TitleScreen）** — ロゴ / PLAY / How to play。ここでのタップを Web Speech の解錠にも使う
2. **How to play（英語・3ステップ）** — 初回PLAY時に自動表示。以後はヘッダーの ❓ からいつでも開ける
3. **ゲーム画面** — 進化ツリー / スコア / 盤面 / 🔊発音リプレイ
4. **リザルト** — Finish! + 紙吹雪、🏠 で表紙へ / ↻ で即リトライ

## ローカル開発

```bash
npm install
npm run dev
```

> ⚠️ **Google ドライブ上（G:\My Drive\...）では `npm install` が EBADF で失敗する。**
> ドライブ同期FSが node_modules の大量書き込みに耐えられないため。
> ローカルディスク（例: `C:\dev\hiragana-merge`）に clone して開発すること。

## Vercel へのデプロイ

1. GitHub にリポジトリを作成して push
2. Vercel で **Add New → Project → Import** （設定は自動検出: Vite / `npm run build` / `dist`）
3. 以後は push するたびに自動デプロイ

## 携帯だけで継続開発する

| 方法 | やること |
| --- | --- |
| GitHub Web エディタ | リポジトリURLの `github.com` を `github.dev` に変えるだけで、スマホのブラウザからVS Codeが開く。編集→コミットで Vercel が自動デプロイ |
| GitHub モバイルアプリ | 軽微な修正とPRレビュー |
| Vercel アプリ/Web | デプロイ状況とプレビューURLの確認 |

`main` へのコミット = 本番反映なので、実験は別ブランチを切ると Vercel のプレビューURLで確認できる。

## 設計メモ（仕様の意図）

- **テキスト説明ゼロ**: 誘導は揺れる指アイコン、点線ガイド、進化ツリー、ピクトグラムのみ
- **即時フィードバック**: 合体した同フレームで `speechSynthesis.cancel()` → 発声。物理の静止を待たない
- **全肯定**: 赤色・バツ・ブザーは不使用。上限ラインもラベンダーの点線がやさしく光るだけ。終了は `Finish!` + 紙吹雪 + 覚えた文字一覧
- **音声解錠**: iOS/Android は初回タップで無音発声して `speechSynthesis` を解錠（`unlockSpeech`）
- 発音が出ない端末（Web Speech 非対応）でも例外を握り潰して無音で続行する

## 声を差し替える（Voicepeak などの収録ボイス）

`public/voice/` に下のファイル名で置くだけで、合成ボイスより優先して再生される。

```
a.mp3  i.mp3  u.mp3  e.mp3  o.mp3
ka.mp3 ki.mp3 ku.mp3 ke.mp3 ko.mp3
sa.mp3
```

- Voicepeak は wav 書き出し → mp3 に変換して置くと軽い（wav もそのまま読める）
- 頭の無音はトリミングする（合体から0.1秒以内に鳴らすため）
- 足りない文字は自動で合成ボイスにフォールバック
- **利用規約の確認は必須**: Voicepeak 本体は商用利用可だが、キャラクターボイスごとに
  クレジット表記や用途の条件が異なる。ゲームへの組み込み（音声の再配布）が
  許諾されているか、使用する声の規約を必ず確認すること

## レベルと難易度

- 合体するたびに EXP が入り、プレイヤーレベルが上がる（減点・降格なし）
- レベルが上がると**ドロップされる文字の種類が増える** = 自然に難しくなる
  - Lv1: あ/い → Lv3: +う → Lv5: +え
- 必要EXPは `expToNext()`、出現テーブルは `spawnPoolFor()`（どちらも `src/game/progress.ts`）

## 主なチューニング箇所

| やりたいこと | ファイル |
| --- | --- |
| 文字・色・サイズ・進化順 | `src/game/characters.ts` |
| 難易度（重力・クールダウン・上限ライン・猶予） | `src/game/engine.ts` 冒頭の定数 |
| ボールの質感・顔 | `src/game/draw.ts` |
| エフェクトの量・種類 | `src/game/particles.ts` |
| 声の高さ（合成ボイス） | `src/game/voice.ts` の `F0` |
| 効果音 | `src/game/sfx.ts` |
| レベル曲線・出現テーブル | `src/game/progress.ts` |
