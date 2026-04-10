import { Link, useNavigate, useParams } from "react-router";
import { useEffect, useMemo, useState } from "react";

import { FoodVisualThumb } from "../components/food-visual";
import { fetchItems } from "../lib/api";
import { useAppState } from "../lib/app-state";
import { getCategoryMeta } from "../lib/catalog";
import { mealPath, restaurantPath } from "../lib/paths";
import {
  compactMacros,
  isReasonableItem,
  money,
  proteinValue,
  safeNumber,
  scoreItem,
} from "../lib/scoring";
import type { MenuItem } from "../lib/types";

type RankingMetric =
  | "overall"
  | "protein"
  | "calories"
  | "sodium"
  | "fat";

const RANKING_META: Record<
  RankingMetric,
  { eyebrow: string; title: string; description: string }
> = {
  overall: {
    eyebrow: "Balanced picks across price and nutrition",
    title: "Best overall macro score",
    description:
      "A balanced ranking that rewards protein while penalizing price, calories, sodium, and sugar.",
  },
  protein: {
    eyebrow: "Best for hitting your target",
    title: "Highest protein meals in the city",
    description:
      "The strongest protein-heavy meals currently available across the restaurants loaded into Macro Finder.",
  },
  calories: {
    eyebrow: "Lighter options with usable price points",
    title: "Lowest calories",
    description:
      "Meals sorted to surface the lightest realistic picks first, without leaving the main app flow.",
  },
  sodium: {
    eyebrow: "Good when salt is the constraint",
    title: "Lowest sodium",
    description:
      "Useful when you want cleaner choices without having to scan sodium manually meal by meal.",
  },
  fat: {
    eyebrow: "Leanest picks across the current filter",
    title: "Lowest fat",
    description:
      "A leaner shortlist for users optimizing around fat while keeping the rest of the meal usable.",
  },
};

function isRankingMetric(value: string): value is RankingMetric {
  return value in RANKING_META;
}

function sortItems(items: MenuItem[], metric: RankingMetric) {
  const next = [...items];
  if (metric === "protein") {
    return next.sort(
      (left, right) =>
        safeNumber(right.macros?.protein_g) - safeNumber(left.macros?.protein_g),
    );
  }
  if (metric === "calories") {
    return next.sort(
      (left, right) =>
        safeNumber(left.macros?.calories) - safeNumber(right.macros?.calories),
    );
  }
  if (metric === "sodium") {
    return next.sort(
      (left, right) =>
        safeNumber(left.macros?.sodium_mg) - safeNumber(right.macros?.sodium_mg),
    );
  }
  if (metric === "fat") {
    return next.sort(
      (left, right) => safeNumber(left.macros?.fat_g) - safeNumber(right.macros?.fat_g),
    );
  }
  return next.sort((left, right) => scoreItem(right) - scoreItem(left));
}

export default function RankingRoute() {
  const navigate = useNavigate();
  const { metric = "overall" } = useParams();
  const { compareKeys, savedKeys, toggleCompare, toggleSaved } = useAppState();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const currentMetric: RankingMetric = isRankingMetric(metric) ? metric : "overall";
  const meta = RANKING_META[currentMetric];

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const itemsResponse = await fetchItems({ pricedOnly: true, limit: 5000 });
        setItems(itemsResponse.items.filter(isReasonableItem));
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : "Failed to load ranking",
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const rankedItems = useMemo(
    () => sortItems(items, currentMetric).slice(0, 24),
    [currentMetric, items],
  );

  return (
    <main className="container detail-page">
      <div className="detail-hero">
        <div>
          <p className="eyebrow">{meta.eyebrow}</p>
          <h1>{meta.title}</h1>
          <p>{meta.description}</p>
        </div>
        <div className="detail-actions">
          <Link to="/discover" className="ghost-pill">
            Back to discover
          </Link>
          <Link to="/compare" className="primary-pill">
            Compare tray
          </Link>
        </div>
      </div>

      <section className="section-shell">
        <div className="section-head">
          <div>
            <p className="eyebrow">Ranking</p>
            <h2>Top meals right now</h2>
          </div>
          <span>{rankedItems.length} picks shown</span>
        </div>

        <div className="metric-chip-row">
          {Object.entries(RANKING_META).map(([key, value]) => (
            <Link
              key={key}
              to={`/rankings/${key}`}
              className={`metric-chip ${currentMetric === key ? "is-active" : ""}`}
            >
              {value.title}
            </Link>
          ))}
        </div>
      </section>

      {loading ? <div className="loading-card">Loading ranking...</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}

      {!loading ? (
        <section className="section-shell">
          <div className="list-shell">
            {rankedItems.map((item) => {
              const isCompared = compareKeys.includes(item.unique_key);
              const isSaved = savedKeys.includes(item.unique_key);
              const category = getCategoryMeta(item.category);

              return (
                <article key={item.unique_key} className="list-card list-card--media">
                  <button
                    type="button"
                    className="list-main list-main--with-thumb"
                    onClick={() => navigate(mealPath(item.unique_key))}
                  >
                    <FoodVisualThumb item={item} />
                    <div className="list-main__text">
                      <p className="restaurant-label">{item.restaurant_name}</p>
                      <h3>{item.item_name}</h3>
                      <p>{category.label}</p>
                    </div>
                    <div className="list-metrics">
                      <strong>{money(item.price_cad)}</strong>
                      <span>{proteinValue(item).toFixed(2)} g/$</span>
                    </div>
                  </button>

                  <div className="macro-row">
                    {compactMacros(item).map((macro) => (
                      <span key={macro}>{macro}</span>
                    ))}
                  </div>

                  <div className="card-actions">
                    <Link
                      to={restaurantPath(item.restaurant_id)}
                      className="ghost-pill restaurant-action"
                    >
                      Restaurant
                    </Link>
                    <button
                      type="button"
                      className={`save-button save-button--pill ${isSaved ? "is-active" : ""}`}
                      onClick={() => toggleSaved(item.unique_key)}
                      aria-label={isSaved ? "Unsave meal" : "Save meal"}
                    >
                      <span className="heart-icon" aria-hidden="true">
                        {isSaved ? "♥" : "♡"}
                      </span>
                      <span className="visually-hidden">
                        {isSaved ? "Saved meal" : "Save meal"}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="primary-pill"
                      onClick={() => toggleCompare(item.unique_key)}
                    >
                      {isCompared ? "Remove compare" : "Add compare"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </main>
  );
}
