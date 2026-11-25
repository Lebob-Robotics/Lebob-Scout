import { useState } from "react";
import { FieldPicture } from "./components/FieldPicture";
import { Grid } from "./components/Grid";
import { CURRENT_FIELD_KEY, FIELDS } from "./field";

// TEMPORARY dev harness for the field and grid. A later task replaces it with the real app.
export default function App() {
  const [flipped, setFlipped] = useState(false);
  const [last, setLast] = useState<string | null>(null);
  return (
    <div style={{ height: "100%", display: "grid", gridTemplateRows: "auto 1fr", gap: 8, padding: 8 }}>
      <p>
        <button type="button" onClick={() => setFlipped(!flipped)}>Flip</button> Last tapped: <output>{last ?? "none"}</output>
      </p>
      <div className="field-space">
        <div className="field">
          <FieldPicture fieldKey={CURRENT_FIELD_KEY} flipped={flipped} />
          <Grid field={FIELDS[CURRENT_FIELD_KEY]} flipped={flipped} selected={last} onPick={setLast} />
        </div>
      </div>
    </div>
  );
}
