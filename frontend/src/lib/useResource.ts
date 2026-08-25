import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';

/**
 * When the app should go back to the server for data.
 *
 * Every screen in this app lives inside one mounted component — the tab bar
 * only swaps a `screen` variable — so an effect keyed on `[]` runs once per
 * login and nothing short of a browser refresh ever fetches again. A parent
 * would sit on the diary while a teacher posted homework and see nothing.
 * These options are the three answers to that:
 *
 *  - `active` — opening a screen refetches what it shows.
 *  - `onFocus` — coming back to the tab, or resuming the app on a phone,
 *    refetches. On Capacitor there is no page load, so this is the only
 *    signal a backgrounded app ever gets.
 *  - `pollMs` — for the few screens someone leaves open while the data behind
 *    them changes.
 */
export interface RevalidateOptions {
  /**
   * Fetch only while true, and refetch each time it flips false → true.
   * That flip is how a screen gets fresh data the moment it is opened.
   * Defaults to true (fetch on mount, like a plain effect).
   */
  active?: boolean;
  /** Refetch when the tab is refocused or the app resumed. Default true. */
  onFocus?: boolean;
  /** Refetch this often while active and visible. Off unless set. */
  pollMs?: number;
  /**
   * Extra values that trigger a refetch while active. Unlike a resource key
   * these don't clear what's on screen — use them for "the user moved to
   * another screen that reads this same data".
   *
   * Must keep a constant length across renders, like any hook dependency list.
   */
  revalidateOn?: unknown[];
}

/** Window between the paired `focus` / `visibilitychange` events of one resume. */
const DEDUPE_MS = 400;

/**
 * Run `run` on the triggers described by {@link RevalidateOptions}.
 *
 * The low-level half of {@link useResource}, for callers that already own
 * their loading state and just need it kept current.
 */
export function useRevalidate(
  run: () => void | Promise<void>,
  opts: RevalidateOptions = {},
): void {
  const { active = true, onFocus = true, pollMs, revalidateOn = [] } = opts;

  // Callers pass an inline closure, so keep the newest one in a ref rather
  // than re-arming every listener on each render.
  const runRef = useRef(run);
  runRef.current = run;

  const fire = useCallback(() => {
    void runRef.current();
  }, []);

  // Mount, and every time the screen using this data is opened again. Never
  // debounced: two navigations in quick succession are two different screens
  // asking for two different things.
  useEffect(() => {
    if (!active) return;
    fire();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, fire, ...revalidateOn]);

  const wokeAt = useRef(0);
  useEffect(() => {
    if (!active || !onFocus) return;
    const wake = () => {
      if (document.visibilityState !== 'visible') return;
      // A phone resume fires both events; one fetch is enough.
      const now = Date.now();
      if (now - wokeAt.current < DEDUPE_MS) return;
      wokeAt.current = now;
      fire();
    };
    window.addEventListener('focus', wake);
    document.addEventListener('visibilitychange', wake);
    return () => {
      window.removeEventListener('focus', wake);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [active, onFocus, fire]);

  useEffect(() => {
    if (!active || !pollMs) return;
    // A hidden tab burns requests for nobody; the focus listener covers the
    // moment it comes back.
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') fire();
    }, pollMs);
    return () => clearInterval(id);
  }, [active, pollMs, fire]);
}

export interface ResourceOptions extends RevalidateOptions {
  /**
   * Identity of the thing being fetched — the selected child, the open class.
   * Changing it means the data on screen belongs to something else, so it is
   * cleared and refetched rather than left showing the previous answer.
   *
   * Must keep a constant length across renders.
   */
  key?: unknown[];
}

export interface Resource<T> {
  data: T;
  /**
   * True until the first load for the current key settles. A background
   * refetch never sets it, so screens don't flash a spinner on every poll.
   */
  loading: boolean;
  /** True whenever a fetch is in flight, background revalidation included. */
  refreshing: boolean;
  /** True when the last completed fetch failed. */
  error: boolean;
  reload: () => Promise<void>;
  /** For optimistic updates; the next fetch overwrites whatever this set. */
  setData: Dispatch<SetStateAction<T>>;
}

/**
 * Server data that keeps itself current.
 *
 *   const diary = useResource(
 *     () => listStudentDiary(studentId),
 *     [] as ParentDiaryEntry[],
 *     { key: [studentId], active: screen === 'diary', pollMs: 60_000 },
 *   );
 *
 * `fetcher` may be an inline closure — it is read through a ref, so only
 * `key` and `revalidateOn` decide when a fetch happens.
 */
export function useResource<T>(
  fetcher: () => Promise<T>,
  fallback: T,
  opts: ResourceOptions = {},
): Resource<T> {
  const { key = [], active = true, onFocus, pollMs, revalidateOn = [] } = opts;

  const [data, setData] = useState<T>(fallback);
  const [inFlight, setInFlight] = useState(false);
  const [settled, setSettled] = useState(false);
  const [error, setError] = useState(false);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const fallbackRef = useRef(fallback);
  fallbackRef.current = fallback;
  const settledRef = useRef(false);

  // Only the newest run may write: a slow response from the previous child
  // must not land on top of the one the user is now looking at.
  const runRef = useRef(0);

  const reload = useCallback(async () => {
    const run = ++runRef.current;
    setInFlight(true);
    try {
      const next = await fetcherRef.current();
      if (run !== runRef.current) return;
      setData(next);
      setError(false);
    } catch {
      if (run !== runRef.current) return;
      setError(true);
      // A failed *refresh* keeps what's on screen — a dropped connection
      // shouldn't blank a diary the parent was reading. Only a first load,
      // which has nothing to fall back to, resets.
      if (!settledRef.current) setData(fallbackRef.current);
    } finally {
      if (run === runRef.current) {
        settledRef.current = true;
        setInFlight(false);
        setSettled(true);
      }
    }
  }, []);

  // A new key is different data, so drop the old answer while the new one
  // loads. Skipped on mount, where there is nothing to clear.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    runRef.current++; // abandon any in-flight response for the previous key
    settledRef.current = false;
    setData(fallbackRef.current);
    setInFlight(false);
    setSettled(false);
    setError(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, key);

  useRevalidate(reload, {
    active,
    onFocus,
    pollMs,
    revalidateOn: [...key, ...revalidateOn],
  });

  return {
    data,
    loading: active && !settled,
    refreshing: inFlight,
    error,
    reload,
    setData,
  };
}
