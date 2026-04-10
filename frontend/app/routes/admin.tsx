import { Navigate } from "react-router";
import { useEffect, useMemo, useState } from "react";

import {
  createItem,
  createItemSubmission,
  createRestaurant,
  createRestaurantSubmission,
  fetchAdminSubmissions,
  fetchAdminUsers,
  fetchNotifications,
  fetchOwnerSubmissions,
  fetchRestaurants,
  requestRestaurantAccess,
  reviewSubmission,
  uploadSubmissionAsset,
  updateUserRole,
} from "../lib/api";
import { useAppState } from "../lib/app-state";
import type {
  MenuItem,
  NotificationRecord,
  RestaurantListingPayload,
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
  if (submission.type === "restaurant_access") return "Restaurant access request";
  if (submission.type === "restaurant_listing") return "Restaurant listing request";
  return "Menu item submission";
}

function submissionTitle(submission: SubmissionRecord) {
  if (submission.type === "restaurant_access") {
    return `Access request for ${submission.restaurant_name || submission.restaurant_id || "restaurant"}`;
  }
  if (submission.type === "restaurant_listing") {
    const payload = submission.payload as RestaurantListingPayload | null | undefined;
    return `Listing: ${payload?.restaurant_name || submission.restaurant_name || "restaurant"}`;
  }
  return menuItemPayload(submission)?.item_name || "Menu item submission";
}

function submissionReviewLabel(submission: SubmissionRecord) {
  return submission.type === "menu_item"
    ? "Reason for approval or decline / menu review note"
    : "Reason for approval or decline";
}

function restaurantListingPayload(submission: SubmissionRecord) {
  if (submission.type !== "restaurant_listing") return null;
  return (submission.payload || null) as RestaurantListingPayload | null;
}

function menuItemPayload(submission: SubmissionRecord) {
  if (submission.type !== "menu_item") return null;
  return (submission.payload || null) as Partial<MenuItem> | null;
}

function timeValue(value?: string) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

