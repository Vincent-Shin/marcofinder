import { apiBaseUrl } from "./api";
import type { MenuItem, RestaurantSummary } from "./types";

/**
 * Turn stored API / DB URLs into a browser-usable absolute URL.
 * Supports full http(s) links and root-relative paths such as /uploads/...
 */
export function resolveMediaUrl(url: string | null | undefined): string | null {
  const raw = url?.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) {
    const base = apiBaseUrl();
    if (base.startsWith("http")) {
      try {
        return `${new URL(base).origin}${raw}`;
      } catch {
        return raw;
      }
    }
    if (typeof window !== "undefined") {
      const origin = window.location.origin;
      const prefix = base.replace(/\/$/, "");
      return `${origin}${prefix}${raw}`;
    }
    return raw;
  }
  return raw;
}

/** Prefer item image from DB; otherwise nothing (caller shows category fallback). */
export function resolveItemImageUrl(item: MenuItem): string | null {
  return resolveMediaUrl(item.image_url ?? null);
}

export function resolveRestaurantImageUrl(
  restaurant: RestaurantSummary | null | undefined,
): string | null {
  if (!restaurant) return null;
  return resolveMediaUrl(restaurant.restaurant_image_url ?? null);
}
