"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useThemeControls } from "@/components/theme-context";

const LINKS = [
  { href: "/", label: "Train" },
  { href: "/history", label: "History" },
  { href: "/analytics", label: "Analytics" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/themes", label: "Themes" },
];

export function AppHeader() {
  const pathname = usePathname();
  const { mode, setMode } = useThemeControls();
  const nextMode = mode === "dark" ? "light" : "dark";

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-elev/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="group flex items-baseline gap-2">
          <span className="font-serif text-2xl leading-none tracking-tight">Counterline</span>
          <span className="text-xs uppercase tracking-[0.18em] text-muted">Trainer</span>
        </Link>
        <nav aria-label="Primary" className="flex flex-1 flex-wrap gap-1">
          {LINKS.map((link) => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-full px-3 py-1.5 text-sm ${active ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={() => setMode(nextMode)}
          className="rounded-full border border-line px-3 py-1.5 text-sm"
          aria-pressed={mode === "dark"}
        >
          {mode === "dark" ? "Light floor" : "Dark floor"}
        </button>
      </div>
    </header>
  );
}
