import type { MenuItem } from "./types";
import { normalizeCategory } from "./catalog";

export function money(value?: number | null) {
  if (typeof value !== "number") return "N/A";
  return value.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
  });
}

export function safeNumber(value?: number | null) {
  return typeof value === "number" ? value : 0;
}

export function isReasonableItem(item: MenuItem) {
  const calories = safeNumber(item.macros?.calories);
  const protein = safeNumber(item.macros?.protein_g);
  const carbs = safeNumber(item.macros?.carbs_g);
  const fat = safeNumber(item.macros?.fat_g);
  const sodium = safeNumber(item.macros?.sodium_mg);
  const sugar = safeNumber(item.macros?.sugar_g);
  const category = normalizeCategory(item.category);
  const itemName = String(item.item_name || "").toLowerCase();

  if (item.nutrition_invalid) return false;
  if (!item.item_name || !item.restaurant_name || item.price_cad == null) return false;
  if (protein > 135 || carbs > 520 || fat > 180 || calories > 2800 || sodium > 8000)
    return false;
  if (calories <= 20 && (protein > 15 || carbs > 15 || fat > 8)) return false;
  if (category === "tea" || category === "coffee") {
    if (protein > 20 || calories > 1200) return false;
  }
  if (
    /(root beer|coke|cola|sprite|fanta|iced tea|tea|coffee|latte|americano|cappuccino|dr pepper|pepsi)/.test(
      itemName,
    ) &&
    protein > 10
  ) {
    return false;
  }
  if (category === "smoothie" && protein > 65) {
    return false;
  }
  if (item.restaurant_id === "tim_hortons_ca" && calories <= 50 && protein >= 50)
    return false;
  if (item.restaurant_id === "milestones_ca" && protein >= 120) return false;
  if (item.restaurant_id === "aw_ca" && (carbs >= 250 || fat >= 120)) return false;
  if (item.restaurant_id === "chipotle_ca" && (carbs >= 250 || fat >= 150)) return false;
  if (item.restaurant_id === "triple_os_ca" && calories === 0 && (carbs > 0 || fat > 0))
    return false;
  if (sugar > 250) return false;

  return true;
}

export function isShowcaseItem(item: MenuItem) {
  if (!isReasonableItem(item)) return false;
  const calories = safeNumber(item.macros?.calories);
  const name = String(item.item_name || "").toLowerCase();
  const category = normalizeCategory(item.category);

  if ((item.price_cad || 0) < 2.5) return false;
  if (calories < 60) return false;
  if (category === "tea" || category === "coffee") return false;
  if (
    /(packet|sauce|dressing|dip|wasabi|lemon|mustard|ketchup|cream|syrup|fruit cup|rice - regular|white rice|brown rice|steamed rice|water)/.test(
      name,
    )
  ) {
    return false;
  }

  return true;
}

export function proteinValue(item: MenuItem) {
  const price = item.price_cad || 0;
  if (!price) return 0;
  return safeNumber(item.macros?.protein_g) / price;
}

export function scoreItem(item: MenuItem) {
  const protein = safeNumber(item.macros?.protein_g) * 3.2;
  const calories = safeNumber(item.macros?.calories) * 0.014;
  const sodium = safeNumber(item.macros?.sodium_mg) * 0.001;
  const sugar = safeNumber(item.macros?.sugar_g) * 0.08;
  const pricePenalty = (item.price_cad || 0) * 0.32;
  return protein - calories - sodium - sugar - pricePenalty;
}

export function compactMacros(item: MenuItem) {
  return [
    `${Math.round(safeNumber(item.macros?.protein_g))}g protein`,
    `${Math.round(safeNumber(item.macros?.calories))} cal`,
    `${Math.round(safeNumber(item.macros?.sodium_mg))}mg sodium`,
  ];
}
