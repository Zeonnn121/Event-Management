/** Lowercase slug: letters, numbers and single hyphens only. */
export function slugify(value: string, fallback = "council"): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  return slug || fallback;
}
