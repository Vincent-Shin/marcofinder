import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  NavLink,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
  useNavigate,
} from "react-router";
import { useEffect, useState } from "react";

import type { Route } from "./+types/root";
import "./app.css";
import { AppStateProvider, useAppState } from "./lib/app-state";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Inter:wght@400;500;600;700;800&display=swap",
  },
];

function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAppState();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const isAuthPage =
    location.pathname === "/" ||
    location.pathname === "/login" ||
    location.pathname === "/signup";

  return (
    <div className="site-shell">
      {!isAuthPage ? (
        <header className="topbar">
          <div className="container topbar-inner">
            <button
              className="brand"
              type="button"
              onClick={() => navigate("/discover")}
              aria-label="Go to discover"
            >
              <span className="brand-mark">M</span>
              <span className="brand-copy">
                <strong>Macro Finder</strong>
              </span>
            </button>

            <nav className={`topnav ${mobileOpen ? "is-open" : ""}`}>
              <NavLink to="/discover">Discover</NavLink>
              <NavLink to="/compare">Compare</NavLink>
              {user?.role === "admin" || user?.role === "restaurant_owner" ? (
                <NavLink to="/admin">Manage</NavLink>
              ) : null}
            </nav>

            <div className="top-actions">
              {user ? (
                <Link to="/profile" className="top-tab top-tab--user">
                  {user.name}
                </Link>
              ) : (
                <>
                  <Link to="/login" className="top-tab">
                    Log in
                  </Link>
                  <Link to="/signup" className="top-tab top-tab--accent">
                    Sign up
                  </Link>
                </>
              )}

              <button
                type="button"
                className="menu-toggle"
                onClick={() => setMobileOpen((value) => !value)}
                aria-label="Toggle menu"
              >
                Menu
              </button>
            </div>
          </div>
        </header>
      ) : null}

      <Outlet />
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <AppStateProvider>
      <Shell />
    </AppStateProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Something broke";
  let details = "An unexpected error occurred while loading Macro Finder.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Route error";
    details =
      error.status === 404
        ? "That page does not exist."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="container error-page">
      <h1>{message}</h1>
      <p>{details}</p>
      <Link to="/discover" className="primary-pill">
        Back to app
      </Link>
      {stack ? <pre>{stack}</pre> : null}
    </main>
  );
}
