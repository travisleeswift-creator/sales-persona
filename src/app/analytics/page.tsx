import type { Metadata } from "next";
import { AnalyticsScreen } from "@/components/AnalyticsScreen";

export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsPage() {
  return <AnalyticsScreen />;
}
