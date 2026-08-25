const defaultSchedule = (callback) => globalThis.setTimeout(callback, 0);

/**
 * Retain shared async resources while they are mounted, then keep only the
 * most recently used inactive entries. Loading promises are shared as well,
 * so React StrictMode remounts do not start duplicate work.
 */
export function createRetainedResourceCache({
  maxInactive,
  dispose = () => {},
  schedule = defaultSchedule,
}) {
  if (!Number.isInteger(maxInactive) || maxInactive < 0) {
    throw new TypeError("maxInactive must be a non-negative integer");
  }

  const entries = new Map();
  let clock = 0;
  let pruneScheduled = false;

  const disposeValue = (value) => {
    try {
      Promise.resolve(dispose(value)).catch(() => {});
    } catch {
      // Cache eviction must not break the currently rendered screen.
    }
  };

  const evict = (key, entry) => {
    if (entries.get(key) !== entry) return;
    entries.delete(key);
    entry.evicted = true;
    if (entry.status === "ready") disposeValue(entry.value);
  };

  const prune = () => {
    pruneScheduled = false;
    const inactive = [...entries.entries()]
      .filter(([, entry]) => entry.references === 0)
      .sort((left, right) => left[1].lastUsed - right[1].lastUsed);
    while (inactive.length > maxInactive) {
      const [key, entry] = inactive.shift();
      evict(key, entry);
    }
  };

  const schedulePrune = () => {
    if (pruneScheduled) return;
    pruneScheduled = true;
    schedule(prune);
  };

  const acquire = (key, load) => {
    if (!key) throw new TypeError("cache key is required");
    let entry = entries.get(key);
    if (!entry) {
      entry = {
        references: 0,
        lastUsed: ++clock,
        status: "loading",
        value: undefined,
        evicted: false,
        promise: null,
      };
      entry.promise = Promise.resolve()
        .then(load)
        .then((value) => {
          entry.status = "ready";
          entry.value = value;
          if (entry.evicted) disposeValue(value);
          return value;
        })
        .catch((error) => {
          entry.status = "error";
          if (entries.get(key) === entry) entries.delete(key);
          throw error;
        });
      entries.set(key, entry);
    }

    entry.references += 1;
    entry.lastUsed = ++clock;
    let released = false;
    return {
      promise: entry.promise,
      release() {
        if (released) return;
        released = true;
        entry.references = Math.max(0, entry.references - 1);
        entry.lastUsed = ++clock;
        schedulePrune();
      },
    };
  };

  return {
    acquire,
    size: () => entries.size,
    snapshot: () => [...entries.entries()].map(([key, entry]) => ({
      key,
      references: entry.references,
      status: entry.status,
    })),
    clear: () => {
      [...entries.entries()].forEach(([key, entry]) => evict(key, entry));
    },
  };
}
