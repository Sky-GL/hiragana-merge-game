import { useState } from 'react';
import { FINALS_TO_CLEAR } from '../game/popFinal';
import { shade, withAlpha } from '../game/stages';
import type { PopMode } from '../game/popStore';

type BubbleItem = { kana: string; romaji: string; base: string };

type BubbleProps = {
  item: BubbleItem;
  size?: number;
  active?: boolean;
  dim?: boolean;
  hideLabel?: boolean;
};

/** DOM側の小さなメダル(進化の並び・結果表示・ステージ選択で使う)。描画はCanvas側(drawMedal)と揃える */
export function Bubble({ item, size = 40, active = false, dim = false, hideLabel = false }: BubbleProps) {
  const long = [...item.kana].length > 1; // 拗音(きゃ など)は2文字分の幅に収める
  const showLabel = size >= 36 && !hideLabel;
  return (
    <span
      className={`pop-bubble ${active ? 'active' : ''} ${dim ? 'dim' : ''}`}
      style={{
        width: size,
        height: size,
        borderColor: item.base,
        background: `radial-gradient(circle at 32% 26%, ${shade(item.base, -0.35)}, ${shade(item.base, -0.68)} 60%, ${shade(item.base, -0.85)})`,
        boxShadow: `0 0 ${size * 0.25}px ${withAlpha(item.base, 0.5)}`,
      }}
    >
      <span className="pop-b-glyph" style={{ fontSize: size * (long ? 0.34 : showLabel ? 0.5 : 0.58) }}>{item.kana}</span>
      {showLabel && (
        <span className="pop-b-label" style={{ fontSize: Math.max(9, size * 0.22), color: shade(item.base, 0.65) }}>{item.romaji}</span>
      )}
    </span>
  );
}

// ステージクリアの紙吹雪(CSSアニメーション。表示のたびに位置と色を作り直す)
const CONFETTI_COLORS = ['#ffd966', '#ff9a2e', '#ff5a5a', '#e0409a', '#a070ff', '#38d0f0', '#3ddc84'];

export function Confetti() {
  const [pieces] = useState(() =>
    Array.from({ length: 36 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      dur: 1.1 + Math.random() * 0.9,
      size: 6 + Math.random() * 7,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      round: i % 3 === 0,
    })),
  );
  return (
    <div className="pop-confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.round ? p.size : p.size * 1.6,
            background: p.color,
            borderRadius: p.round ? '50%' : 2,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
          }}
        />
      ))}
    </div>
  );
}

export function HowTo({ mode, onClose }: { mode: PopMode; onClose: () => void }) {
  return (
    <div className="pop-overlay" onClick={onClose}>
      <div className="pop-card" onClick={(e) => e.stopPropagation()}>
        <h2>あそびかた</h2>
        <ol className="pop-howto">
          <li>画面をタップ／ドラッグして位置を決め、指を離すと文字メダルが落ちます。</li>
          {mode === 'read' ? (
            <>
              <li>メダルには<b>文字面</b>(あ)と<b>読み面</b>(a)があります。<b>同じ文字の「文字面 + 読み面」</b>がぶつかると合体して、次の文字に進化します。</li>
              <li>色も大きさも全部同じです。<b>文字を読んで</b>、対応する相手の隣に落としましょう。同じ面どうしは合体しません。</li>
              <li>落とす・合体するたびに読み上げるので、合っていたか耳でも確認できます。</li>
              <li>🔥 正しいペアを続けて合体させると<b>コンボ</b>になり、3コンボごとに得点の倍率が上がります(最大×5)。別の文字の読みに触れて<b>読み間違える</b>と、コンボが途切れて、2つの文字の読みを教えます(罰はそれだけです)。</li>
            </>
          ) : (
            <>
              <li>同じ文字どうしがぶつかると合体して、次の文字に進化します。</li>
              <li>ステージの5文字がまんべんなく降ってきます。落とす・合体するたびに読み上げるので、音と形をセットで覚えましょう。</li>
              <li>🔥 6秒以内に次の合体を続けると<b>コンボ</b>になり、3コンボごとに得点の倍率が上がります(最大×5)。</li>
            </>
          )}
          <li>点線より上に積み上がるとゲームオーバーです。</li>
        </ol>
        <p className="pop-howto-sub">ステージクリアのルール(最終形を育てる)</p>
        <ul className="pop-final-rules">
          <li><span>最終形 + 最終形</span><b>→ 👑 最終形(バッジ2)</b></li>
          <li><span>👑 + 👑</span><b>→ 💎 最終形(バッジ4)</b></li>
          <li><span>💎 + 💎</span><b>→ 🌈 最終形(バッジ8)</b></li>
          <li><span>🌈 + 🌈</span><b>→ 次のステージへ!</b></li>
        </ul>
        <p className="pop-howto-note">
          同じバッジどうしだけが合体します{mode === 'read' ? '(読みモードでも、完成した最終形は文字面・読み面を問いません。同じバッジの最終形は引き寄せ合います)' : ''}。最終形は近づくと吸い付き、自動では消えません。🌈ができると虹ボーナス+300点。
          クリアには最終形が{FINALS_TO_CLEAR}個必要です。
        </p>
        <button className="btn primary" onClick={onClose}>わかった!</button>
      </div>
    </div>
  );
}
