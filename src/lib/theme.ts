import type { Palette, PersonaId, ThemeMode } from "@/lib/domain";

export const LIGHT_NEUTRALS = {
  bg: "#f3ecdf",
  bgElev: "#fffaf3",
  ink: "#1c1712",
  muted: "#625c53",
  line: "#e4d8c6",
} as const;

export const DARK_NEUTRALS = {
  bg: "#12110e",
  bgElev: "#1c1a16",
  ink: "#f6f1e7",
  muted: "#b7ad9f",
  line: "#3a342c",
} as const;

export const CSS_VAR_MAP: Record<keyof Palette, string> = {
  bg: "--bg",
  bgElev: "--bg-elev",
  ink: "--ink",
  muted: "--muted",
  line: "--line",
  accent: "--accent",
  accentInk: "--accent-ink",
  good: "--good",
  bad: "--bad",
  warn: "--warn",
};

export const PERSONA_ACCENTS: Record<PersonaId, { accent: string; accentInk: string; tint: string }> = {
  "burger-bar": { accent: "#c2410c", accentInk: "#fff7ed", tint: "#ffedd5" },
  "chicken-shop": { accent: "#d97706", accentInk: "#1c1305", tint: "#fef3c7" },
  "off-licence": { accent: "#d6b25e", accentInk: "#1a1408", tint: "#1e3329" },
  grocer: { accent: "#3f7d4e", accentInk: "#f3fae8", tint: "#e7f3d8" },
  pub: { accent: "#e7c27a", accentInk: "#22180c", tint: "#3a2418" },
  club: { accent: "#f472b6", accentInk: "#1a0a12", tint: "#2a1020" },
  hairdresser: { accent: "#be4b6a", accentInk: "#fff5f7", tint: "#fde7ec" },
};

const LIGHT_STATUS = { good: "#276749", bad: "#9b2c2c", warn: "#975a16" };
const DARK_STATUS = { good: "#6ee7b7", bad: "#fca5a5", warn: "#fcd34d" };

export const PAPER_PALETTE: Palette = {
  ...LIGHT_NEUTRALS,
  accent: "#9a3412",
  accentInk: "#fff7ed",
  ...LIGHT_STATUS,
};

export const INK_PALETTE: Palette = {
  ...DARK_NEUTRALS,
  accent: "#fb923c",
  accentInk: "#1c1008",
  ...DARK_STATUS,
};

export type BuiltInTheme = {
  id: string;
  name: string;
  mode: ThemeMode;
  palette: Palette;
  isBuiltIn: boolean;
  personaId: PersonaId | null;
};

function personaPalette(id: PersonaId, mode: ThemeMode): Palette {
  const accent = PERSONA_ACCENTS[id];
  const neutrals = mode === "dark" ? DARK_NEUTRALS : LIGHT_NEUTRALS;
  const status = mode === "dark" ? DARK_STATUS : LIGHT_STATUS;
  return {
    ...neutrals,
    accent: accent.accent,
    accentInk: accent.accentInk,
    ...status,
  };
}

export function builtinThemes(): BuiltInTheme[] {
  return [
    { id: "paper", name: "Paper", mode: "light", palette: PAPER_PALETTE, isBuiltIn: true, personaId: null },
    { id: "ink", name: "Ink", mode: "dark", palette: INK_PALETTE, isBuiltIn: true, personaId: null },
    {
      id: "theme-burger-bar",
      name: "Burger Bar",
      mode: "light",
      palette: personaPalette("burger-bar", "light"),
      isBuiltIn: true,
      personaId: "burger-bar",
    },
    {
      id: "theme-chicken-shop",
      name: "Chicken Shop",
      mode: "light",
      palette: personaPalette("chicken-shop", "light"),
      isBuiltIn: true,
      personaId: "chicken-shop",
    },
    {
      id: "theme-off-licence",
      name: "Off Licence",
      mode: "dark",
      palette: personaPalette("off-licence", "dark"),
      isBuiltIn: true,
      personaId: "off-licence",
    },
    {
      id: "theme-grocer",
      name: "Grocer",
      mode: "light",
      palette: personaPalette("grocer", "light"),
      isBuiltIn: true,
      personaId: "grocer",
    },
    {
      id: "theme-pub",
      name: "Pub",
      mode: "dark",
      palette: personaPalette("pub", "dark"),
      isBuiltIn: true,
      personaId: "pub",
    },
    {
      id: "theme-club",
      name: "Club",
      mode: "dark",
      palette: personaPalette("club", "dark"),
      isBuiltIn: true,
      personaId: "club",
    },
    {
      id: "theme-hairdresser",
      name: "Hairdresser",
      mode: "light",
      palette: personaPalette("hairdresser", "light"),
      isBuiltIn: true,
      personaId: "hairdresser",
    },
  ];
}

export function resolvePalette(base: Palette, baseMode: ThemeMode, mode: ThemeMode): Palette {
  if (mode === baseMode) return base;
  const neutrals = mode === "dark" ? DARK_NEUTRALS : LIGHT_NEUTRALS;
  return { ...base, ...neutrals };
}

export function applyPalette(palette: Palette, mode: ThemeMode): void {
  const root = document.documentElement;
  root.dataset.mode = mode;
  (Object.keys(CSS_VAR_MAP) as Array<keyof Palette>).forEach((key) => {
    root.style.setProperty(CSS_VAR_MAP[key], palette[key]);
  });
}

export const THEME_STORAGE_KEY = "spt-theme-v1";

export type StoredTheme = {
  themeId: string;
  mode: ThemeMode;
  baseMode: ThemeMode;
  base: Palette;
};

let cachedThemeRaw: string | null = null;
let cachedTheme: StoredTheme | null = null;

function parseStoredTheme(raw: string | null): StoredTheme | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredTheme;
    if (!parsed.base || !parsed.mode || !parsed.themeId || !parsed.baseMode) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function readStoredTheme(): StoredTheme | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (raw === cachedThemeRaw) return cachedTheme;
  cachedThemeRaw = raw;
  cachedTheme = parseStoredTheme(raw);
  return cachedTheme;
}

export function serverStoredTheme(): StoredTheme | null {
  return null;
}

export function subscribeStoredTheme(onStoreChange: () => void): () => void {
  window.addEventListener("spt-theme", onStoreChange);
  return () => window.removeEventListener("spt-theme", onStoreChange);
}

export function writeStoredTheme(value: StoredTheme): void {
  const raw = JSON.stringify(value);
  cachedThemeRaw = raw;
  cachedTheme = value;
  window.localStorage.setItem(THEME_STORAGE_KEY, raw);
  window.dispatchEvent(new Event("spt-theme"));
}

export function themeBootScript(): string {
  return `(function(){try{var raw=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(!raw)return;var t=JSON.parse(raw);var light=${JSON.stringify(LIGHT_NEUTRALS)};var dark=${JSON.stringify(DARK_NEUTRALS)};var map=${JSON.stringify(CSS_VAR_MAP)};var palette=Object.assign({},t.base||{});if(t.base&&t.mode&&t.baseMode&&t.mode!==t.baseMode){palette=Object.assign({},palette,t.mode==="dark"?dark:light);}var root=document.documentElement;root.dataset.mode=t.mode||"light";for(var key in map){if(palette[key])root.style.setProperty(map[key],palette[key]);}}catch(e){}})();`;
}
