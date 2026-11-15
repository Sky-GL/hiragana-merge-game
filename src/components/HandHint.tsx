/** 初回シグニファイア: 左右に揺れる半透明の手。1回操作でフェードアウト */
export default function HandHint({ visible }: { visible: boolean }) {
  return (
    <div
      className={
        'pointer-events-none absolute left-0 right-0 top-[86px] z-20 flex justify-center transition-opacity duration-700 ' +
        (visible ? 'opacity-100' : 'opacity-0')
      }
    >
      <div className="animate-swing text-5xl drop-shadow-[0_4px_8px_rgba(150,120,180,0.35)]" style={{ opacity: 0.75 }}>
        👆
      </div>
    </div>
  );
}
