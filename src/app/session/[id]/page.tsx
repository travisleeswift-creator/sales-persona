import type { Metadata } from "next";
import { SessionScreen } from "@/components/SessionScreen";

export const metadata: Metadata = { title: "Sitting" };

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SessionScreen id={id} />;
}
