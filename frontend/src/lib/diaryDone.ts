// Homework ticking is kept client-side only, per child — it never touches the
// backend (the /parent/diary/:id/done endpoint is intentionally left unused).
// Shape: { [studentId]: number[] } of diary entry ids marked done.
const KEY = 'gw_diary_done_v1';

type Store = Record<string, number[]>;

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function write(store: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // Best-effort; ticking simply won't persist if storage is unavailable.
  }
}

export function getDone(studentId: number): Set<number> {
  return new Set(read()[String(studentId)] ?? []);
}

export function setDone(studentId: number, entryId: number, done: boolean): Set<number> {
  const store = read();
  const key = String(studentId);
  const set = new Set(store[key] ?? []);
  if (done) set.add(entryId);
  else set.delete(entryId);
  store[key] = [...set];
  write(store);
  return set;
}
