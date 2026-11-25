import mark from "../assets/lebob-mark.svg";

// The team's mark and the app's name, then the pixel rule. Every screen but the live one.
export function Header() {
  return (
    <header className="header">
      <img src={mark} alt="" width={36} height={36} />
      <span>Lebob Scout</span>
    </header>
  );
}
