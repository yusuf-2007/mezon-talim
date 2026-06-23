/**
 * Slugify Latin/Uzbek titles into URL-safe course slugs. Transliterates the few
 * Uzbek special letters and strips diacritics; callers should still guarantee
 * uniqueness against existing slugs.
 */
const UZ_MAP: Record<string, string> = {
  "ʻ": "",
  "'": "",
  "`": "",
  oʻ: "o",
  gʻ: "g",
};

export function slugify(input: string): string {
  let s = input.trim().toLowerCase();
  for (const [from, to] of Object.entries(UZ_MAP)) {
    s = s.split(from).join(to);
  }
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics
    .replace(/[^a-z0-9]+/g, "-") // non-alphanumerics → hyphen
    .replace(/^-+|-+$/g, "") // trim hyphens
    .slice(0, 80);
}

/** Money helpers: integer tiyin ⇄ so'm. Never store/compute money as float. */
export const somToTiyin = (som: number): number => Math.round(som * 100);
export const tiyinToSom = (tiyin: number): number => Math.round(tiyin / 100);
