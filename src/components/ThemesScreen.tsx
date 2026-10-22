"use client";

import { ThemeSelector } from "@/components/ThemeSelector";
import { StatusNote } from "@/components/StatusNote";
import { useThemeControls } from "@/components/theme-context";
import { trpc } from "@/lib/trpc";

export function ThemesScreen() {
  const themes = trpc.themeCRUD.list.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const { mode, themeId, setMode, applyTheme } = useThemeControls();
  const create = trpc.themeCRUD.create.useMutation({
    onSuccess: async (theme) => {
      await utils.themeCRUD.list.invalidate();
      applyTheme(theme);
    },
  });
  const remove = trpc.themeCRUD.delete.useMutation({
    onSuccess: async () => {
      await utils.themeCRUD.list.invalidate();
      await utils.themeCRUD.getActive.invalidate();
    },
  });

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8 sm:px-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted">Themes</p>
        <h1 className="mt-2 font-serif text-5xl">Palettes for the floor</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Each counter has a palette. Light and dark keep the accent and swap the paper. Custom themes are saved with the rest of the data.
        </p>
      </div>
      <StatusNote loading={themes.isLoading} error={themes.error?.message ?? create.error?.message ?? remove.error?.message} />
      {themes.data ? (
        <ThemeSelector
          themes={themes.data}
          activeThemeId={themeId}
          mode={mode}
          pending={create.isPending}
          onMode={setMode}
          onSelect={(theme) => applyTheme(theme)}
          onCreate={(input) => create.mutate(input)}
          onDelete={(id) => remove.mutate({ id })}
        />
      ) : null}
    </div>
  );
}
