import { SearchPageClient } from "@/components/search-page-client";

export default async function SearchPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawQuery = params?.q;
  const initialQuery = Array.isArray(rawQuery) ? rawQuery[0] ?? "" : rawQuery ?? "";

  return <SearchPageClient key={initialQuery} initialQuery={initialQuery} />;
}
