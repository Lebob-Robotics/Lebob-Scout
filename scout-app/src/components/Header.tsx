import mark from "../assets/scout-mark.png";

// Lebob with a clipboard (the scouting logo) and "Scout", the event code, then how many reports are still on this phone.
// Every screen but the live one.
export function Header({ event, pill }: { event?: string | null; pill?: string | null }) {
  return (
    <header className="header">
      <span className="brand">
        <img src={mark} alt="" width={30} height={30} />
        Scout
      </span>
      {event && <span className="hdrmeta">{event}</span>}
      {pill && <span className="pill" role="status">{pill}</span>}
    </header>
  );
}
