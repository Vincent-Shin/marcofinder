import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { fetchSession, logout as logoutRequest, savePreferences } from "./api";
import type { UserRecord } from "./types";

type AppStateValue = {
  user: UserRecord | null;
  compareKeys: string[];
  savedKeys: string[];
  isReady: boolean;
  setUser: (
    user: (UserRecord & { saved_keys?: string[]; compare_keys?: string[] }) | null,
  ) => void;
  toggleCompare: (key: string) => void;
  toggleSaved: (key: string) => void;
  clearCompare: () => void;
  logout: () => Promise<void>;
};

const STORAGE_KEYS = {
  user: "macrofinder_user",
  compare: "macrofinder_compare",
  saved: "macrofinder_saved",
};

const AppStateContext = createContext<AppStateValue | null>(null);

function readArray(key: string) {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readUser() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.user);
    return raw ? (JSON.parse(raw) as UserRecord) : null;
  } catch {
    return null;
  }
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<UserRecord | null>(() => readUser());
  const [compareKeys, setCompareKeys] = useState<string[]>(() =>
    readArray(STORAGE_KEYS.compare),
  );
  const [savedKeys, setSavedKeys] = useState<string[]>(() =>
    readArray(STORAGE_KEYS.saved),
  );
  const [isReady, setIsReady] = useState(false);
  const hasHydrated = useRef(false);

  useEffect(() => {
    async function hydrate() {
      try {
        const response = await fetchSession();
        setUserState({
          name: response.user.name,
          email: response.user.email,
          role: response.user.role,
          owned_restaurant_ids: response.user.owned_restaurant_ids || [],
          notifications: response.user.notifications || [],
        });
        setCompareKeys(response.user.compare_keys || []);
        setSavedKeys(response.user.saved_keys || []);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(
            STORAGE_KEYS.user,
            JSON.stringify({
              name: response.user.name,
              email: response.user.email,
              role: response.user.role,
              owned_restaurant_ids: response.user.owned_restaurant_ids || [],
              notifications: response.user.notifications || [],
            }),
          );
          window.localStorage.setItem(
            STORAGE_KEYS.compare,
            JSON.stringify(response.user.compare_keys || []),
          );
          window.localStorage.setItem(
            STORAGE_KEYS.saved,
            JSON.stringify(response.user.saved_keys || []),
          );
        }
      } catch {
        // keep guest/local state when there is no active server session
      } finally {
        hasHydrated.current = true;
        setIsReady(true);
      }
    }

    void hydrate();
  }, []);

  useEffect(() => {
    if (!hasHydrated.current || !user) return;
    void savePreferences({ saved_keys: savedKeys, compare_keys: compareKeys }).catch(() => {
      // Keep local UI responsive even if the sync request fails.
    });
  }, [compareKeys, savedKeys, user]);

  const setUser = (
    nextUser: (UserRecord & { saved_keys?: string[]; compare_keys?: string[] }) | null,
  ) => {
    setUserState(
      nextUser
        ? {
            name: nextUser.name,
            email: nextUser.email,
            role: nextUser.role,
            owned_restaurant_ids: nextUser.owned_restaurant_ids || [],
            notifications: nextUser.notifications || [],
          }
        : null,
    );
    if (nextUser) {
      setSavedKeys(nextUser.saved_keys || []);
      setCompareKeys(nextUser.compare_keys || []);
    }
    if (typeof window === "undefined") return;
    if (nextUser) {
      window.localStorage.setItem(
        STORAGE_KEYS.user,
        JSON.stringify({
          name: nextUser.name,
          email: nextUser.email,
          role: nextUser.role,
          owned_restaurant_ids: nextUser.owned_restaurant_ids || [],
          notifications: nextUser.notifications || [],
        }),
      );
      window.localStorage.setItem(
        STORAGE_KEYS.saved,
        JSON.stringify(nextUser.saved_keys || []),
      );
      window.localStorage.setItem(
        STORAGE_KEYS.compare,
        JSON.stringify(nextUser.compare_keys || []),
      );
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.user);
      window.localStorage.removeItem(STORAGE_KEYS.saved);
      window.localStorage.removeItem(STORAGE_KEYS.compare);
    }
  };

  const toggleCompare = (key: string) => {
    setCompareKeys((current) => {
      const next = current.includes(key)
        ? current.filter((entry) => entry !== key)
        : current.length >= 3
          ? current
          : [...current, key];
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEYS.compare, JSON.stringify(next));
      }
      return next;
    });
  };

  const toggleSaved = (key: string) => {
    setSavedKeys((current) => {
      const next = current.includes(key)
        ? current.filter((entry) => entry !== key)
        : [...current, key];
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEYS.saved, JSON.stringify(next));
      }
      return next;
    });
  };

  const clearCompare = () => {
    setCompareKeys([]);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEYS.compare);
    }
  };

  const logout = async () => {
    setUserState(null);
    setSavedKeys([]);
    setCompareKeys([]);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEYS.user);
      window.localStorage.removeItem(STORAGE_KEYS.saved);
      window.localStorage.removeItem(STORAGE_KEYS.compare);
    }
    await logoutRequest().catch(() => {
      // local logout should still succeed even if request fails
    });
  };

  const value = useMemo(
    () => ({
      user,
      compareKeys,
      savedKeys,
      isReady,
      setUser,
      toggleCompare,
      toggleSaved,
      clearCompare,
      logout,
    }),
    [user, compareKeys, savedKeys, isReady],
  );

  return (
    <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
  );
}

export function useAppState() {
  const value = useContext(AppStateContext);
  if (!value) {
    throw new Error("useAppState must be used within AppStateProvider");
  }
  return value;
}
