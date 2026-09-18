import { useEffect, useRef } from 'react';
import { FIELD_H, FIELD_W, KanaGame, type GameCallbacks } from '../game/engine';

type Props = {
  callbacks: GameCallbacks;
  onReady: (game: KanaGame) => void;
};

export default function GameCanvas({ callbacks, onReady }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // 常に最新のコールバックを呼ぶための薄いプロキシ
    const game = new KanaGame({
      onScore: (s) => cbRef.current.onScore(s),
      onNext: (l) => cbRef.current.onNext(l),
      onFinish: (s, b) => cbRef.current.onFinish(s, b),
      onFirstInteract: () => cbRef.current.onFirstInteract(),
      onUnlockLevel: (l) => cbRef.current.onUnlockLevel(l),
      onExp: (g) => cbRef.current.onExp(g),
      onStageClear: () => cbRef.current.onStageClear(),
    });
    game.mount(canvas);
    onReady(game);
    return () => game.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-auto max-w-full rounded-[30px]"
      style={{ aspectRatio: FIELD_W + ' / ' + FIELD_H }}
    />
  );
}
