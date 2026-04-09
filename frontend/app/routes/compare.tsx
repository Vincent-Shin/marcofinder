import { Link } from "@remix-run/react";
import { useEffect, useState } from "react";

import { fetchItemByKey } from "../lib/api";
import { useAppState } from "../lib/app-state";
import { isReasonableItem, money } from "../lib/scoring";
import type { MenuItem } from "../lib/types";

export default function CompareRoute() {
  const { compareKeys, clearCompare, toggleCompare } = useAppState();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      if (!compareKeys.length) {
        setItems([]);
        return;
      }
      setLoading(true);
      setError("");
      try {
        const loaded = await Promise.all(compareKeys.map((key) => fetchItemByKey(key)));
        setItems(loaded.filter(isReasonableItem));
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : "Failed to load compare items",
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [compareKeys]);

  return (
    <main className="container detail-page">
      <div className="detail-hero">
        <div>
          <p className="eyebrow">Compare</p>
          <h1>Side-by-side meal check</h1>
          <p>Use this to compare price and macro tradeoffs without guessing.</p>
        </div>
        <div className="detail-actions">
          <Link to="/discover" className="ghost-pill">
            Back to discover
          </Link>
          <button type="button" className="primary-pill" onClick={clearCompare}>
            Clear compare
          </button>
        </div>
      </div>

      {loading ? <div className="loading-card">Loading compare items...</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}

      {!compareKeys.length ? (
        <div className="loading-card">No meals selected yet.</div>
      ) : (
        <section className="compare-grid">
          {items.map((item) => (
            <article key={item.unique_key} className="section-shell">
              <div className="section-head">
                <div>
                  <p className="eyebrow">{item.restaurant_name}</p>
                  <h2>{item.item_name}</h2>
                </div>
                <button
                  type="button"
                  className="ghost-pill"
                  onClick={() => toggleCompare(item.unique_key)}
                >
                  Remove
                </button>
              </div>

              <div className="macro-grid">
                <div className="macro-box">
                  <span>Price</span>
                  <strong>{money(item.price_cad)}</strong>
                </div>
                <div className="macro-box">
                  <span>Calories</span>
                  <strong>{item.macros?.calories ?? 0}</strong>
                </div>
                <div className="macro-box">
                  <span>Protein</span>
                  <strong>{item.macros?.protein_g ?? 0}g</strong>
                </div>
                <div className="macro-box">
                  <span>Carbs</span>
                  <strong>{item.macros?.carbs_g ?? 0}g</strong>
                </div>
                <div className="macro-box">
                  <span>Fat</span>
                  <strong>{item.macros?.fat_g ?? 0}g</strong>
                </div>
                <div className="macro-box">
                  <span>Sodium</span>
                  <strong>{item.macros?.sodium_mg ?? 0}mg</strong>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
