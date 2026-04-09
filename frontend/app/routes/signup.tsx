import { Link, useNavigate } from "@remix-run/react";
import { useState } from "react";

import { signup } from "../lib/api";
import { useAppState } from "../lib/app-state";

export default function SignupRoute() {
  const navigate = useNavigate();
  const { setUser } = useAppState();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!acceptedPrivacy) {
      setError("Please agree to the privacy policy");
      return;
    }

    setSubmitting(true);

    try {
      const response = await signup({ name, email, password });
      setUser(response.user);
      navigate("/discover");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Signup failed",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-layout auth-layout--signup">
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
            <h1>Create account</h1>
            <p>Join Macro Finder and start comparing meals smarter.</p>
          </div>

          <section className="auth-card auth-card--rebuilt">
            <div className="auth-card-header">
              <p className="auth-brand-kicker">Macro Finder</p>
              <h2>Create account</h2>
              <p>Join Macro Finder and start comparing meals smarter.</p>
            </div>

            <form className="auth-form auth-form--rebuilt" onSubmit={handleSubmit}>
              <label>
                <span>Full name</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Enter your full name"
                  required
                />
              </label>

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
                  placeholder="Create a password"
                  required
                />
              </label>

              <label>
                <span>Confirm password</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Confirm your password"
                  required
                />
              </label>

              <label className="auth-consent">
                <input
                  type="checkbox"
                  checked={acceptedPrivacy}
                  onChange={(event) => setAcceptedPrivacy(event.target.checked)}
                />
                <span>
                  I agree to the <button type="button" className="auth-inline-link">Privacy Policy</button> and understand that Macro Finder may collect account and usage information to support meal comparison, account access, and app improvements.
                </span>
              </label>

              {error ? <div className="error-banner">{error}</div> : null}

              <button className="primary-pill wide auth-submit" type="submit" disabled={submitting}>
                {submitting ? "Creating account..." : "Create account"}
              </button>
            </form>

            <p className="auth-switch auth-switch--centered">
              Already have an account? <Link to="/login">Log in</Link>
            </p>
          </section>
        </section>
      </section>
    </main>
  );
}
