import { apiBaseUrl } from "./api";
import type { MenuItem, RestaurantSummary } from "./types";
import { normalizeCategory } from "./catalog";

function hashString(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

const CATEGORY_IMAGES: Record<string, string[]> = {
  sushi: [
    "https://images.pexels.com/photos/357756/pexels-photo-357756.jpeg",
    "https://images.pexels.com/photos/2098085/pexels-photo-2098085.jpeg",
    "https://images.pexels.com/photos/2098143/pexels-photo-2098143.jpeg",
    "https://images.pexels.com/photos/357573/pexels-photo-357573.jpeg",
  ],
  burger: [
    "https://images.pexels.com/photos/1639557/pexels-photo-1639557.jpeg",
    "https://images.pexels.com/photos/2983101/pexels-photo-2983101.jpeg",
    "https://images.pexels.com/photos/70497/pexels-photo-70497.jpeg",
    "https://images.pexels.com/photos/376464/pexels-photo-376464.jpeg",
  ],
  pizza: [
    "https://images.pexels.com/photos/825661/pexels-photo-825661.jpeg",
    "https://images.pexels.com/photos/4109084/pexels-photo-4109084.jpeg",
    "https://images.pexels.com/photos/159688/pexels-photo-159688.jpeg",
    "https://images.pexels.com/photos/2147491/pexels-photo-2147491.jpeg",
  ],
  chicken: [
    "https://images.pexels.com/photos/2338407/pexels-photo-2338407.jpeg",
    "https://images.pexels.com/photos/410648/pexels-photo-410648.jpeg",
    "https://images.pexels.com/photos/262959/pexels-photo-262959.jpeg",
    "https://images.pexels.com/photos/2233729/pexels-photo-2233729.jpeg",
  ],
  salad: [
    "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg",
    "https://images.pexels.com/photos/1213710/pexels-photo-1213710.jpeg",
    "https://images.pexels.com/photos/5938/food-salad-healthy-lunch.jpg",
    "https://images.pexels.com/photos/1092730/pexels-photo-1092730.jpeg",
  ],
  bowl: [
    "https://images.pexels.com/photos/1640774/pexels-photo-1640774.jpeg",
    "https://images.pexels.com/photos/1640772/pexels-photo-1640772.jpeg",
    "https://images.pexels.com/photos/1435907/pexels-photo-1435907.jpeg",
  ],
  dessert: [
    "https://images.pexels.com/photos/291528/pexels-photo-291528.jpeg",
    "https://images.pexels.com/photos/302680/pexels-photo-302680.jpeg",
    "https://images.pexels.com/photos/376464/pexels-photo-376464.jpeg",
  ],
  sandwich: [
    "https://images.pexels.com/photos/1600711/pexels-photo-1600711.jpeg",
    "https://images.pexels.com/photos/1600712/pexels-photo-1600712.jpeg",
  ],
  fries: [
    "https://images.pexels.com/photos/1583884/pexels-photo-1583884.jpeg",
    "https://images.pexels.com/photos/70497/pexels-photo-70497.jpeg",
  ],
  pasta: [
    "https://images.pexels.com/photos/1437267/pexels-photo-1437267.jpeg",
    "https://images.pexels.com/photos/1279330/pexels-photo-1279330.jpeg",
  ],
  seafood: [
    "https://images.pexels.com/photos/725991/pexels-photo-725991.jpeg",
    "https://images.pexels.com/photos/3298688/pexels-photo-3298688.jpeg",
  ],
  other: [
    "https://images.pexels.com/photos/70497/pexels-photo-70497.jpeg",
  ],
};

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

function isBadImage(url: string | null) {
  if (!url) return true;
  const lower = url.toLowerCase();
  return lower.includes("slider") || lower.includes("banner");
}

export function resolveItemImageUrl(item: MenuItem): string | null {
  const dbUrl = resolveMediaUrl(item.image_url ?? null);

  if (dbUrl && !isBadImage(dbUrl)) {
    return dbUrl;
  }

  const category = normalizeCategory(item.category);
  const pool = CATEGORY_IMAGES[category] || CATEGORY_IMAGES.other;

  const index = hashString(item.unique_key) % pool.length;
  return pool[index];
}

export function resolveRestaurantImageUrl(
  restaurant: RestaurantSummary | null | undefined,
): string | null {
  if (!restaurant) return null;
  return resolveMediaUrl(restaurant.restaurant_image_url ?? null);
}