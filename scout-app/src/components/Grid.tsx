import { flipSquare, squareName, type Field } from "../field";

// Squares are drawn left to right, top to bottom. Names are always the stored,
// unflipped ones; when flipped, the top-left button is flipSquare("A1").
export function Grid({ field, flipped, selected, onPick, disabled }: {
  field: Field;
  flipped: boolean;
  selected: string | null;
  onPick(square: string): void;
  disabled?: boolean;
}) {
  const squares: string[] = [];
  for (let row = 0; row < field.rows; row++) {
    for (let col = 0; col < field.cols; col++) {
      const square = squareName(col, row);
      squares.push(flipped ? flipSquare(square, field) : square);
    }
  }
  return (
    <div className="grid" style={{ gridTemplate: `repeat(${field.rows}, 1fr) / repeat(${field.cols}, 1fr)` }}>
      {squares.map((square) => (
        <button
          key={square}
          type="button"
          aria-label={square}
          aria-pressed={square === selected}
          disabled={disabled}
          onClick={() => onPick(square)}
        />
      ))}
    </div>
  );
}
