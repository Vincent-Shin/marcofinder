import { Link, Navigate, useNavigate } from "react-router";
import { useEffect, useState } from "react";

import { FoodVisualThumb } from "../components/food-visual";
import { fetchItemByKey, updatePassword, updateProfile } from "../lib/api";
import { useAppState } from "../lib/app-state";
import { mealPath } from "../lib/paths";
import { money } from "../lib/scoring";
import type { MenuItem } from "../lib/types";

export default function ProfileRoute() {
  const navigate = useNavigate();
  const { user, savedKeys, compareKeys, logout, isReady, setUser } = useAppState();
  const [savedItems, setSavedItems] = useState<MenuItem[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [error, setError] = useState("");
  const [savedItemsMessage, setSavedItemsMessage] = useState("");

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setEmail(user.email);
  }, [user]);

  useEffect(() => {
    async function loadSaved() {
      if (!savedKeys.length) {
        setSavedItems([]);
        setSavedItemsMessage("");
        return;
      }
      try {
        setSavedItemsMessage("");
        const items = await Promise.all(savedKeys.map((key) => fetchItemByKey(key)));
        setSavedItems(items);
      } catch (loadError) {
        setSavedItems([]);
        setSavedItemsMessage(
          loadError instanceof Error ? loadError.message : "Failed to load saved meals",
        );
      }
    }

    void loadSaved();
  }, [savedKeys]);

  if (!isReady) {
    return <main className="container page-grid"><div className="loading-card">Loading profile...</div></main>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  async function handleProfileSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setProfileMessage("");
    try {
      const response = await updateProfile({ name, email });
      setUser(response.user);
      setProfileMessage("Profile updated.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Profile update failed");
    }
  }

  async function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPasswordMessage("");
    try {
      await updatePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setPasswordMessage("Password updated.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Password update failed");
    }
  }

  return (
    <main className="container page-grid">
      <section className="profile-hero section-shell">
        <div className="profile-hero-copy">
          <p className="eyebrow">Profile</p>
          <h1>{user.name}</h1>
          <p>{user.email}</p>
          <div className="profile-chip-row">
            <span className="profile-chip">Saved meals: {savedKeys.length}</span>
            <span className="profile-chip">Compare tray: {compareKeys.length}/3</span>
            <span className="profile-chip">
              Role: {user.role === "admin" ? "admin" : user.role === "restaurant_owner" ? "owner" : "user"}
            </span>
            {user.owned_restaurant_ids?.length ? (
              <span className="profile-chip">
                Owns: {user.owned_restaurant_ids.join(", ")}
              </span>
            ) : null}
          </div>
        </div>

        <div className="profile-hero-actions">
          {user.role === "admin" || user.role === "restaurant_owner" ? (
            <Link to="/admin" className="ghost-pill">
              Open manage
            </Link>
          ) : null}
          <Link to="/discover" className="ghost-pill">
            Back to discover
          </Link>
          <Link to="/compare" className="primary-pill">
            Open compare
          </Link>
        </div>
      </section>

      {error ? <div className="error-banner">{error}</div> : null}

      <section className="profile-layout">
        <article className="section-shell profile-panel profile-panel--account">
          <div className="section-head">
            <div>
              <p className="eyebrow">Account</p>
              <h2>Personal details</h2>
            </div>
          </div>

          <form className="profile-form" onSubmit={handleProfileSubmit}>
            <label className="profile-field">
              <span>Name</span>
              <input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label className="profile-field">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <button type="submit" className="primary-pill">
              Save profile
            </button>
            {profileMessage ? <p className="profile-feedback">{profileMessage}</p> : null}
          </form>

          <form className="profile-form profile-form--password" onSubmit={handlePasswordSubmit}>
            <label className="profile-field">
              <span>Current password</span>
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </label>
            <label className="profile-field">
              <span>New password</span>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </label>
            <button type="submit" className="ghost-pill">
              Change password
            </button>
            {passwordMessage ? <p className="profile-feedback">{passwordMessage}</p> : null}
          </form>

          <div className="profile-cta-stack">
            <button
              type="button"
              className="ghost-pill"
              onClick={() => navigate("/discover")}
            >
              Continue exploring
            </button>
            <button
              type="button"
              className="top-tab top-tab--accent profile-logout"
              onClick={async () => {
                await logout();
                navigate("/discover");
              }}
            >
              Log out
            </button>
          </div>
        </article>

        <article className="section-shell profile-panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">Activity</p>
              <h2>Your food snapshot</h2>
            </div>
          </div>
          <div className="profile-stat-grid">
            <div className="macro-box profile-stat">
              <span>Meals you liked</span>
              <strong>{savedKeys.length}</strong>
              <small>Keep your favorite picks ready for the next order.</small>
            </div>
            <div className="macro-box profile-stat">
              <span>Meals to compare</span>
              <strong>{compareKeys.length}</strong>
              <small>Side-by-side picks waiting in your compare tray.</small>
            </div>
            <div className="macro-box profile-stat">
              <span>Next step</span>
              <strong>{savedKeys.length ? "Review saved picks" : "Find a few favorites"}</strong>
              <small>
                {savedKeys.length
                  ? "Open your saved meals below and narrow down what to order."
                  : "Start in Discover and save a few meals that match your goal."}
              </small>
            </div>
          </div>
        </article>

        <article className="section-shell profile-panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">Saved meals</p>
              <h2>Your liked food</h2>
            </div>
          </div>
          {savedItemsMessage ? <div className="error-banner">{savedItemsMessage}</div> : null}
          {savedItems.length ? (
            <div className="list-shell">
              {savedItems.map((item) => (
                <Link
                  key={item.unique_key}
                  to={mealPath(item.unique_key)}
                  className="list-card profile-saved-card list-card--media"
                >
                  <div className="list-main list-main--with-thumb">
                    <FoodVisualThumb item={item} />
                    <div className="list-main__text">
                      <h3>{item.item_name}</h3>
                      <p>{item.restaurant_name}</p>
                      {item.description ? (
                        <p className="list-description">{item.description}</p>
                      ) : null}
                    </div>
                    <div className="list-metrics">
                      <strong>{money(item.price_cad)}</strong>
                      <span>{item.macros?.protein_g ?? 0}g protein</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="loading-card">Save a few meals and they will show up here.</div>
          )}
        </article>
      </section>
    </main>
  );
}
