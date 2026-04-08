const RESTAURANT_COPY: Record<string, string> = {
  chopped_leaf_ca:
    "Calgary-friendly salad, bowl, and wrap spot for cleaner lunch options and lighter macros.",
  booster_juice_ca:
    "Smoothies, wraps, and acai bowls that make the healthy-casual side of the app feel more complete.",
  pita_pit_ca:
    "Custom wraps and bowls with better protein flexibility than most fast lunch chains.",
  tim_hortons_ca:
    "Cheap, familiar breakfast and snack menu with a few surprisingly usable protein picks.",
  quiznos_ca:
    "Sandwich-heavy menu where portion size and price make comparison useful.",
  earls_ca:
    "Casual dining menu with broader plate variety when users want something less strictly fast food.",
  joey_ca:
    "Upscale casual chain with richer mains, sushi, and appetizers for higher-price comparisons.",
  joey_restaurants_ca:
    "Upscale casual chain with richer mains, sushi, and appetizers for higher-price comparisons.",
  the_keg_ca:
    "Steakhouse menu that helps surface leaner steak and seafood choices against heavier sides.",
  mr_sub_ca:
    "Sub shop with straightforward lunch builds and easy sandwich comparisons.",
  mary_browns_ca:
    "Fried chicken chain where users can quickly spot the few stronger protein-value combos.",
  boston_pizza_ca:
    "Large menu with pasta, pizza, and mains that benefits from strong filtering and ranking.",
  pf_changs_us:
    "Heavier sit-down menu with sauces and sodium tradeoffs that are hard to judge without data.",
  chipotle_ca:
    "Build-your-own bowls and burritos with reliable macro structure for gym-focused users.",
  freshii_ca:
    "Healthy fast-casual bowls, wraps, and salads built around lighter everyday meals.",
};

export function describeRestaurant(restaurantId: string, restaurantName?: string | null) {
  if (RESTAURANT_COPY[restaurantId]) {
    return RESTAURANT_COPY[restaurantId];
  }
  if (!restaurantName) {
    return "Menu data is available here, so users can compare practical meals without guessing.";
  }
  return `${restaurantName} is available in Macro Finder for quick price and macro comparison.`;
}
