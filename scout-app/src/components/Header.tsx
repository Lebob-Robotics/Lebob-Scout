import { useEffect, useRef, useState } from "react";
import mark from "../assets/scout-mark.png";

// Lebob with a clipboard (the scouting logo) and "Scout", the event code, then a warning sign while reports are still on
// this phone. Tapping the sign opens a note under it saying how many and that they need internet; tapping outside or
// the sign again closes it. Every screen but the live one.
export function Header({ event, unsent }: { event?: string | null; unsent?: string | null }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  // The note goes with the sign: nothing waiting, nothing open.
  const shown = open && !!unsent;

  useEffect(() => {
    if (!shown) return;
    const away = (e: Event) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [shown]);

  return (
    <header className="header">
      <span className="brand">
        <img src={mark} alt="" width={30} height={30} />
        Scout
      </span>
      {event && <span className="hdrmeta">{event}</span>}
      {unsent && (
        <span className="unsent" ref={box}>
          <button type="button" className="warn-btn" aria-label="Reports not sent yet" aria-expanded={shown} aria-controls="unsent-note" onClick={() => setOpen(!open)}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M12 3 2 20.5h20L12 3Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              <path d="M12 10v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <circle cx="12" cy="17.8" r="1.2" fill="currentColor" />
            </svg>
          </button>
          {shown && <div className="unsent-note" id="unsent-note" role="status">{unsent}</div>}
        </span>
      )}
    </header>
  );
}
