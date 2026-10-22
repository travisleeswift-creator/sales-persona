import type { Metadata } from "next";
import { ThemesScreen } from "@/components/ThemesScreen";

export const metadata: Metadata = { title: "Themes" };

export default function ThemesPage() {
  return <ThemesScreen />;
}
