import { Link, useNavigate } from "react-router";
import { useState } from "react";

import { login } from "../lib/api";
import { useAppState } from "../lib/app-state";

export default function LoginRoute() {
  const navigate = useNavigate();
  const { setUser } = useAppState();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await login({ email, password });
      setUser(response.user);
      navigate("/discover");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Login failed",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-layout">
      <section className="auth-shell">
        <section className="auth-brand-panel">
          <div>
            <p className="auth-brand-kicker">Macro Finder</p>
            <h1>Find better food choices faster.</h1>
            <p className="auth-brand-copy">
              Compare meals by price, protein, calories, and more in one place.
            </p>
          </div>

          <div className="auth-brand-points">
            <p>Search meals and restaurants</p>
            <p>Compare value by macros</p>
            <p>Save time and money</p>
          </div>
        </section>

        <section className="auth-card-panel">
          <div className="auth-mobile-copy">
            <p className="auth-brand-kicker">Macro Finder</p>
            <h1>Log in</h1>
            <p>Welcome back. Sign in to continue to Macro Finder.</p>
          </div>

          <section className="auth-card auth-card--rebuilt">
            <div className="auth-card-header">
              <p className="auth-brand-kicker">Macro Finder</p>
              <h2>Log in</h2>
              <p>Welcome back. Sign in to continue to Macro Finder.</p>
            </div>

            <form className="auth-form auth-form--rebuilt" onSubmit={handleSubmit}>
              <label>
                <span>Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Enter your email"
                  required
                />
              </label>

              <label>
                <span>Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  required
                />
              </label>

              {error ? <div className="error-banner">{error}</div> : null}

              <button className="primary-pill wide auth-submit" type="submit" disabled={submitting}>
                {submitting ? "Signing in..." : "Log in"}
              </button>

              <div className="auth-divider">
                <span>or</span>
              </div>

              <button
                className="ghost-pill wide auth-guest"
                type="button"
                onClick={() => navigate("/discover")}
              >
                Continue as guest
              </button>
            </form>

            <p className="auth-switch auth-switch--centered">
              Don&apos;t have an account? <Link to="/signup">Create one</Link>
            </p>
          </section>
        </section>
      </section>
    </main>
  );
}
