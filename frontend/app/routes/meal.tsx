import { Link, useParams } from "react-router";
import { useEffect, useState } from "react";

import { FoodVisualHero } from "../components/food-visual";
import { NutritionSourceLink } from "../components/nutrition-source-link";
import { fetchItemByKey, reportItemIssue, uploadSubmissionAsset } from "../lib/api";
import { useAppState } from "../lib/app-state";
import { restaurantPath } from "../lib/paths";
import { describeRestaurant } from "../lib/restaurants";
import { isReasonableItem, money } from "../lib/scoring";
import type { ItemIssueType, MenuItem } from "../lib/types";

const ISSUE_OPTIONS: Array<{ value: ItemIssueType; label: string }> = [
  { value: "wrong_nutrition_info", label: "Wrong nutrition info" },
  { value: "wrong_price", label: "Wrong price" },
  { value: "item_discontinued", label: "Item discontinued / unavailable" },
  { value: "wrong_category_or_diet_tag", label: "Wrong category or diet tag" },
  { value: "wrong_image", label: "Wrong image" },
  { value: "broken_source_link", label: "Broken source link" },
  { value: "duplicate_listing", label: "Duplicate listing" },
  { value: "other", label: "Other" },
];

function niceDate(value?: string | null) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

export default function MealRoute() {
  const { mealKey = "" } = useParams();
  const decodedKey = decodeURIComponent(mealKey);
  const { compareKeys, toggleCompare, savedKeys, toggleSaved, user } = useAppState();
  const [item, setItem] = useState<MenuItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [issueType, setIssueType] = useState("");
  const [issueNote, setIssueNote] = useState("");
  const [issueAttachment, setIssueAttachment] = useState<File | null>(null);
  const [attachmentInputVersion, setAttachmentInputVersion] = useState(0);
  const [reportError, setReportError] = useState("");
  const [reportMessage, setReportMessage] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const loaded = await fetchItemByKey(decodedKey);
        setItem(isReasonableItem(loaded) ? loaded : null);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load meal");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [decodedKey]);

  const isCompared = compareKeys.includes(decodedKey);
  const isSaved = savedKeys.includes(decodedKey);

  async function handleSubmitIssue(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!item) return;
    if (!user) {
      setReportError("Please log in to report issues.");
      return;
    }
    if (!issueType) {
      setReportError("Select an issue type.");
      return;
    }

    setReportSubmitting(true);
    setReportError("");
    setReportMessage("");
    try {
      let attachmentUrl: string | undefined;
      if (issueAttachment) {
        const uploadResponse = await uploadSubmissionAsset(issueAttachment, "issue_attachment");
        attachmentUrl = uploadResponse.asset.file_url;
      }

      await reportItemIssue(item.unique_key, {
        issue_type: issueType as ItemIssueType,
        note: issueNote.trim() || undefined,
        attachment_url: attachmentUrl,
      });

      setReportMessage("Issue submitted for review.");
      setIssueType("");
      setIssueNote("");
      setIssueAttachment(null);
      setAttachmentInputVersion((current) => current + 1);
      setIsReportOpen(false);
    } catch (submitError) {
      setReportError(submitError instanceof Error ? submitError.message : "Failed to submit issue");
    } finally {
      setReportSubmitting(false);
    }
  }

  return (
    <main className="container detail-page">
      {loading ? <div className="loading-card">Loading meal details...</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}

      {item ? (
        <>
          <div className="detail-hero detail-hero--meal">
            <FoodVisualHero item={item} />
            <div className="detail-hero__copy">
              <p className="eyebrow">{item.restaurant_name}</p>
              <h1>{item.item_name}</h1>
              <p>
                {item.category || "uncategorized"}
                {item.portion ? ` | ${item.portion}` : ""}
              </p>
              <p>{item.description || describeRestaurant(item.restaurant_id, item.restaurant_name)}</p>
              <p className="meal-source-line">
                <NutritionSourceLink url={item.source_url} />
              </p>
            </div>
            <div className="detail-actions">
              <Link to={restaurantPath(item.restaurant_id)} className="ghost-pill">
                Restaurant page
              </Link>
              <button
                type="button"
                className="primary-pill"
                onClick={() => toggleCompare(item.unique_key)}
              >
                {isCompared ? "Remove compare" : "Add compare"}
              </button>
              <button
                type="button"
                className="ghost-pill"
                onClick={() => {
                  setReportError("");
                  setReportMessage("");
                  setIsReportOpen(true);
                }}
              >
                Report issue
              </button>
            </div>
          </div>

          {reportMessage ? <p className="profile-feedback">{reportMessage}</p> : null}

          <section className="detail-grid">
            <article className="section-shell">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Price</p>
                  <h2>{money(item.price_cad)}</h2>
                </div>
                <button
                  type="button"
                  className={`save-button save-button--pill item-save-pill ${isSaved ? "is-active" : ""}`}
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
              </div>

              <div className="macro-grid">
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
                <div className="macro-box">
                  <span>Sugar</span>
                  <strong>{item.macros?.sugar_g ?? 0}g</strong>
                </div>
              </div>
            </article>

            <article className="section-shell">
              <div className="section-head">
                <div>
                  <p className="eyebrow">About this meal</p>
                  <h2>What matters here</h2>
                </div>
              </div>
              <div className="source-list">
                <div>
                  <strong>Restaurant</strong>
                  <p>{item.restaurant_name}</p>
                </div>
                <div>
                  <strong>Portion</strong>
                  <p>{item.portion || "Standard item"}</p>
                </div>
                <div>
                  <strong>Category</strong>
                  <p>{item.category || "Uncategorized"}</p>
                </div>
                <div>
                  <strong>Nutrition source</strong>
                  <NutritionSourceLink url={item.source_url} />
                </div>
                {item.description ? (
                  <div>
                    <strong>Quick summary</strong>
                    <p>{item.description}</p>
                  </div>
                ) : null}
              </div>
            </article>
          </section>

          {isReportOpen ? (
            <div className="modal-backdrop" onClick={() => setIsReportOpen(false)}>
              <section
                className="report-modal section-shell"
                role="dialog"
                aria-modal="true"
                aria-label="Report an issue with this listing"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="section-head">
                  <div>
                    <p className="eyebrow">Report issue</p>
                    <h2>Report an issue with this listing</h2>
                  </div>
                </div>
                <p className="profile-note">
                  Pick what looks wrong. Item details are attached automatically for admin and owner review.
                </p>

                {!user ? (
                  <div className="error-banner">
                    Please <Link to="/login">log in</Link> to submit an issue report.
                  </div>
                ) : null}
                {reportError ? <div className="error-banner">{reportError}</div> : null}

                <form className="profile-form" onSubmit={handleSubmitIssue}>
                  <label className="profile-field">
                    <span>What is wrong?</span>
                    <select
                      value={issueType}
                      onChange={(event) => setIssueType(event.target.value)}
                      disabled={!user}
                    >
                      <option value="">Select an issue type</option>
                      {ISSUE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="profile-field">
                    <span>Extra note</span>
                    <textarea
                      value={issueNote}
                      onChange={(event) => setIssueNote(event.target.value)}
                      placeholder="Example: listed price is higher in store, or item is no longer available."
                      disabled={!user}
                    />
                  </label>

                  <label className="profile-field">
                    <span>Optional screenshot or PDF</span>
                    <input
                      key={`issue-attachment-${attachmentInputVersion}`}
                      type="file"
                      accept=".pdf,image/png,image/jpeg,image/webp"
                      onChange={(event) => setIssueAttachment(event.target.files?.[0] || null)}
                      disabled={!user}
                    />
                    <small>{issueAttachment ? issueAttachment.name : "No file chosen"}</small>
                  </label>

                  <div className="issue-context-grid">
                    <div>
                      <span>Item</span>
                      <strong>{item.item_name}</strong>
                    </div>
                    <div>
                      <span>Restaurant</span>
                      <strong>{item.restaurant_name}</strong>
                    </div>
                    <div>
                      <span>Shown price</span>
                      <strong>{money(item.price_cad)}</strong>
                    </div>
                    <div>
                      <span>Category</span>
                      <strong>{item.category || "Uncategorized"}</strong>
                    </div>
                    <div>
                      <span>Last updated</span>
                      <strong>{niceDate(item.scraped_at)}</strong>
                    </div>
                    <div>
                      <span>Source</span>
                      <div className="issue-source-cell">
                        <NutritionSourceLink url={item.source_url} />
                      </div>
                    </div>
                  </div>

                  <div className="card-actions">
                    <button
                      type="submit"
                      className="primary-pill"
                      disabled={!user || reportSubmitting}
                    >
                      {reportSubmitting ? "Submitting..." : "Submit report"}
                    </button>
                    <button
                      type="button"
                      className="ghost-pill"
                      onClick={() => setIsReportOpen(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </section>
            </div>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
