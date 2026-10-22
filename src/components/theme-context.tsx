"use client";

import { createContext, useContext, useEffect, useSyncExternalStore } from "react";
import type { Palette, ThemeMode } from "@/lib/domain";
import {
  applyPalette,
  readStoredTheme,
  resolvePalette,
  serverStoredTheme,
  subscribeStoredTheme,
  writeStoredTheme,
  type StoredTheme,
} from "@/lib/theme";
import { trpc } from "@/lib/trpc";

type ThemeContextValue = {
  mode: ThemeMode;
  themeId: string;
  setMode: (mode: ThemeMode) => void;
  applyTheme: (theme: { id: string; mode: ThemeMode; palette: Palette }, modeOverride?: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function sameTheme(left: StoredTheme | null, right: StoredTheme): boolean {
  if (!left) return false;
  return left.themeId === right.themeId && left.mode === right.mode && left.baseMode === right.baseMode && JSON.stringify(left.base) === JSON.stringify(right.base);
}

export function ThemeBridge({ children }: { children: React.ReactNode }) {
  const active = trpc.themeCRUD.getActive.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const setActive = trpc.themeCRUD.setActive.useMutation({
    onSuccess: async () => {
      await utils.themeCRUD.getActive.invalidate();
    },
  });
  const stored = useSyncExternalStore(subscribeStoredTheme, readStoredTheme, serverStoredTheme);

  useEffect(() => {
    if (!active.data) return;
    const next: StoredTheme = {
      themeId: active.data.themeId,
      mode: active.data.mode,
      baseMode: active.data.baseMode,
      base: active.data.base,
    };
    if (!sameTheme(readStoredTheme(), next)) writeStoredTheme(next);
    applyPalette(resolvePalette(next.base, next.baseMode, next.mode), next.mode);
  }, [active.data]);

  useEffect(() => {
    if (!stored) return;
    applyPalette(resolvePalette(stored.base, stored.baseMode, stored.mode), stored.mode);
  }, [stored]);

  const persist = (next: StoredTheme) => {
    writeStoredTheme(next);
    applyPalette(resolvePalette(next.base, next.baseMode, next.mode), next.mode);
    setActive.mutate({ themeId: next.themeId, mode: next.mode });
  };

  const setMode = (mode: ThemeMode) => {
    const base =
      stored ??
      (active.data
        ? {
            themeId: active.data.themeId,
            mode: active.data.mode,
            baseMode: active.data.baseMode,
            base: active.data.base,
          }
        : null);
    if (!base) return;
    persist({ ...base, mode });
  };

  const applyTheme = (theme: { id: string; mode: ThemeMode; palette: Palette }, modeOverride?: ThemeMode) => {
    persist({
      themeId: theme.id,
      mode: modeOverride ?? theme.mode,
      baseMode: theme.mode,
      base: theme.palette,
    });
  };

  return (
    <ThemeContext.Provider value={{ mode: stored?.mode ?? "light", themeId: stored?.themeId ?? "paper", setMode, applyTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeControls(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("Theme controls are only available inside the app shell.");
  return value;
}
