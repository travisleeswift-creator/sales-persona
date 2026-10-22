"use client";

import { ThemeBridge } from "@/components/theme-context";
import { TrpcProvider } from "@/lib/trpc";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TrpcProvider>
      <ThemeBridge>{children}</ThemeBridge>
    </TrpcProvider>
  );
}
