import { notFound } from "next/navigation";

// Any unmatched path under a locale renders the localized 404.
export default function CatchAllPage() {
  notFound();
}
