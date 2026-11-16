import type { Offer } from '../core/types';
import { validateOffer } from '../core/validation';

/**
 * 轻量 IndexedDB 封装（Local-first，无后端）。
 * 库：offerithm；对象仓库：offers(keyPath=id)、drafts(keyPath=id)。
 * 记录结构即 Offer 类型，日期字段（createdAt/updatedAt）为 ISO 8601 字符串。
 */
const DB_NAME = 'offerithm';
const DB_VERSION = 1;

export type StoreName = 'offers' | 'drafts';
type DeepPartial<T> = T extends Array<infer U> ? Array<DeepPartial<U>> : T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;
export type DraftOffer = DeepPartial<Offer> & { id: string };

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
  save: saveOffer,
  remove: (id: string): Promise<undefined> => withStore('offers', 'readwrite', (s) => s.delete(id)),
};

export const draftStore = {
  get: (id: string): Promise<DraftOffer | undefined> => withStore('drafts', 'readonly', (s) => s.get(id)),
  list: (): Promise<DraftOffer[]> => withStore<DraftOffer[]>('drafts', 'readonly', (s) => s.getAll()),
  put: (offer: DraftOffer): Promise<IDBValidKey> => withStore('drafts', 'readwrite', (s) => s.put(offer)),
  remove: (id: string): Promise<undefined> => withStore('drafts', 'readwrite', (s) => s.delete(id)),
};

/** A preview captures the records that could be overwritten, including absent IDs. */
export interface ImportPreview {
  offers: Offer[];
  added: string[];
  overwritten: string[];
  baseline: Array<Offer | undefined>;
}

export async function prepareImport(offers: Offer[]): Promise<ImportPreview> {
  assertImportOffers(offers);
  const existing = await offerStore.list();
  const byId = new Map(existing.map(offer => [offer.id, offer]));
  const copies = structuredClone(offers);
  return {
    offers: copies,
    added: copies.filter(offer => !byId.has(offer.id)).map(offer => offer.id),
    overwritten: copies.filter(offer => byId.has(offer.id)).map(offer => offer.id),
    baseline: copies.map(offer => byId.get(offer.id)),
  };
}

function assertImportOffers(offers: Offer[]): void {
  const ids = new Set<string>();
  for (const offer of offers) {
    const issues = validateOffer(offer);
    if (issues.length) throw new Error(`Offer 无效：${issues.map(i => `${i.path}: ${i.message}`).join('；')}`);
    if (ids.has(offer.id)) throw new Error(`重复的 Offer ID: ${offer.id}`);
    ids.add(offer.id);
  }
}

export async function commitImport(preview: ImportPreview): Promise<void> {
  assertImportOffers(preview.offers);
  if (preview.baseline.length !== preview.offers.length) throw new Error('导入预览无效');
  const db = await openDb();
  return new Promise((resolve, reject) => {
    let tx: IDBTransaction | undefined;
    let callbackError: unknown;
    db.onclose = () => reject(new Error('IndexedDB 连接意外关闭。'));
    try {
      tx = db.transaction('offers', 'readwrite');
      const transaction = tx;
      const store = transaction.objectStore('offers');
      let conflict = false;
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = () => { db.close(); reject(callbackError ?? new Error(conflict ? '导入预览后数据发生变化，请重新预览。' : '导入事务已中止。')); };
      tx.onerror = () => { /* abort handler reports transaction failure */ };
      const req = store.getAll();
      req.onsuccess = () => {
        try {
          const existing = new Map((req.result as Offer[]).map(offer => [offer.id, offer]));
          if (preview.offers.some((offer, i) => JSON.stringify(existing.get(offer.id)) !== JSON.stringify(preview.baseline[i]))) {
            conflict = true;
            transaction.abort();
            return;
          }
          for (const offer of preview.offers) store.put(offer);
        } catch (error) {
          callbackError = error;
          transaction.abort();
        }
      };
    } catch (error) { try { tx?.abort(); } catch { /* already inactive */ } db.close(); reject(error); }
  });
}

async function saveOffer(offer: Offer): Promise<IDBValidKey> {
  const issues = validateOffer(offer);
  if (issues.length) throw new Error(`Offer 无效：${issues.map(i => `${i.path}: ${i.message}`).join('；')}`);
  const db = await openDb();
  return new Promise((resolve, reject) => {
    let tx: IDBTransaction | undefined;
    let key: IDBValidKey;
    db.onclose = () => reject(new Error('IndexedDB 连接意外关闭。'));
    try {
      tx = db.transaction(['offers', 'drafts'], 'readwrite');
      const transaction = tx;
      transaction.oncomplete = () => { db.close(); resolve(key); };
      transaction.onabort = () => { db.close(); reject(transaction.error ?? new Error('保存事务已中止。')); };
      transaction.onerror = () => { /* abort handler reports transaction failure */ };
      const request = transaction.objectStore('offers').put(offer);
      request.onsuccess = () => { key = request.result; };
      transaction.objectStore('drafts').delete(offer.id);
    } catch (error) { try { tx?.abort(); } catch { /* already inactive */ } db.close(); reject(error); }
  });
}
