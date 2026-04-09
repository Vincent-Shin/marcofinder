import { useNavigate } from "@remix-run/react";
import { useEffect, useMemo, useState } from "react";

import {
  createItem,
  createItemSubmission,
  createRestaurant,
  fetchAdminSubmissions,
  fetchAdminUsers,
  fetchNotifications,
  fetchOwnerSubmissions,
  fetchRestaurants,
  requestRestaurantAccess,
  reviewSubmission,
  updateUserRole,
} from "../lib/api";
import { useAppState } from "../lib/app-state";
import type {
  NotificationRecord,
  RestaurantSummary,
  SubmissionRecord,
  UserRecord,
} from "../lib/types";

type ManageUser = UserRecord & {
  owned_restaurant_ids: string[];
};

function niceDate(value?: string) {
  if (!value) return "Unknown time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function submissionTypeLabel(submission: SubmissionRecord) {
  return submission.type === "restaurant_access"
    ? "Restaurant access request"
    : "Menu item submission";
}

function submissionTitle(submission: SubmissionRecord) {
  if (submission.type === "restaurant_access") {
    return `Access request for ${submission.restaurant_name || submission.restaurant_id || "restaurant"}`;
  }
  return submission.payload?.item_name || "Menu item submission";
}

function submissionReviewLabel(submission: SubmissionRecord) {
  return submission.type === "restaurant_access"
    ? "Reason for approval or decline"
    : "Reason for approval or decline / menu review note";
}

function timeValue(value?: string) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

