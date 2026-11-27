export type Field = {
  key: string;
  cols: number;
  rows: number;
  auto: number;
  changeover: number;
  teleop: number;
  endgame: number;
  // Stretches of the robot's own wall (0 to 200, see startWall.ts) where a robot may start.
  startOk: [number, number][];
};

export const CURRENT_FIELD_KEY = "ftc-2026";

// The strategy app's tiled field: each square drawn as a tile inset by `gap` with corners rounded by `radius`, both as
// shares of a square's side. The bare field picture and the heatmaps over it use the same tiles.
export const TILE = { gap: 0.0375, radius: 0.125 };

export const FIELDS: Record<string, Field> = {
  [CURRENT_FIELD_KEY]: {
    key: CURRENT_FIELD_KEY,
    cols: 6,
    rows: 6,
    auto: 30,
    changeover: 8,
    teleop: 120,
    endgame: 60,
    startOk: [[0, 9], [23, 67], [83, 109], [123, 200]],
  },
};

export function squareName(col: number, row: number): string {
  return `${String.fromCharCode(65 + col)}${row + 1}`;
}

export function flipSquare(square: string, field: Field): string {
  const col = square.charCodeAt(0) - 65;
  const row = Number(square.slice(1)) - 1;
  return squareName(field.cols - 1 - col, field.rows - 1 - row);
}

export function isSquare(square: string, field: Field): boolean {
  if (!/^[A-Z][1-9]\d*$/.test(square)) return false;
  const col = square.charCodeAt(0) - 65;
  const row = Number(square.slice(1)) - 1;
  return col < field.cols && row < field.rows;
}
