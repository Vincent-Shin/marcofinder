import type { MenuItem } from "./types";

export type HighlightCategory = {
  key: string;
  label: string;
  icon: string;
};

const CATEGORY_META: Record<string, HighlightCategory> = {
  burger: { key: "burger", label: "Burgers", icon: "\u{1F354}" },
  bowl: { key: "bowl", label: "Bowls", icon: "\u{1F963}" },
  pizza: { key: "pizza", label: "Pizza", icon: "\u{1F355}" },
  chicken: { key: "chicken", label: "Chicken", icon: "\u{1F357}" },
  salad: { key: "salad", label: "Salads", icon: "\u{1F957}" },
  indian: { key: "indian", label: "Indian", icon: "\u{1F35B}" },
  sushi: { key: "sushi", label: "Sushi", icon: "\u{1F363}" },
  breakfast: { key: "breakfast", label: "Breakfast", icon: "\u{1F95E}" },
  dessert: { key: "dessert", label: "Dessert", icon: "\u{1F9C1}" },
  sandwich: { key: "sandwich", label: "Sandwiches", icon: "\u{1F96A}" },
  wrap: { key: "wrap", label: "Wraps", icon: "\u{1F32F}" },
  coffee: { key: "coffee", label: "Coffee", icon: "\u2615" },
  smoothie: { key: "smoothie", label: "Smoothies", icon: "\u{1F964}" },
  fries: { key: "fries", label: "Fries", icon: "\u{1F35F}" },
  seafood: { key: "seafood", label: "Seafood", icon: "\u{1F990}" },
  soup: { key: "soup", label: "Soup", icon: "\u{1F372}" },
  pasta: { key: "pasta", label: "Pasta", icon: "\u{1F35D}" },
  tea: { key: "tea", label: "Tea", icon: "\u{1FAD6}" },
  other: { key: "other", label: "Other", icon: "\u{1F37D}" },
};

const CURATED_HIGHLIGHT_ORDER = [
  "chicken",
  "pizza",
  "salad",
  "sushi",
  "dessert",
  "seafood",
  "bowl",
  "fries",
  "coffee",
  "sandwich",
];

export function normalizeCategory(raw?: string | null) {
  const value = String(raw || "").trim().toLowerCase();
  if (!value) return "other";
  if (value.includes("burger")) return "burger";
  if (value.includes("pizza")) return "pizza";
  if (value.includes("bowl")) return "bowl";
  if (value.includes("chicken")) return "chicken";
  if (value.includes("salad")) return "salad";
  if (value.includes("sushi")) return "sushi";
  if (value.includes("breakfast")) return "breakfast";
  if (value.includes("dessert")) return "dessert";
  if (value.includes("sandwich") || value.includes("sub")) return "sandwich";
  if (value.includes("wrap")) return "wrap";
  if (value.includes("coffee") || value.includes("latte")) return "coffee";
  if (value.includes("tea")) return "tea";
  if (value.includes("smoothie") || value.includes("juice")) return "smoothie";
  if (value.includes("fries")) return "fries";
  if (value.includes("seafood") || value.includes("shrimp") || value.includes("fish")) {
    return "seafood";
  }
  if (value.includes("soup")) return "soup";
  if (value.includes("pasta")) return "pasta";
  if (value.includes("indian") || value.includes("curry") || value.includes("tikka")) {
    return "indian";
  }
  return CATEGORY_META[value] ? value : "other";
}

export function getCategoryMeta(raw?: string | null) {
  const key = normalizeCategory(raw);
  return CATEGORY_META[key] || CATEGORY_META.other;
}

export function topHighlightCategories(items: MenuItem[]) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = normalizeCategory(item.category);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return CURATED_HIGHLIGHT_ORDER.filter((key) => (counts.get(key) || 0) > 0).map(
    (key) => CATEGORY_META[key],
  );
}

export function imageLabel(item: MenuItem) {
  return getCategoryMeta(item.category).icon;
}
