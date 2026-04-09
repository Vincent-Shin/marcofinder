import { Link, useNavigate } from "@remix-run/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { fetchItems, fetchRestaurants } from "../lib/api";
import { useAppState } from "../lib/app-state";
import {
  getCategoryMeta,
  imageLabel,
  normalizeCategory,
  topHighlightCategories,
  type HighlightCategory,
} from "../lib/catalog";
import { describeRestaurant } from "../lib/restaurants";
import {
  compactMacros,
  isReasonableItem,
  isShowcaseItem,
  money,
  proteinValue,
  safeNumber,
  scoreItem,
} from "../lib/scoring";
import type { MenuItem, RestaurantSummary } from "../lib/types";

type SortMode =
  | "best-overall"
  | "protein-dollar"
  | "lowest-calories"
  | "lowest-sodium"
  | "lowest-fat";

type SectionKey = "protein" | "overall" | "calories" | "sodium" | "fat";

type SectionConfig = {
  key: SectionKey;
  title: string;
  subtitle: string;
  items: MenuItem[];
};

type SectionRowProps = SectionConfig & {
  sectionKey: SectionKey;
  compareKeys: string[];
  savedKeys: string[];
  toggleCompare: (key: string) => void;
  toggleSaved: (key: string) => void;
  navigate: (to: string) => void;
};

export function meta() {
  return [
    { title: "Macro Finder | Discover" },
    {
      name: "description",
      content: "Find cheaper restaurant meals with cleaner macros.",
    },
  ];
}

function categoryMatches(item: MenuItem, selectedCategory: string) {
  if (!selectedCategory) return true;
  return normalizeCategory(item.category) === selectedCategory;
}

function ranked(items: MenuItem[], mode: SortMode) {
  const next = [...items];
  if (mode === "protein-dollar") {
    return next.sort((left, right) => proteinValue(right) - proteinValue(left));
  }
  if (mode === "lowest-calories") {
    return next.sort(
      (left, right) =>
        safeNumber(left.macros?.calories) - safeNumber(right.macros?.calories),
    );
  }
  if (mode === "lowest-sodium") {
    return next.sort(
      (left, right) =>
        safeNumber(left.macros?.sodium_mg) - safeNumber(right.macros?.sodium_mg),
    );
  }
  if (mode === "lowest-fat") {
    return next.sort(
      (left, right) => safeNumber(left.macros?.fat_g) - safeNumber(right.macros?.fat_g),
    );
  }
  return next.sort((left, right) => scoreItem(right) - scoreItem(left));
}

