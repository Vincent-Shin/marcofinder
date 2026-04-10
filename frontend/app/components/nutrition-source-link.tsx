import { resolveMediaUrl } from "../lib/media";

export function NutritionSourceLink({ url }: { url?: string | null }) {
  const resolved = resolveMediaUrl(url || null);
  if (!resolved) {
    return <span className="source-pill">No public menu link stored</span>;
  }
  return (
    <a
      href={resolved}
      target="_blank"
      rel="noopener noreferrer"
      className="source-link"
    >
      Open listed source
    </a>
  );
}
