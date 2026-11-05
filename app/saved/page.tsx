import type { Metadata } from "next";
import { SavedTabs, type SavedTab } from "@/components/saved-tabs";
import { getAllBakeries } from "@/lib/bakery-repository";

export const metadata: Metadata = {
  title: "저장·방문 기록",
};

export const dynamic = "force-dynamic";

type SavedPageProps = {
  searchParams: Promise<{ tab?: string | string[] }>;
};

export default async function SavedPage({ searchParams }: SavedPageProps) {
  const [{ tab }, bakeries] = await Promise.all([
    searchParams,
    getAllBakeries(),
  ]);
  const initialTab: SavedTab = tab === "visited" ? "visited" : "saved";

  return (
    <section className="page-section">
      <span className="eyebrow">MY BREAD ROUTE</span>
      <SavedTabs bakeries={bakeries} initialTab={initialTab} />
    </section>
  );
}