export default function AdminRoute() {
  const navigate = useNavigate();
  const { user, isReady } = useAppState();
  const [restaurants, setRestaurants] = useState<RestaurantSummary[]>([]);
  const [users, setUsers] = useState<ManageUser[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [adminSubmissions, setAdminSubmissions] = useState<SubmissionRecord[]>([]);
  const [ownerSubmissions, setOwnerSubmissions] = useState<SubmissionRecord[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  const [restaurantId, setRestaurantId] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [restaurantDescription, setRestaurantDescription] = useState("");

  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerRole, setOwnerRole] = useState<"user" | "restaurant_owner" | "admin">(
    "restaurant_owner",
  );
  const [ownerRestaurants, setOwnerRestaurants] = useState("");

  const [requestRestaurantId, setRequestRestaurantId] = useState("");
  const [requestNote, setRequestNote] = useState("");

  const [itemRestaurantId, setItemRestaurantId] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemCategory, setItemCategory] = useState("");
  const [itemPortion, setItemPortion] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemCalories, setItemCalories] = useState("");
  const [itemProtein, setItemProtein] = useState("");
  const [itemCarbs, setItemCarbs] = useState("");
  const [itemFat, setItemFat] = useState("");
  const [itemSodium, setItemSodium] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemNote, setItemNote] = useState("");

  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const isManager = user?.role === "admin" || user?.role === "restaurant_owner";
  const isAdmin = user?.role === "admin";
  const isOwner = user?.role === "restaurant_owner";

  async function loadData() {
    if (!user || !isManager) return;
    setError("");
    try {
      const restaurantList = await fetchRestaurants();
      setRestaurants(restaurantList);
      const notificationResponse = await fetchNotifications();
      setNotifications(notificationResponse.notifications);
      if (isAdmin) {
        const [usersResponse, submissionsResponse] = await Promise.all([
          fetchAdminUsers(),
          fetchAdminSubmissions(),
        ]);
        setUsers(usersResponse.users);
        setAdminSubmissions(submissionsResponse.submissions);
      } else {
        const submissionsResponse = await fetchOwnerSubmissions();
        setOwnerSubmissions(submissionsResponse.submissions);
      }
      setLastUpdated(new Date().toISOString());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load management data");
    }
  }

  useEffect(() => {
    void loadData();
  }, [user?.email, user?.role]);

  useEffect(() => {
    if (!user || !isManager || typeof window === "undefined") return;

    const refreshOnFocus = () => {
      void loadData();
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void loadData();
      }
    };

    const intervalId = window.setInterval(() => {
      void loadData();
    }, 12000);

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [user?.email, user?.role, isManager]);

  const manageableRestaurants = useMemo(() => {
    if (!user) return [];
    if (user.role === "admin") return restaurants;
    const owned = new Set(user.owned_restaurant_ids || []);
    return restaurants.filter((restaurant) => owned.has(restaurant.restaurant_id));
  }, [restaurants, user]);

  const restaurantNameById = useMemo(
    () =>
      new Map(
        restaurants.map((restaurant) => [restaurant.restaurant_id, restaurant.restaurant_name] as const),
      ),
    [restaurants],
  );

  const sortedAdminSubmissions = useMemo(() => {
    return [...adminSubmissions].sort((left, right) => {
      const leftPending = left.status === "pending" ? 0 : 1;
      const rightPending = right.status === "pending" ? 0 : 1;
      if (leftPending !== rightPending) {
        return leftPending - rightPending;
      }

      if (left.status === "pending" && right.status === "pending") {
        return timeValue(right.created_at) - timeValue(left.created_at);
      }

      return (
        timeValue(right.reviewed_at || right.created_at) -
        timeValue(left.reviewed_at || left.created_at)
      );
    });
  }, [adminSubmissions]);

  if (!isReady) {
    return (
      <main className="container page-grid">
        <div className="loading-card">Loading management tools...</div>
      </main>
    );
  }

  useEffect(() => {
    if (!isReady) return;
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    if (!isManager) {
      navigate("/discover", { replace: true });
    }
  }, [isManager, isReady, navigate, user]);

  if (!user || !isManager) {
    return null;
  }

  async function handleRestaurantSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await createRestaurant({
        restaurant_id: restaurantId.trim(),
        restaurant_name: restaurantName.trim(),
        description: restaurantDescription.trim(),
      });
      setMessage("Restaurant saved.");
      setRestaurantId("");
      setRestaurantName("");
      setRestaurantDescription("");
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to save restaurant");
    }
  }

  async function handleRoleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await updateUserRole(ownerEmail, {
        role: ownerRole,
        owned_restaurant_ids: ownerRestaurants
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean),
      });
      setMessage("Role and restaurant ownership updated.");
      setOwnerEmail("");
      setOwnerRestaurants("");
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to update access");
    }
  }

  async function handleRestaurantRequestSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await requestRestaurantAccess({
        restaurant_id: requestRestaurantId,
        note: requestNote,
      });
      setMessage("Restaurant access request sent to admin.");
      setRequestRestaurantId("");
      setRequestNote("");
      await loadData();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Failed to request restaurant",
      );
    }
  }

  async function handleItemSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const payload = {
      restaurant_id: itemRestaurantId,
      restaurant_name:
        restaurants.find((restaurant) => restaurant.restaurant_id === itemRestaurantId)
          ?.restaurant_name || "",
      item_name: itemName.trim(),
      category: itemCategory.trim() || undefined,
      portion: itemPortion.trim() || undefined,
      price_cad: itemPrice ? Number(itemPrice) : undefined,
      description: itemDescription.trim() || undefined,
      note: itemNote.trim() || undefined,
      macros: {
        calories: itemCalories ? Number(itemCalories) : undefined,
        protein_g: itemProtein ? Number(itemProtein) : undefined,
        carbs_g: itemCarbs ? Number(itemCarbs) : undefined,
        fat_g: itemFat ? Number(itemFat) : undefined,
        sodium_mg: itemSodium ? Number(itemSodium) : undefined,
      },
    };
    try {
      if (isAdmin) {
        await createItem(payload);
        setMessage("Admin published item directly.");
      } else {
        await createItemSubmission(payload);
        setMessage("Item submitted to admin for review.");
      }
      setItemRestaurantId("");
      setItemName("");
      setItemCategory("");
      setItemPortion("");
      setItemPrice("");
      setItemCalories("");
      setItemProtein("");
      setItemCarbs("");
      setItemFat("");
      setItemSodium("");
      setItemDescription("");
      setItemNote("");
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to submit item");
    }
  }

  async function handleReview(submissionId: string, decision: "approved" | "rejected") {
    setError("");
    setMessage("");
    try {
      if (decision === "rejected" && !(reviewNotes[submissionId] || "").trim()) {
        setError("Add a decline reason before rejecting this request.");
        return;
      }
      await reviewSubmission(submissionId, {
        decision,
        admin_note: reviewNotes[submissionId] || "",
      });
      setMessage(`Submission ${decision}.`);
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to review submission");
    }
  }

  return (
    <main className="container page-grid">
      <section className="section-shell">
        <div className="section-head">
          <div>
            <p className="eyebrow">Management</p>
            <h1>{isAdmin ? "Admin Console" : "Owner Console"}</h1>
          </div>
          <div className="section-head-actions">
            <button type="button" className="ghost-pill" onClick={() => void loadData()}>
              Refresh panel
            </button>
            <span className="profile-chip">Role: {user.role}</span>
          </div>
        </div>
        <p className="profile-note">
          {isAdmin
            ? "Admins create restaurants, assign owners, and review pending access or menu submissions."
            : "Owners request restaurant access, receive admin notifications, and submit menu changes for review."}
        </p>
        <p className="profile-note session-note">
          Tabs in the same browser share one login session. To test admin and owner at the same
          time, use an incognito window or a separate browser profile.
        </p>
        {lastUpdated ? <p className="profile-note">Last refreshed: {niceDate(lastUpdated)}</p> : null}
        {error ? <div className="error-banner">{error}</div> : null}
        {message ? <p className="profile-feedback">{message}</p> : null}
      </section>

      <section className="section-shell">
        <div className="section-head">
          <div>
            <p className="eyebrow">Notifications</p>
            <h2>{isAdmin ? "System activity" : "Latest updates from admin"}</h2>
          </div>
        </div>
        {notifications.length ? (
          <div className="panel-scroll panel-scroll--notifications">
            <div className="admin-table">
              {notifications.map((notification, index) => (
              <div key={`${notification.created_at}-${index}`} className="settings-row">
                <div>
                  <strong>{notification.title}</strong>
                  <p>{notification.message}</p>
                </div>
                <span>{niceDate(notification.created_at)}</span>
              </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="loading-card panel-empty">
            {isAdmin
              ? "No direct notifications for this admin account. New owner requests appear in the review queue below."
              : "No notifications yet."}
          </div>
        )}
      </section>

      <section className="profile-layout admin-layout">
        <article className="section-shell profile-panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">Restaurants</p>
              <h2>{isAdmin ? "All restaurants" : "Restaurants you own"}</h2>
            </div>
          </div>

          {manageableRestaurants.length ? (
            <div className="panel-scroll panel-scroll--list">
              <div className="admin-restaurant-list">
                {manageableRestaurants.map((restaurant) => (
                <div key={restaurant.restaurant_id} className="profile-shortcut">
                  <span>{restaurant.restaurant_id}</span>
                  <strong>{restaurant.restaurant_name}</strong>
                  <p>{restaurant.description || "No description yet."}</p>
                </div>
              ))}
              </div>
            </div>
          ) : (
            <div className="loading-card">
              {isAdmin
                ? "No restaurants yet. Create one below."
                : "You do not own a restaurant yet. Use the request form below."}
            </div>
          )}
        </article>

        {isAdmin ? (
          <>
            <article className="section-shell profile-panel">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Restaurant Registry</p>
                  <h2>Create a restaurant</h2>
                </div>
              </div>
              <form className="profile-form" onSubmit={handleRestaurantSubmit}>
                <label className="profile-field">
                  <span>Restaurant id</span>
                  <input
                    value={restaurantId}
                    onChange={(event) => setRestaurantId(event.target.value)}
                    placeholder="tim_hortons_ca"
                    required
                  />
                </label>
                <label className="profile-field">
                  <span>Restaurant name</span>
                  <input
                    value={restaurantName}
                    onChange={(event) => setRestaurantName(event.target.value)}
                    placeholder="Tim Hortons"
                    required
                  />
                </label>
                <label className="profile-field">
                  <span>Description</span>
                  <input
                    value={restaurantDescription}
                    onChange={(event) => setRestaurantDescription(event.target.value)}
                    placeholder="Short summary for the restaurant"
                  />
                </label>
                <button type="submit" className="primary-pill">
                  Save restaurant
                </button>
              </form>
            </article>

            <article className="section-shell profile-panel">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Owners</p>
                  <h2>Assign restaurants and roles</h2>
                </div>
              </div>
              <form className="profile-form" onSubmit={handleRoleSubmit}>
                <label className="profile-field">
                  <span>User email</span>
                  <input
                    type="email"
                    value={ownerEmail}
                    onChange={(event) => setOwnerEmail(event.target.value)}
                    placeholder="owner@example.com"
                    required
                  />
                </label>
                <label className="profile-field">
                  <span>Role</span>
                  <select
                    value={ownerRole}
                    onChange={(event) =>
                      setOwnerRole(
                        event.target.value as "user" | "restaurant_owner" | "admin",
                      )
                    }
                  >
                    <option value="user">user</option>
                    <option value="restaurant_owner">restaurant_owner</option>
                    <option value="admin">admin</option>
                  </select>
                </label>
                <label className="profile-field">
                  <span>Owned restaurant ids</span>
                  <input
                    value={ownerRestaurants}
                    onChange={(event) => setOwnerRestaurants(event.target.value)}
                    placeholder="tim_hortons_ca, subway_ca"
                  />
                </label>
                <button type="submit" className="ghost-pill">
                  Update owner access
                </button>
              </form>

              <div className="panel-scroll panel-scroll--list">
                <div className="admin-table">
                  {users.map((entry) => (
                  <div key={entry.email} className="settings-row admin-user-row">
                    <div className="settings-copy">
                      <strong>{entry.name}</strong>
                      <p>{entry.email}</p>
                      <p className="admin-user-restaurants">
                        {entry.owned_restaurant_ids.length
                          ? `Restaurants: ${entry.owned_restaurant_ids
                              .map(
                                (restaurantId) =>
                                  restaurantNameById.get(restaurantId) || restaurantId,
                              )
                              .join(", ")}`
                          : "No restaurant assigned"}
                      </p>
                    </div>
                    <div className="admin-user-meta">
                      <span className="profile-chip">{entry.role || "user"}</span>
                      <span>
                        {entry.owned_restaurant_ids.length
                          ? entry.owned_restaurant_ids.join(", ")
                          : "No restaurant ids assigned"}
                      </span>
                    </div>
                  </div>
                ))}
                </div>
              </div>
            </article>

            <article className="section-shell profile-panel profile-panel--wide">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Review Queue</p>
                  <h2>Accept or decline owner requests</h2>
                </div>
              </div>
              {adminSubmissions.length ? (
                <div className="panel-scroll panel-scroll--queue">
                  <div className="admin-table">
                    {sortedAdminSubmissions.map((submission) => (
                    <div key={submission.id} className="list-card admin-submission-card">
                      <div className="section-head">
                        <div>
                          <p className="eyebrow">{submissionTypeLabel(submission)}</p>
                          <h2>{submissionTitle(submission)}</h2>
                        </div>
                        <span
                          className={`profile-chip submission-status submission-status--${submission.status}`}
                        >
                          {submission.status}
                        </span>
                      </div>
                      <div className="admin-submission-meta">
                        <p>
                          Owner: {submission.user_name} ({submission.user_email})
                        </p>
                        <p>
                          Restaurant: {submission.restaurant_name || submission.restaurant_id}
                        </p>
                        <p>Submitted: {niceDate(submission.created_at)}</p>
                        <p>Request id: {submission.id}</p>
                      </div>
                      {submission.note ? <p>Owner note: {submission.note}</p> : null}
                      {submission.payload?.item_name ? (
                        <p>
                          Item: {submission.payload.item_name} | Portion:{" "}
                          {submission.payload.portion || "standard"} | Price:{" "}
                          {submission.payload.price_cad ?? "n/a"}
                        </p>
                      ) : null}
                      <label className="profile-field">
                        <span>{submissionReviewLabel(submission)}</span>
                        <input
                          value={reviewNotes[submission.id] || ""}
                          onChange={(event) =>
                            setReviewNotes((current) => ({
                              ...current,
                              [submission.id]: event.target.value,
                            }))
                          }
                          placeholder={
                            submission.status === "pending"
                              ? "Required if you decline this request"
                              : "Recorded review reason"
                          }
                        />
                      </label>
                      {submission.status === "pending" ? (
                        <div className="card-actions">
                          <button
                            type="button"
                            className="primary-pill"
                            onClick={() => handleReview(submission.id, "approved")}
                          >
                            Accept request
                          </button>
                          <button
                            type="button"
                            className="ghost-pill"
                            onClick={() => handleReview(submission.id, "rejected")}
                          >
                            Decline request
                          </button>
                        </div>
                      ) : (
                        <div className="admin-submission-meta">
                          <p>Reviewed: {niceDate(submission.reviewed_at)}</p>
                          <p>
                            Decision note:{" "}
                            {submission.admin_note || "No review note was recorded."}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                  </div>
                </div>
              ) : (
                <div className="loading-card">No owner submissions yet.</div>
              )}
            </article>
          </>
        ) : null}

        {isOwner ? (
          <>
            <article className="section-shell profile-panel">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Request Access</p>
                  <h2>Ask admin to assign a restaurant</h2>
                </div>
              </div>
              <form className="profile-form" onSubmit={handleRestaurantRequestSubmit}>
                <label className="profile-field">
                  <span>Restaurant</span>
                  <select
                    value={requestRestaurantId}
                    onChange={(event) => setRequestRestaurantId(event.target.value)}
                    required
                  >
                    <option value="">Select a restaurant</option>
                    {restaurants.map((restaurant) => (
                      <option key={restaurant.restaurant_id} value={restaurant.restaurant_id}>
                        {restaurant.restaurant_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="profile-field">
                  <span>Why this is your restaurant</span>
                  <input
                    value={requestNote}
                    onChange={(event) => setRequestNote(event.target.value)}
                    placeholder="Explain your ownership or management role"
                  />
                </label>
                <button type="submit" className="ghost-pill">
                  Send request
                </button>
              </form>
            </article>

            <article className="section-shell profile-panel">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Owner Queue</p>
                  <h2>Your pending submissions</h2>
                </div>
              </div>
              {ownerSubmissions.length ? (
                <div className="panel-scroll panel-scroll--queue">
                  <div className="admin-table">
                    {ownerSubmissions.map((submission) => (
                    <div key={submission.id} className="list-card admin-submission-card owner-submission-card">
                      <div className="section-head">
                        <div>
                          <p className="eyebrow">{submissionTypeLabel(submission)}</p>
                          <h2>{submissionTitle(submission)}</h2>
                        </div>
                        <span
                          className={`profile-chip submission-status submission-status--${submission.status}`}
                        >
                          {submission.status}
                        </span>
                      </div>
                      <div className="admin-submission-meta">
                        <p>Restaurant: {submission.restaurant_name || submission.restaurant_id}</p>
                        <p>Submitted: {niceDate(submission.created_at)}</p>
                        {submission.reviewed_at ? (
                          <p>Reviewed: {niceDate(submission.reviewed_at)}</p>
                        ) : null}
                      </div>
                      {submission.note ? <p>Your note: {submission.note}</p> : null}
                      {submission.payload?.item_name ? (
                        <p>
                          Item: {submission.payload.item_name} | Portion:{" "}
                          {submission.payload.portion || "standard"} | Price:{" "}
                          {submission.payload.price_cad ?? "n/a"}
                        </p>
                      ) : null}
                      {submission.admin_note ? (
                        <p>Admin note: {submission.admin_note}</p>
                      ) : (
                        <p>Admin note: Waiting for review.</p>
                      )}
                    </div>
                  ))}
                  </div>
                </div>
              ) : (
                <div className="loading-card panel-empty">
                  No pending submissions. Approved or declined requests move to notifications.
                </div>
              )}
            </article>
          </>
        ) : null}

        <article className="section-shell profile-panel profile-panel--wide">
          <div className="section-head">
            <div>
              <p className="eyebrow">{isAdmin ? "Publish item" : "Submit menu item"}</p>
              <h2>
                {isAdmin
                  ? "Admin can publish directly"
                  : "Owner submissions go to admin review"}
              </h2>
            </div>
          </div>
          <form className="profile-form" onSubmit={handleItemSubmit}>
            <label className="profile-field">
              <span>Restaurant</span>
              <select
                value={itemRestaurantId}
                onChange={(event) => setItemRestaurantId(event.target.value)}
                required
                disabled={!manageableRestaurants.length}
              >
                <option value="">
                  {manageableRestaurants.length
                    ? "Select a restaurant"
                    : "No assigned restaurant yet"}
                </option>
                {manageableRestaurants.map((restaurant) => (
                  <option key={restaurant.restaurant_id} value={restaurant.restaurant_id}>
                    {restaurant.restaurant_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="profile-field">
              <span>Item name</span>
              <input
                value={itemName}
                onChange={(event) => setItemName(event.target.value)}
                placeholder="Honey Cruller Donut"
                required
              />
            </label>
            <label className="profile-field">
              <span>Category</span>
              <input
                value={itemCategory}
                onChange={(event) => setItemCategory(event.target.value)}
                placeholder="dessert"
              />
            </label>
            <label className="profile-field">
              <span>Portion</span>
              <input
                value={itemPortion}
                onChange={(event) => setItemPortion(event.target.value)}
                placeholder="1 item"
              />
            </label>
            <label className="profile-field">
              <span>Price (CAD)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={itemPrice}
                onChange={(event) => setItemPrice(event.target.value)}
                placeholder="1.59"
              />
            </label>
            <div className="admin-macro-grid">
              <label className="profile-field">
                <span>Calories</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={itemCalories}
                  onChange={(event) => setItemCalories(event.target.value)}
                />
              </label>
              <label className="profile-field">
                <span>Protein (g)</span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={itemProtein}
                  onChange={(event) => setItemProtein(event.target.value)}
                />
              </label>
              <label className="profile-field">
                <span>Carbs (g)</span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={itemCarbs}
                  onChange={(event) => setItemCarbs(event.target.value)}
                />
              </label>
              <label className="profile-field">
                <span>Fat (g)</span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={itemFat}
                  onChange={(event) => setItemFat(event.target.value)}
                />
              </label>
              <label className="profile-field">
                <span>Sodium (mg)</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={itemSodium}
                  onChange={(event) => setItemSodium(event.target.value)}
                />
              </label>
            </div>
            <label className="profile-field">
              <span>Description</span>
              <input
                value={itemDescription}
                onChange={(event) => setItemDescription(event.target.value)}
                placeholder="Short menu description"
              />
            </label>
            {!isAdmin ? (
              <label className="profile-field">
                <span>Note for admin</span>
                <input
                  value={itemNote}
                  onChange={(event) => setItemNote(event.target.value)}
                  placeholder="Anything the admin should review"
                />
              </label>
            ) : null}
            <button
              type="submit"
              className="primary-pill"
              disabled={!isAdmin && !manageableRestaurants.length}
            >
              {isAdmin ? "Publish item" : "Submit for approval"}
            </button>
          </form>
        </article>
      </section>
    </main>
  );
}
