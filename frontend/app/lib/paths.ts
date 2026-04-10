/** Consistent in-app links for meals and restaurants (always encode keys). */
export function mealPath(uniqueKey: string): string {
  return `/meals/${encodeURIComponent(uniqueKey)}`;
}

export function restaurantPath(restaurantId: string): string {
  return `/restaurants/${encodeURIComponent(restaurantId)}`;
}