function SectionRow({
  sectionKey,
  title,
  subtitle,
  items,
  compareKeys,
  savedKeys,
  toggleCompare,
  toggleSaved,
  navigate,
}: SectionRowProps) {
  return (
    <section className="section-shell">
      <div className="section-head">
        <div>
          <p className="eyebrow">{subtitle}</p>
          <h2>
            <Link to={`/rankings/${sectionKey}`} className="section-title-link">
              {title}
            </Link>
          </h2>
        </div>
        <Link to={`/rankings/${sectionKey}`} className="ghost-pill">
          View full ranking
        </Link>
      </div>

      <div className="rail">
        {items.map((item) => {
          const isCompared = compareKeys.includes(item.unique_key);
          const isSaved = savedKeys.includes(item.unique_key);
          const compareDisabled =
            compareKeys.length >= 3 && !compareKeys.includes(item.unique_key);
          const category = getCategoryMeta(item.category);

          return (
            <article key={item.unique_key} className="highlight-card">
              <div className="visual-card">
                <div className={`card-visual category-${category.key}`}>
                  <span className="card-visual-icon">{imageLabel(item)}</span>
                  <span className="image-chip">Preview</span>
                </div>
                <div className="visual-copy">
                  <div className="card-top">
                    <span className="metric-badge">{money(item.price_cad)}</span>
                    <button
                      type="button"
                      className={`save-button ${isSaved ? "is-active" : ""}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleSaved(item.unique_key);
                      }}
                      aria-label="Save meal"
                    >
                      {isSaved ? "Love" : "Save"}
                    </button>
                  </div>

                  <button
                    type="button"
                    className="card-main"
                    onClick={() =>
                      navigate(`/meals/${encodeURIComponent(item.unique_key)}`)
                    }
                  >
                    <p className="restaurant-label">{item.restaurant_name}</p>
                    <h3>{item.item_name}</h3>
                    <p className="card-category">
                      {category.label}
                      {item.portion ? ` | ${item.portion}` : ""}
                    </p>
                    {item.description ? (
                      <p className="list-description">{item.description}</p>
                    ) : null}
                  </button>

                  <div className="macro-row">
                    {compactMacros(item).map((macro) => (
                      <span key={macro}>{macro}</span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="card-actions">
                <Link
                  to={`/restaurants/${item.restaurant_id}`}
                  className="ghost-pill restaurant-action"
                >
                  Restaurant
                </Link>
                <button
                  type="button"
                  className="primary-pill"
                  disabled={compareDisabled}
                  onClick={() => toggleCompare(item.unique_key)}
                >
                  {isCompared ? "Remove" : "Add compare"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default function DiscoverRoute() {
  const navigate = useNavigate();
  const { compareKeys, toggleCompare, savedKeys, toggleSaved } = useAppState();
  const resultsRef = useRef<HTMLElement | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [restaurants, setRestaurants] = useState<RestaurantSummary[]>([]);
  const [query, setQuery] = useState("");
  const [restaurantId, setRestaurantId] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("best-overall");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [restaurantsResponse, itemsResponse] = await Promise.all([
          fetchRestaurants(),
          fetchItems({ pricedOnly: true, limit: 5000 }),
        ]);
        setRestaurants(restaurantsResponse);
        setItems(itemsResponse.items.filter(isReasonableItem));
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : "Failed to load data",
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const categoryOptions = useMemo<HighlightCategory[]>(
    () => topHighlightCategories(items),
    [items],
  );

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const next = items.filter((item) => {
      if (restaurantId && item.restaurant_id !== restaurantId) return false;
      if (!categoryMatches(item, selectedCategory)) return false;
      if (!isShowcaseItem(item)) return false;
      if (!normalizedQuery) return true;
      const haystack =
        `${item.restaurant_name} ${item.item_name} ${item.category || ""}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
    return ranked(next, sortMode);
  }, [items, query, restaurantId, selectedCategory, sortMode]);

  const topRestaurants = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      counts.set(item.restaurant_id, (counts.get(item.restaurant_id) || 0) + 1);
    }
    return restaurants
      .map((restaurant) => ({
        ...restaurant,
        sane_count: counts.get(restaurant.restaurant_id) || 0,
      }))
      .filter((restaurant) => restaurant.sane_count > 0)
      .sort((left, right) => right.sane_count - left.sane_count)
      .slice(0, 8);
  }, [items, restaurants]);

  const sectionRows = useMemo<SectionConfig[]>(() => {
    const scoped = filteredItems;
    const sections: SectionConfig[] = [
      {
        key: "protein",
        title: "Highest protein meals in the city",
        subtitle: "Best for hitting your target",
        items: [...scoped]
          .sort(
            (left, right) =>
              safeNumber(right.macros?.protein_g) - safeNumber(left.macros?.protein_g),
          )
          .slice(0, 6),
      },
      {
        key: "overall",
        title: "Best overall macro score",
        subtitle: "Balanced picks across price and nutrition",
        items: [...scoped]
          .sort((left, right) => scoreItem(right) - scoreItem(left))
          .slice(0, 6),
      },
      {
        key: "calories",
        title: "Lowest calories",
        subtitle: "Lighter options with usable price points",
        items: [...scoped]
          .sort(
            (left, right) =>
              safeNumber(left.macros?.calories) - safeNumber(right.macros?.calories),
          )
          .slice(0, 6),
      },
      {
        key: "sodium",
        title: "Lowest sodium",
        subtitle: "Good when salt is the constraint",
        items: [...scoped]
          .sort(
            (left, right) =>
              safeNumber(left.macros?.sodium_mg) - safeNumber(right.macros?.sodium_mg),
          )
          .slice(0, 6),
      },
      {
        key: "fat",
        title: "Lowest fat",
        subtitle: "Leanest picks across the current filter",
        items: [...scoped]
          .sort(
            (left, right) =>
              safeNumber(left.macros?.fat_g) - safeNumber(right.macros?.fat_g),
          )
          .slice(0, 6),
      },
    ];

    const priorityKey: SectionKey =
      sortMode === "protein-dollar"
        ? "protein"
        : sortMode === "lowest-calories"
          ? "calories"
          : sortMode === "lowest-sodium"
            ? "sodium"
            : sortMode === "lowest-fat"
              ? "fat"
              : "overall";

    return [
      ...sections.filter((section) => section.key === priorityKey),
      ...sections.filter((section) => section.key !== priorityKey),
    ];
  }, [filteredItems, sortMode]);

  function jumpToResults() {
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main className="container page-grid discover-page">
      <section className="hero-shell">
        <div className="hero-card">
          <div className="hero-copy">
            <span className="eyebrow">Macro Finder</span>
            <h1>Find the cheapest nutrition that still fits your goals.</h1>
            <p>
              Browse restaurant meals with cleaner nutrition data, search by meal
              or restaurant, and rank picks by the metric that actually matters.
            </p>
          </div>

          <div className="discover-toolbar">
            <label className="search-shell">
              <span>Search</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search restaurants or meals"
              />
            </label>

            <select
              className="hero-select"
              value={restaurantId}
              onChange={(event) => setRestaurantId(event.target.value)}
            >
              <option value="">All restaurants</option>
              {restaurants.map((restaurant) => (
                <option key={restaurant.restaurant_id} value={restaurant.restaurant_id}>
                  {restaurant.restaurant_name}
                </option>
              ))}
            </select>

            <select
              className="hero-select"
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
            >
              <option value="best-overall">Best overall macro score</option>
              <option value="protein-dollar">Protein / $</option>
              <option value="lowest-calories">Lowest calories</option>
              <option value="lowest-sodium">Lowest sodium</option>
              <option value="lowest-fat">Lowest fat</option>
            </select>

            <button
              type="button"
              className="primary-pill hero-search-button"
              onClick={jumpToResults}
            >
              Search
            </button>
          </div>
        </div>
      </section>

      <section className="section-shell section-shell--compact">
        <div className="section-head">
          <div>
            <p className="eyebrow">Restaurants</p>
            <h2>Browse complete menus first</h2>
          </div>
          <span>{topRestaurants.length} strong sources</span>
        </div>

        <div className="restaurant-rail">
          {topRestaurants.map((restaurant) => (
            <Link
              key={restaurant.restaurant_id}
              to={`/restaurants/${restaurant.restaurant_id}`}
              className={`restaurant-tile ${
                restaurantId === restaurant.restaurant_id ? "is-active" : ""
              }`}
            >
              <strong>{restaurant.restaurant_name}</strong>
              <p className="restaurant-tile-copy">
                {describeRestaurant(
                  restaurant.restaurant_id,
                  restaurant.restaurant_name,
                )}
              </p>
              <span>{restaurant.sane_count} clean items</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="section-shell section-shell--compact">
        <div className="section-head">
          <div>
            <p className="eyebrow">Macro highlights</p>
            <h2>Jump to the food you actually want</h2>
          </div>
          <button
            type="button"
            className="ghost-pill"
            onClick={() => {
              setSelectedCategory("");
              setSortMode("best-overall");
            }}
          >
            Reset all
          </button>
        </div>

        <div className="category-rail">
          <button
            type="button"
            className={`category-chip ${selectedCategory === "" ? "is-active" : ""}`}
            onClick={() => {
              setSelectedCategory("");
              jumpToResults();
            }}
          >
            <span className="category-icon">All</span>
            <span>All</span>
          </button>
          {categoryOptions.map((category) => (
            <button
              key={category.key}
              type="button"
              className={`category-chip ${
                selectedCategory === category.key ? "is-active" : ""
              }`}
              onClick={() => {
                setSelectedCategory(category.key);
                jumpToResults();
              }}
            >
              <span className="category-icon">{category.icon}</span>
              <span>{category.label}</span>
            </button>
          ))}
        </div>

        <div className="metric-chip-row">
          <button
            type="button"
            className={`metric-chip ${sortMode === "best-overall" ? "is-active" : ""}`}
            onClick={() => {
              setSortMode("best-overall");
              jumpToResults();
            }}
          >
            Best overall
          </button>
          <button
            type="button"
            className={`metric-chip ${sortMode === "protein-dollar" ? "is-active" : ""}`}
            onClick={() => {
              setSortMode("protein-dollar");
              jumpToResults();
            }}
          >
            Protein / $
          </button>
          <button
            type="button"
            className={`metric-chip ${sortMode === "lowest-calories" ? "is-active" : ""}`}
            onClick={() => {
              setSortMode("lowest-calories");
              jumpToResults();
            }}
          >
            Lowest calories
          </button>
          <button
            type="button"
            className={`metric-chip ${sortMode === "lowest-sodium" ? "is-active" : ""}`}
            onClick={() => {
              setSortMode("lowest-sodium");
              jumpToResults();
            }}
          >
            Lowest sodium
          </button>
          <button
            type="button"
            className={`metric-chip ${sortMode === "lowest-fat" ? "is-active" : ""}`}
            onClick={() => {
              setSortMode("lowest-fat");
              jumpToResults();
            }}
          >
            Lowest fat
          </button>
          <Link to="/profile" className="metric-chip metric-chip--saved">
            Love / Save
          </Link>
        </div>
      </section>

      {error ? <div className="error-banner">{error}</div> : null}
      {loading ? <div className="loading-card">Loading clean nutrition data...</div> : null}

      <section ref={resultsRef} className="discover-results-anchor" aria-hidden="true" />

      {!loading &&
        sectionRows.map((section) => (
          <SectionRow
            key={section.key}
            sectionKey={section.key}
            title={section.title}
            subtitle={section.subtitle}
            items={section.items}
            compareKeys={compareKeys}
            savedKeys={savedKeys}
            toggleCompare={toggleCompare}
            toggleSaved={toggleSaved}
            navigate={navigate}
          />
        ))}
    </main>
  );
}
