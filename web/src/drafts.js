// Scene payloads and list metadata are separate so opening the shelf is cheap.
export function createDraftStore(indexedDB = globalThis.indexedDB, databaseName = 'draw-in-3d-drafts') {
  let connection;
  const open = () => connection ||= new Promise((resolve, reject) => {
    if (!indexedDB) { reject(new Error('Local storage is unavailable.')); return; }
    const request = indexedDB.open(databaseName, 1);
    let settled = false;
    const fail = message => { if (!settled) { settled = true; clearTimeout(timer); reject(new Error(message)); } };
    const timer = setTimeout(() => fail('Local storage did not respond. Close older editor tabs and retry.'), 8000);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of ['scenes', 'summaries']) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, {keyPath:'id'});
    };
    request.onerror = () => fail('Local storage could not be opened. Export your project to keep it.');
    request.onblocked = () => fail('Close older editor tabs, then retry local storage.');
    request.onsuccess = () => {
      const db = request.result;
      if (settled) { db.close(); return; }
      settled = true; clearTimeout(timer);
      db.onversionchange = () => { db.close(); connection = undefined; };
      // The browser can close a connection itself (site data cleared, disk error): reopen on next use.
      db.onclose = () => { connection = undefined; };
      resolve(db);
    };
  }).catch(error => { connection = undefined; throw error; });
  async function transaction(mode, work) {
    const db = await open();
    return new Promise((resolve, reject) => {
      let tx;
      try { tx = db.transaction(['scenes', 'summaries'], mode); } catch { connection = undefined; reject(new Error('Local save failed. Export your project and retry.')); return; }
      let result;
      tx.oncomplete = () => resolve(result?.result);
      tx.onerror = tx.onabort = () => reject(new Error(tx.error?.name === 'QuotaExceededError' ? 'Browser storage is full. Download drafts, then delete ones you no longer need.' : 'Local save failed. Export your project and retry.'));
      try { result = work(tx); } catch (error) { tx.abort(); reject(error); }
    });
  }
  return {
    async put(record) {
      const {text, ...summary} = record;
      await transaction('readwrite', tx => {
        tx.objectStore('scenes').put(record);
        tx.objectStore('summaries').put(summary);
      });
    },
    list: () => transaction('readonly', tx => tx.objectStore('summaries').getAll()),
    get: id => transaction('readonly', tx => tx.objectStore('scenes').get(id)),
    remove: id => transaction('readwrite', tx => {
      tx.objectStore('scenes').delete(id); tx.objectStore('summaries').delete(id);
    })
  };
}

// Capture each document's committed state at enqueue time. An older document's
// async completion must never replace a newer document or claim it was saved.
export class DraftWriter {
  constructor(store, status = () => {}, delay = 1000) {
    this.store = store; this.status = status; this.delay = delay;
    this.pending = new Map(); this.failed = new Map(); this.latest = new Map(); this.serial = 0;
  }
  enqueue(id, create) {
    const job = {id, create, serial:++this.serial};
    this.latest.set(id, job.serial); this.pending.set(id, job); this.failed.delete(id);
    this.status(id, 'pending'); clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), this.delay);
  }
  report(job, state, error) { if (this.latest.get(job.id) === job.serial) this.status(job.id, state, error); }
  async flush() {
    clearTimeout(this.timer);
    if (this.running) { await this.running; if (this.pending.size) return this.flush(); return; }
    this.running = this.drain();
    try { await this.running; } finally { this.running = null; }
  }
  async drain() {
    while (this.pending.size) {
      const [id, job] = this.pending.entries().next().value;
      this.pending.delete(id); this.report(job, 'saving');
      try {
        await this.store.put(job.create());
        this.report(job, 'saved');
      } catch (error) {
        if (this.latest.get(id) === job.serial) this.failed.set(id, job);
        this.report(job, 'error', error);
      }
    }
  }
  async retry() {
    for (const [id, job] of this.failed) if (!this.pending.has(id)) this.pending.set(id, job);
    this.failed.clear(); await this.flush();
  }
}
