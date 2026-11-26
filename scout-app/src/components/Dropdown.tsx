import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { SEARCH_OVER, filterItems, placePanel, stepIndex, typeAhead, type DdItem, type Place } from "../dropdown";

// The old site's dropdown, for every list in both apps: a button showing the choice, opening a panel under it on a
// wide screen or a sheet from the bottom on a phone or tablet. Long lists get a search box. The chosen item has the
// accent edge, bold and a tick. Keys: arrows, Home and End move, Enter picks, Esc closes, typing searches (or jumps to
// the next item starting with what was typed). A tap outside closes it.
// `label` names the list for screen readers and heads the sheet; `id` lets a <label htmlFor> point at the button.
const phone = () => typeof matchMedia === "function" && matchMedia("(max-width: 640px), (pointer: coarse)").matches;

export function Dropdown({ id, label, value, items, onChange, placeholder = "–", search, mono = false, className }: {
  id?: string; label: string; value: string; items: DdItem[]; onChange(value: string): void;
  placeholder?: string; search?: boolean; mono?: boolean; className?: string;
}) {
  const [open, setOpen] = useState<{ sheet: boolean; place: Place | null } | null>(null);
  const [query, setQuery] = useState("");
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const searchBox = useRef<HTMLInputElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const withSearch = search ?? items.length > SEARCH_OVER;
  const shown = filterItems(items, withSearch ? query : "");
  const chosen = items.find((it) => it.value === value);

  const show = () => {
    const sheet = phone();
    const r = button.current!.getBoundingClientRect();
    setQuery("");
    setOpen({ sheet, place: sheet ? null : placePanel(r, innerWidth, innerHeight) });
  };
  const close = (refocus: boolean) => {
    setOpen(null);
    if (refocus) button.current?.focus({ preventScroll: true });
  };
  const pick = (v: string) => {
    close(true);
    if (v !== value) onChange(v);
  };

  // On opening: the search box on a wide screen (no phone keyboard popping up), else the chosen item or the first.
  useLayoutEffect(() => {
    if (!open) return;
    const opts = list.current?.querySelectorAll<HTMLElement>(".dd-opt");
    const on = list.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (searchBox.current && !open.sheet) searchBox.current.focus();
    else (on ?? opts?.[0] ?? panel.current)?.focus({ preventScroll: true });
    on?.scrollIntoView({ block: "nearest" });
  }, [open]);

  // While open on a wide screen, scrolling the page or resizing the window closes it.
  useEffect(() => {
    if (!open || open.sheet) return;
    const away = () => close(false);
    const scroll = (e: Event) => { if (!panel.current?.contains(e.target as Node)) close(false); };
    addEventListener("resize", away);
    document.addEventListener("scroll", scroll, true);
    return () => { removeEventListener("resize", away); document.removeEventListener("scroll", scroll, true); };
  }, [open]);

  const onKey = (e: KeyboardEvent) => {
    const opts = [...(list.current?.querySelectorAll<HTMLElement>(".dd-opt") ?? [])];
    const at = opts.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(true); return; }
    if (e.key === "Tab") { close(false); return; }
    const to = stepIndex(at, e.key, opts.length);
    if (to != null && !(document.activeElement === searchBox.current && (e.key === "Home" || e.key === "End"))) {
      e.preventDefault();
      opts[to].focus();
      opts[to].scrollIntoView({ block: "nearest" });
      return;
    }
    if (e.key === "Enter" && document.activeElement === searchBox.current) {
      e.preventDefault();
      if (shown[0]) pick(shown[0].value);
      return;
    }
    // A letter or number while on the list: into the search box, or jump to the next item starting with it.
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && document.activeElement !== searchBox.current) {
      if (withSearch) {
        e.preventDefault();
        setQuery((q) => q + e.key);
        searchBox.current?.focus();
      } else if (e.key !== " ") {
        const now = e.timeStamp;
        typed.current = { text: now - typed.current.at < 700 ? typed.current.text + e.key : e.key, at: now };
        const i = typeAhead(shown, typed.current.text, at);
        if (i >= 0) { opts[i].focus(); opts[i].scrollIntoView({ block: "nearest" }); }
      }
    }
  };

  const text = chosen ? [chosen.label, chosen.sub].filter(Boolean).join(" ") : "";
  const place = open?.place;
  return (
    <>
      <button ref={button} id={id} type="button" className={["dd-btn", mono && "mono", className].filter(Boolean).join(" ")}
        aria-haspopup="listbox" aria-expanded={!!open} aria-label={`${label}: ${text || "not set"}`}
        onClick={() => (open ? close(true) : show())}
        onKeyDown={(e) => { if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) { e.preventDefault(); show(); } }}>
        {chosen
          ? <span><b className="dd-l">{chosen.label}</b>{chosen.sub && <span className="dd-s"> {chosen.sub}</span>}</span>
          : <span className="dd-ph">{placeholder}</span>}
      </button>
      {open && createPortal(
        <>
          <div className={open.sheet ? "dd-back sheet" : "dd-back"} onClick={() => close(true)} />
          <div ref={panel} className={["dd-panel", open.sheet && "sheet", place?.up && "up"].filter(Boolean).join(" ")} role="dialog" aria-label={label}
            tabIndex={-1} onKeyDown={onKey}
            style={place ? { left: place.left, width: place.width, maxHeight: place.maxHeight, top: place.top, bottom: place.bottom } : undefined}>
            {open.sheet && (
              <div className="dd-head"><span>{label}</span><button type="button" className="dd-x" onClick={() => close(true)}>Close</button></div>
            )}
            {withSearch && (
              <input ref={searchBox} className="dd-q" type="search" placeholder="Search" autoComplete="off" aria-label={`Search ${label.toLowerCase()}`}
                value={query} onChange={(e) => setQuery(e.target.value)} />
            )}
            <div ref={list} className="dd-list" role="listbox" aria-label={label}>
              {shown.length ? shown.map((it) => (
                <button key={it.value} type="button" role="option" aria-selected={it.value === value}
                  className={mono ? "dd-opt mono" : "dd-opt"} onClick={() => pick(it.value)}>
                  <span className={it.tone ? `dd-l ally ${it.tone}` : "dd-l"}>{it.label}</span>{it.sub && <span className="dd-s">{it.sub}</span>}
                </button>
              )) : <p className="caption dd-none">Nothing matches.</p>}
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
