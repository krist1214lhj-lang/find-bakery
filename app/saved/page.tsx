import type { Metadata } from "next";
import { SavedBakeryList } from "@/components/saved-bakery-list";
import { getAllBakeries } from "@/lib/bakery-repository";

export const metadata: Metadata = {
  title: "저장한 빵집",
};

export const dynamic = "force-dynamic";

export default async function SavedPage() {
  const bakeries = await getAllBakeries();

  return (
    <section className="page-section">
      <span className="eyebrow">MY BREAD ROUTE</span>
      <h1>저장한 빵집</h1>
      <SavedBakeryList bakeries={bakeries} />
    </section>
  );
}
