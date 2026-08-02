// ── src/lib/offline-queue.ts ─────────────────────────────────────────────────
// IndexedDB-backed queue for mutations that were made while the device was
// offline. Requests are stored with their auth token and tenant headers so the
// Background Sync handler can replay them without user interaction.
//
// Industry-standard token strategy used here:
//   The token is captured at the time the action is queued. Typical dashboard
//   sessions keep tokens valid for hours to days. If a token has expired by
//   the time sync runs, the server will return 401. The sync handler catches
//   this, marks the item as 'failed', and surfaces a clear error in the UI
//   ("Session expired — please retry after logging in") rather than silently
//   dropping the request.

const DB_NAME  = 'tk-offline-queue';
const DB_VER   = 1;
const STORE    = 'requests';

export type QueueStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface QueuedRequest {
  id: string;
  createdAt: string;
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  url: string;
  body: Record<string, unknown> | null;
  headers: Record<string, string>;
  /** Short human-readable label shown in the Sync Center, e.g. "Register employee John Doe" */
  label: string;
  status: QueueStatus;
  failureReason?: string;
  retryCount: number;
}

// ── Open / initialise the DB ─────────────────────────────────────────────────
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function tx(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const req = fn(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Add a new request to the queue. Returns the generated ID. */
export async function enqueue(
  item: Omit<QueuedRequest, 'id' | 'createdAt' | 'status' | 'retryCount'>,
): Promise<string> {
  const db = await openDb();
  const entry: QueuedRequest = {
    ...item,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: 'pending',
    retryCount: 0,
  };
  await tx(db, 'readwrite', (s) => s.put(entry));
  return entry.id;
}

/** Fetch all queued items (for the Sync Center UI). */
export async function getAll(): Promise<QueuedRequest[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, 'readonly');
    const req = t.objectStore(STORE).getAll();
    req.onsuccess = () =>
      resolve(
        (req.result as QueuedRequest[]).sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        ),
      );
    req.onerror = () => reject(req.error);
  });
}

/** Fetch only pending items (oldest first) — used by the sync handler. */
export async function getPending(): Promise<QueuedRequest[]> {
  const all = await getAll();
  return all.filter((r) => r.status === 'pending');
}

/** Update a single item's status and optional failure reason. */
export async function updateItem(
  id: string,
  patch: Partial<Pick<QueuedRequest, 'status' | 'failureReason' | 'retryCount'>>,
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, 'readwrite');
    const store = t.objectStore(STORE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const item = getReq.result as QueuedRequest | undefined;
      if (!item) { resolve(); return; }
      const putReq = store.put({ ...item, ...patch });
      putReq.onsuccess = () => resolve();
      putReq.onerror   = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

/** Remove a successfully synced item. */
export async function remove(id: string): Promise<void> {
  const db = await openDb();
  await tx(db, 'readwrite', (s) => s.delete(id));
}

/** Remove all synced items (called after the Sync Center auto-clears them). */
export async function clearSynced(): Promise<void> {
  const db = await openDb();
  const all = await getAll();
  for (const item of all.filter((r) => r.status === 'synced')) {
    await tx(db, 'readwrite', (s) => s.delete(item.id));
  }
}

/** Count pending + failed items (for the badge in the Sync Center). */
export async function pendingCount(): Promise<number> {
  const all = await getAll();
  return all.filter((r) => r.status === 'pending' || r.status === 'failed').length;
}

// ── Replay function (called by SW and by the online-event fallback) ──────────
// MAX_RETRIES = 3 (total across all sync attempts, not per-session)
const MAX_RETRIES = 3;

export async function replayQueue(): Promise<void> {
  const pending = await getPending();
  for (const item of pending) {
    await updateItem(item.id, { status: 'syncing' });
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: {
          'Content-Type': 'application/json',
          ...item.headers,
        },
        body: item.body ? JSON.stringify(item.body) : undefined,
      });

      if (res.ok) {
        // Mark synced; the SyncCenter will auto-remove it after showing a tick
        await updateItem(item.id, { status: 'synced' });
        // Dispatch a custom event so open clients can update their UI
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('sync-center-updated'));
        }
      } else {
        const data = await res.json().catch(() => ({}));
        const msg = Array.isArray(data?.message)
          ? data.message.join(', ')
          : data?.message ?? `Server returned ${res.status}`;

        const nextRetry = item.retryCount + 1;
        if (nextRetry >= MAX_RETRIES || res.status === 401 || res.status === 403) {
          // Permanent failure or auth error — stop retrying
          const sessionMsg =
            res.status === 401
              ? 'Session expired — please retry after logging in again'
              : msg;
          await updateItem(item.id, {
            status: 'failed',
            failureReason: sessionMsg,
            retryCount: nextRetry,
          });
        } else {
          // Will retry on next sync
          await updateItem(item.id, {
            status: 'pending',
            failureReason: msg,
            retryCount: nextRetry,
          });
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('sync-center-updated'));
        }
      }
    } catch {
      // Network still down during this sync attempt — reset to pending
      await updateItem(item.id, { status: 'pending' });
    }
  }
}
