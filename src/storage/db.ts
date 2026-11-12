import type { Offer } from '../core/types';

/**
 * 轻量 IndexedDB 封装（Local-first，无后端）。
 * 库：offerithm；对象仓库：offers(keyPath=id)、drafts(keyPath=id)。
 * 记录结构即 Offer 类型，日期字段（createdAt/updatedAt）为 ISO 8601 字符串。
 */
const DB_NAME = 'offerithm';
const DB_VERSION = 1;

export type StoreName = 'offers' | 'drafts';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    let blocked = false;
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('offers')) {
        db.createObjectStore('offers', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('drafts')) {
        db.createObjectStore('drafts', { keyPath: 'id' });
      }
    };
    req.onblocked = () => {
      blocked = true;
      reject(new Error('IndexedDB open blocked by another connection.'));
    };
    req.onsuccess = () => {
      const db = req.result;
      if (blocked) {
        db.close();
        return;
      }
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed.'));
  });
}

async function withStore<T>(
  store: StoreName,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    let tx: IDBTransaction | undefined;
    let result: T;
    let settled = false;
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      db.close();
      reject(error);
    };
    db.onclose = () => fail(new Error('IndexedDB connection closed unexpectedly.'));
    try {
      tx = db.transaction(store, mode);
      const transaction = tx;
      transaction.oncomplete = () => {
        if (settled) return;
        settled = true;
        db.close();
        resolve(result);
      };
      transaction.onabort = () => fail(transaction.error ?? new Error('IndexedDB transaction aborted.'));
      transaction.onerror = () => fail(transaction.error ?? new Error('IndexedDB transaction failed.'));
      const req = fn(transaction.objectStore(store));
      req.onsuccess = () => { result = req.result as T; };
      req.onerror = () => fail(req.error ?? new Error('IndexedDB request failed.'));
    } catch (error) {
      if (tx) {
        try { tx.abort(); } catch { /* Transaction may already be inactive. */ }
      }
      fail(error);
    }
  });
}

export const offerStore = {
  list: (): Promise<Offer[]> => withStore<Offer[]>('offers', 'readonly', (s) => s.getAll()),
  get: (id: string): Promise<Offer | undefined> => withStore<Offer | undefined>('offers', 'readonly', (s) => s.get(id)),
  put: (offer: Offer): Promise<IDBValidKey> => withStore('offers', 'readwrite', (s) => s.put(offer)),
  remove: (id: string): Promise<undefined> => withStore('offers', 'readwrite', (s) => s.delete(id)),
};

export const draftStore = {
  list: (): Promise<Offer[]> => withStore<Offer[]>('drafts', 'readonly', (s) => s.getAll()),
  put: (offer: Offer): Promise<IDBValidKey> => withStore('drafts', 'readwrite', (s) => s.put(offer)),
  remove: (id: string): Promise<undefined> => withStore('drafts', 'readwrite', (s) => s.delete(id)),
};
