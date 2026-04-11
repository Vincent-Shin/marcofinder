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
  { rel: "manifest", href: "/manifest.webmanifest" },
  { rel: "icon", href: "/favicon.ico" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
];

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAppState();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [installed, setInstalled] = useState(false);
  const isManager = user?.role === "admin" || user?.role === "restaurant_owner";

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const standaloneFromMedia = window.matchMedia("(display-mode: standalone)").matches;
    const standaloneFromNavigator = Boolean((navigator as { standalone?: boolean }).standalone);
    setInstalled(standaloneFromMedia || standaloneFromNavigator);

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    if (!import.meta.env.PROD) {
      const clearDevCaches = async () => {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((registration) => registration.unregister()));
          if ("caches" in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map((key) => caches.delete(key)));
          }
        } catch {
          // non-blocking dev cleanup
        }
      };
      void clearDevCaches();
      return;
    }

    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch {
        // keep UI functional even if service worker registration fails
      }
    };
    void register();
  }, []);

  async function handleInstall() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setInstalled(true);
    }
    setInstallPrompt(null);
  }

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
                <Link to="/profile" className="top-tab top-tab--user top-tab--mobile-profile">
                  Profile
                </Link>
              ) : (
                <>
                  <Link to="/login" className="top-tab top-tab--mobile-profile">
                    Log in
                  </Link>
                  <Link to="/signup" className="top-tab top-tab--accent top-tab--desktop-only">
                    Sign up
                  </Link>
                </>
              )}
              {!installed && installPrompt ? (
                <button
                  type="button"
                  className="top-tab top-tab--accent top-tab--desktop-only"
                  onClick={() => void handleInstall()}
                >
                  Install
                </button>
              ) : null}

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

      {!isAuthPage ? (
        <nav className="mobile-dock" aria-label="Mobile navigation">
          <NavLink to="/discover" className="mobile-dock-link">
            Home
          </NavLink>
          <NavLink to="/compare" className="mobile-dock-link">
            Compare
          </NavLink>
          <NavLink to="/admin" className="mobile-dock-link">
            Manage
          </NavLink>
        </nav>
      ) : null}
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="theme-color" content="#2f7a59" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Macro Finder" />
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