export default function AdminRoute() {
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

  const [listingRestaurantName, setListingRestaurantName] = useState("");
  const [listingOwnerName, setListingOwnerName] = useState("");
  const [listingRole, setListingRole] = useState("Owner");
  const [listingEmail, setListingEmail] = useState("");
  const [listingPhone, setListingPhone] = useState("");
  const [listingWebsite, setListingWebsite] = useState("");
  const [listingMenuNote, setListingMenuNote] = useState("");
  const [listingMenuUrl, setListingMenuUrl] = useState("");
  const [nutritionPdfFile, setNutritionPdfFile] = useState<File | null>(null);
  const [restaurantImageFile, setRestaurantImageFile] = useState<File | null>(null);
  const [menuSheetFile, setMenuSheetFile] = useState<File | null>(null);
  const [itemImageFile, setItemImageFile] = useState<File | null>(null);
  const [fileInputVersion, setFileInputVersion] = useState(0);
  const [listingItemName, setListingItemName] = useState("");
  const [listingItemCategory, setListingItemCategory] = useState("");
  const [listingItemPrice, setListingItemPrice] = useState("");
  const [listingItemCalories, setListingItemCalories] = useState("");
  const [listingItemProtein, setListingItemProtein] = useState("");
  const [listingItemSodium, setListingItemSodium] = useState("");

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

  useEffect(() => {
    if (!user) return;
    setListingOwnerName((current) => current || user.name || "");
    setListingEmail((current) => current || user.email || "");
  }, [user?.email, user?.name]);

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

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isManager) {
    return <Navigate to="/discover" replace />;
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

  async function handleRestaurantListingSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    let nutritionPdfUrl: string | undefined;
    let restaurantImageUrl: string | undefined;
    let menuSheetUrl: string | undefined;
    let representativeItemImageUrl: string | undefined;

    if (nutritionPdfFile || restaurantImageFile || menuSheetFile || itemImageFile) {
      setMessage("Uploading files...");
    }
    try {
      const [nutritionUpload, restaurantImageUpload, menuSheetUpload, itemImageUpload] =
        await Promise.all([
          nutritionPdfFile
            ? uploadSubmissionAsset(nutritionPdfFile, "nutrition_pdf")
            : Promise.resolve(null),
          restaurantImageFile
            ? uploadSubmissionAsset(restaurantImageFile, "restaurant_image")
            : Promise.resolve(null),
          menuSheetFile
            ? uploadSubmissionAsset(menuSheetFile, "menu_sheet")
            : Promise.resolve(null),
          itemImageFile
            ? uploadSubmissionAsset(itemImageFile, "item_image")
            : Promise.resolve(null),
        ]);

      nutritionPdfUrl = nutritionUpload?.asset.file_url || nutritionPdfUrl;
      restaurantImageUrl = restaurantImageUpload?.asset.file_url || restaurantImageUrl;
      menuSheetUrl = menuSheetUpload?.asset.file_url || menuSheetUrl;
      representativeItemImageUrl = itemImageUpload?.asset.file_url || representativeItemImageUrl;
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Failed to upload files");
      setMessage("");
      return;
    }

    const representativeItems = listingItemName.trim()
      ? [
          {
            item_name: listingItemName.trim(),
            category: listingItemCategory.trim() || undefined,
            price_cad: listingItemPrice ? Number(listingItemPrice) : undefined,
            image_url: representativeItemImageUrl,
            macros: {
              calories: listingItemCalories ? Number(listingItemCalories) : undefined,
              protein_g: listingItemProtein ? Number(listingItemProtein) : undefined,
              sodium_mg: listingItemSodium ? Number(listingItemSodium) : undefined,
            },
          },
        ]
      : [];

    try {
      await createRestaurantSubmission({
        restaurant_name: listingRestaurantName.trim(),
        owner_full_name: listingOwnerName.trim(),
        owner_role: listingRole.trim(),
        restaurant_email: listingEmail.trim(),
        phone: listingPhone.trim(),
        official_website: listingWebsite.trim() || undefined,
        menu_note: listingMenuNote.trim() || undefined,
        nutrition_pdf_url: nutritionPdfUrl,
        menu_url: listingMenuUrl.trim() || undefined,
        restaurant_image_url: restaurantImageUrl,
        menu_sheet_url: menuSheetUrl,
        representative_items: representativeItems,
      });
      setMessage("Restaurant listing submitted for admin review.");
      setListingRestaurantName("");
      setListingRole("Owner");
      setListingPhone("");
      setListingWebsite("");
      setListingMenuNote("");
      setListingMenuUrl("");
      setNutritionPdfFile(null);
      setRestaurantImageFile(null);
      setMenuSheetFile(null);
      setItemImageFile(null);
      setFileInputVersion((current) => current + 1);
      setListingItemName("");
      setListingItemCategory("");
      setListingItemPrice("");
      setListingItemCalories("");
      setListingItemProtein("");
      setListingItemSodium("");
      await loadData();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to submit restaurant listing",
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
            ? "Admins create restaurants, assign owners, and review pending access, listing, or menu submissions."
            : "Owners can request access, submit a new restaurant listing, and send menu updates for review."}
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
                  <h2>Accept or decline owner and listing requests</h2>
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
                      {submission.type === "menu_item" && menuItemPayload(submission)?.item_name ? (
                        <p>
                          Item: {menuItemPayload(submission)?.item_name} | Portion:{" "}
                          {menuItemPayload(submission)?.portion || "standard"} | Price:{" "}
                          {menuItemPayload(submission)?.price_cad ?? "n/a"}
                        </p>
                      ) : null}
                      {submission.type === "restaurant_listing" ? (
                        <div className="admin-submission-meta">
                          <p>
                            Contact: {restaurantListingPayload(submission)?.owner_full_name} (
                            {restaurantListingPayload(submission)?.owner_role})
                          </p>
                          <p>
                            Email: {restaurantListingPayload(submission)?.restaurant_email} | Phone:{" "}
                            {restaurantListingPayload(submission)?.phone}
                          </p>
                          {restaurantListingPayload(submission)?.official_website ? (
                            <p>
                              Website: {restaurantListingPayload(submission)?.official_website}
                            </p>
                          ) : null}
                          {restaurantListingPayload(submission)?.menu_url ? (
                            <p>Menu URL: {restaurantListingPayload(submission)?.menu_url}</p>
                          ) : null}
                          {restaurantListingPayload(submission)?.nutrition_pdf_url ? (
                            <p>
                              Nutrition PDF:{" "}
                              {restaurantListingPayload(submission)?.nutrition_pdf_url}
                            </p>
                          ) : null}
                          {restaurantListingPayload(submission)?.representative_items?.length ? (
                            <p>
                              Sample item:{" "}
                              {restaurantListingPayload(submission)?.representative_items?.[0]
                                ?.item_name || "n/a"}
                            </p>
                          ) : null}
                        </div>
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
            <article className="section-shell profile-panel profile-panel--wide">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Restaurant request form</p>
                  <h2>Submit a new restaurant for approval</h2>
                </div>
              </div>
              <form className="profile-form" onSubmit={handleRestaurantListingSubmit}>
                <div className="owner-request-grid">
                  <label className="profile-field">
                    <span>Restaurant name</span>
                    <input
                      value={listingRestaurantName}
                      onChange={(event) => setListingRestaurantName(event.target.value)}
                      placeholder="Pacific Protein Kitchen"
                      required
                    />
                  </label>
                  <label className="profile-field">
                    <span>Owner full name</span>
                    <input
                      value={listingOwnerName}
                      onChange={(event) => setListingOwnerName(event.target.value)}
                      placeholder="Avery Singh"
                      required
                    />
                  </label>
                  <label className="profile-field">
                    <span>Role</span>
                    <select
                      value={listingRole}
                      onChange={(event) => setListingRole(event.target.value)}
                    >
                      <option value="Owner">Owner</option>
                      <option value="Manager">Manager</option>
                      <option value="Operator">Operator</option>
                    </select>
                  </label>
                  <label className="profile-field">
                    <span>Restaurant email</span>
                    <input
                      type="email"
                      value={listingEmail}
                      onChange={(event) => setListingEmail(event.target.value)}
                      placeholder="owner@restaurant.ca"
                      required
                    />
                  </label>
                  <label className="profile-field">
                    <span>Phone</span>
                    <input
                      value={listingPhone}
                      onChange={(event) => setListingPhone(event.target.value)}
                      placeholder="(403) 555-0176"
                      required
                    />
                  </label>
                  <label className="profile-field">
                    <span>Official website</span>
                    <input
                      type="url"
                      value={listingWebsite}
                      onChange={(event) => setListingWebsite(event.target.value)}
                      placeholder="https://restaurant.ca"
                    />
                  </label>
                </div>

                <label className="profile-field">
                  <span>Short note about your menu</span>
                  <textarea
                    value={listingMenuNote}
                    onChange={(event) => setListingMenuNote(event.target.value)}
                    placeholder="We focus on bowls, wraps, and portable items with published nutrition."
                  />
                </label>

                <div className="owner-request-grid">
                  <label className="profile-field">
                    <span>Nutrition PDF</span>
                    <input
                      key={`nutrition-${fileInputVersion}`}
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={(event) =>
                        setNutritionPdfFile(event.target.files?.[0] || null)
                      }
                    />
                    <small>{nutritionPdfFile ? nutritionPdfFile.name : "No PDF selected"}</small>
                  </label>
                  <label className="profile-field">
                    <span>Menu URL</span>
                    <input
                      type="url"
                      value={listingMenuUrl}
                      onChange={(event) => setListingMenuUrl(event.target.value)}
                      placeholder="https://restaurant.ca/menu"
                    />
                  </label>
                  <label className="profile-field">
                    <span>Restaurant image</span>
                    <input
                      key={`restaurant-image-${fileInputVersion}`}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(event) =>
                        setRestaurantImageFile(event.target.files?.[0] || null)
                      }
                    />
                    <small>
                      {restaurantImageFile
                        ? restaurantImageFile.name
                        : "No image selected"}
                    </small>
                  </label>
                  <label className="profile-field">
                    <span>Menu CSV or sheet export</span>
                    <input
                      key={`menu-sheet-${fileInputVersion}`}
                      type="file"
                      accept=".csv,.tsv,.xlsx,.xls,text/csv"
                      onChange={(event) =>
                        setMenuSheetFile(event.target.files?.[0] || null)
                      }
                    />
                    <small>
                      {menuSheetFile ? menuSheetFile.name : "No file selected"}
                    </small>
                  </label>
                </div>

                <div className="section-shell section-shell--compact owner-item-card">
                  <div className="section-head">
                    <div>
                      <p className="eyebrow">Item 1</p>
                      <h2>Representative item</h2>
                    </div>
                  </div>
                  <div className="owner-request-grid">
                    <label className="profile-field">
                      <span>Item name</span>
                      <input
                        value={listingItemName}
                        onChange={(event) => setListingItemName(event.target.value)}
                        placeholder="Signature Chicken Wrap"
                      />
                    </label>
                    <label className="profile-field">
                      <span>Category</span>
                      <input
                        value={listingItemCategory}
                        onChange={(event) => setListingItemCategory(event.target.value)}
                        placeholder="Wraps"
                      />
                    </label>
                    <label className="profile-field">
                      <span>Price (CAD)</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={listingItemPrice}
                        onChange={(event) => setListingItemPrice(event.target.value)}
                        placeholder="9.49"
                      />
                    </label>
                    <label className="profile-field">
                      <span>Calories</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={listingItemCalories}
                        onChange={(event) => setListingItemCalories(event.target.value)}
                        placeholder="410"
                      />
                    </label>
                    <label className="profile-field">
                      <span>Protein (g)</span>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={listingItemProtein}
                        onChange={(event) => setListingItemProtein(event.target.value)}
                        placeholder="32"
                      />
                    </label>
                    <label className="profile-field">
                      <span>Sodium (mg)</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={listingItemSodium}
                        onChange={(event) => setListingItemSodium(event.target.value)}
                        placeholder="520"
                      />
                    </label>
                    <label className="profile-field">
                      <span>Item image</span>
                      <input
                        key={`item-image-${fileInputVersion}`}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(event) => setItemImageFile(event.target.files?.[0] || null)}
                      />
                      <small>{itemImageFile ? itemImageFile.name : "No image selected"}</small>
                    </label>
                  </div>
                </div>

                <button type="submit" className="primary-pill">
                  Submit restaurant listing
                </button>
              </form>
            </article>

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
                      {submission.type === "menu_item" && menuItemPayload(submission)?.item_name ? (
                        <p>
                          Item: {menuItemPayload(submission)?.item_name} | Portion:{" "}
                          {menuItemPayload(submission)?.portion || "standard"} | Price:{" "}
                          {menuItemPayload(submission)?.price_cad ?? "n/a"}
                        </p>
                      ) : null}
                      {submission.type === "restaurant_listing" ? (
                        <div className="admin-submission-meta">
                          <p>
                            Requested listing:{" "}
                            {restaurantListingPayload(submission)?.restaurant_name ||
                              submission.restaurant_name}
                          </p>
                          <p>
                            Contact email:{" "}
                            {restaurantListingPayload(submission)?.restaurant_email || "n/a"}
                          </p>
                        </div>
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
