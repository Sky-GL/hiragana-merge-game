// 最終形(ステージの最後の文字)の進化段階の定義。元の「かなポップ」と同じルール:
//   最終形+最終形 → 👑最終形 → (👑+👑) 💎最終形 → (💎+💎) 🌈最終形 → (🌈+🌈) ステージクリア
//   バッジは 1 → 👑2 → 💎4 → 🌈8。同じバッジどうしだけが合体する。
// 飾りの描画は draw.ts(drawJellyBall)が受け持つ。
export type FinalTier = { tier: number; icon: string; name: string; badge: number; color: string; burst: string[] };

export const FINAL_TIERS: FinalTier[] = [
  { tier: 0, icon: '', name: 'FINAL', badge: 1, color: '#B49FC7', burst: ['#FFB6C1', '#FFD1BA', '#FFF2A3', '#FFFFFF'] },
  { tier: 1, icon: '👑', name: 'CROWN', badge: 2, color: '#F2B83F', burst: ['#FFCB4D', '#FFF4A5', '#FFFFFF', '#FFD59E'] },
  { tier: 2, icon: '💎', name: 'GEM', badge: 4, color: '#61CFE8', burst: ['#76DDF3', '#D8FAFF', '#FFFFFF', '#C4DFFF'] },
  { tier: 3, icon: '🌈', name: 'RAINBOW', badge: 8, color: '#B78BE7', burst: ['#FF92B6', '#FFD56E', '#91E7B5', '#8ACCF6', '#CBA4F4'] },
];
