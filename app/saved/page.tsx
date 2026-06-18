import type { Metadata } from "next";
import { SavedBakeryList } from "@/components/saved-bakery-list";
import { bakeries } from "@/lib/bakeries";

export const metadata: Metadata = {
  title: "저장한 빵집",
};

export default function SavedPage() {
  return (
    <section className="page-section">
      <span className="eyebrow">MY BREAD ROUTE</span>
      <h1>저장한 빵집</h1>
      <SavedBakeryList bakeries={bakeries} />
    </section>
  );
}
