"use client";

import { useState } from "react";
import type { Palette, ThemeMode } from "@/lib/domain";
import { DARK_NEUTRALS, LIGHT_NEUTRALS } from "@/lib/theme";

type ThemeOption = {
  id: string;
  name: string;
  mode: ThemeMode;
  palette: Palette;
  isBuiltIn: boolean;
  personaId: string | null;
};

type ThemeSelectorProps = {
  themes: ThemeOption[];
  activeThemeId: string;
  mode: ThemeMode;
  pending: boolean;
  onSelect: (theme: ThemeOption) => void;
  onMode: (mode: ThemeMode) => void;
  onCreate: (input: { name: string; mode: ThemeMode; palette: Palette }) => void;
  onDelete: (id: string) => void;
};

const STATUS = {
  light: { good: "#276749", bad: "#9b2c2c", warn: "#975a16" },
  dark: { good: "#6ee7b7", bad: "#fca5a5", warn: "#fcd34d" },
};

function paletteFromAccent(accent: string, accentInk: string, mode: ThemeMode): Palette {
  const neutrals = mode === "dark" ? DARK_NEUTRALS : LIGHT_NEUTRALS;
  return { ...neutrals, accent, accentInk, ...STATUS[mode] };
}

export function ThemeSelector(props: ThemeSelectorProps) {
  const [name, setName] = useState("");
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");
  const [accent, setAccent] = useState("#9a3412");
  const [accentInk, setAccentInk] = useState("#fff7ed");

  return (
    <div className="grid gap-8">
      <section className="flex flex-wrap items-center gap-3" aria-label="Light or dark">
        {(["light", "dark"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={props.mode === option}
            onClick={() => props.onMode(option)}
            className={`rounded-full px-4 py-2 text-sm ${props.mode === option ? "bg-ink text-bg" : "border border-line"}`}
          >
            {option === "light" ? "Light" : "Dark"}
          </button>
        ))}
      </section>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {props.themes.map((theme) => {
          const active = theme.id === props.activeThemeId;
          return (
            <li key={theme.id} className="rounded-3xl border border-line bg-elev p-4">
              <div className="flex gap-2" aria-hidden="true">
                {[theme.palette.bg, theme.palette.accent, theme.palette.ink, theme.palette.good].map((colour) => (
                  <span key={colour} className="h-8 flex-1 rounded-full border border-line" style={{ background: colour }} />
                ))}
              </div>
              <h2 className="mt-3 font-serif text-2xl">{theme.name}</h2>
              <p className="text-sm text-muted">
                {theme.mode} · {theme.isBuiltIn ? "Built in" : "Custom"}
                {theme.personaId ? ` · ${theme.personaId}` : ""}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => props.onSelect(theme)}
                  aria-pressed={active}
                  className="rounded-full bg-accent px-3 py-1.5 text-sm text-accent-ink"
                >
                  {active ? "In use" : "Use palette"}
                </button>
                {theme.isBuiltIn ? null : (
                  <button type="button" onClick={() => props.onDelete(theme.id)} className="rounded-full border border-line px-3 py-1.5 text-sm">
                    Remove
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <form
        className="grid gap-4 rounded-3xl border border-line bg-elev p-4 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          props.onCreate({
            name,
            mode: themeMode,
            palette: paletteFromAccent(accent, accentInk, themeMode),
          });
          setName("");
        }}
      >
        <div className="sm:col-span-2">
          <h2 className="font-serif text-3xl">Save a palette</h2>
          <p className="mt-1 text-sm text-muted">Custom themes are stored in the database. Built-in palettes stay put.</p>
        </div>
        <label className="grid gap-1 text-sm">
          Name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            minLength={2}
            maxLength={40}
            className="rounded-2xl border border-line bg-bg px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm">
          Natural mode
          <select
            value={themeMode}
            onChange={(event) => setThemeMode(event.target.value === "dark" ? "dark" : "light")}
            className="rounded-2xl border border-line bg-bg px-3 py-2"
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Accent
          <input value={accent} onChange={(event) => setAccent(event.target.value)} pattern="^#[0-9a-fA-F]{6}$" className="rounded-2xl border border-line bg-bg px-3 py-2 font-mono" />
        </label>
        <label className="grid gap-1 text-sm">
          Accent ink
          <input
            value={accentInk}
            onChange={(event) => setAccentInk(event.target.value)}
            pattern="^#[0-9a-fA-F]{6}$"
            className="rounded-2xl border border-line bg-bg px-3 py-2 font-mono"
          />
        </label>
        <button type="submit" disabled={props.pending} className="sm:col-span-2 w-fit rounded-full bg-ink px-4 py-2 text-sm text-bg disabled:opacity-60">
          {props.pending ? "Saving…" : "Create theme"}
        </button>
      </form>
    </div>
  );
}
