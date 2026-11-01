/** Minimal promise-based IndexedDB wrapper with an in-memory fallback (private mode / tests). */
const DB_NAME = 'nai-fold';
const DB_VERSION = 1;
export type StoreName = 'stories' | 'images' | 'blobs' | 'kv';
const STORES: StoreName[] = ['stories', 'images', 'blobs', 'kv'];

let dbPromise: Promise<IDBDatabase | null> | null = null;
const memory: Record<StoreName, Map<string, unknown>> = {
  stories: new Map(),
  images: new Map(),
  blobs: new Map(),
  kv: new Map(),
};

function open(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function tx<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        if (!db) return reject(new Error('no-idb'));
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export async function dbGet<T>(store: StoreName, key: string): Promise<T | undefined> {
  try {
    return await tx<T>(store, 'readonly', (s) => s.get(key) as IDBRequest<T>);
  } catch {
    return memory[store].get(key) as T | undefined;
  }
}

export async function dbPut<T>(store: StoreName, key: string, value: T): Promise<void> {
  try {
    await tx(store, 'readwrite', (s) => s.put(value, key));
  } catch {
    memory[store].set(key, value);
  }
}

export async function dbDelete(store: StoreName, key: string): Promise<void> {
  try {
    await tx(store, 'readwrite', (s) => s.delete(key));
  } catch {
    memory[store].delete(key);
  }
}

export async function dbAll<T>(store: StoreName): Promise<T[]> {
  try {
    return await tx<T[]>(store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>);
  } catch {
    return [...memory[store].values()] as T[];
  }
}

export async function dbClear(store: StoreName): Promise<void> {
  try {
    await tx(store, 'readwrite', (s) => s.clear());
  } catch {
    memory[store].clear();
  }
}

export async function requestPersistence() {
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* ignore */
  }
}
