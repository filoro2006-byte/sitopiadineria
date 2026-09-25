// Salvataggi con IndexedDB (con ripiego in memoria)
(function () {
  'use strict';
  const MC = (window.MC = window.MC || {});

  class Storage {
    constructor() {
      this.db = null;
      this.ok = false;
      this.pending = new Map();
      this.flushTimer = null;
      this.mem = { worlds: new Map(), chunks: new Map() };
    }

    open() {
      return new Promise((resolve) => {
        let req;
        try {
          if (!window.indexedDB) { resolve(false); return; }
          req = indexedDB.open('blockcraft', 1);
        } catch (e) { resolve(false); return; }
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('worlds')) db.createObjectStore('worlds', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('chunks')) db.createObjectStore('chunks');
        };
        req.onsuccess = () => { this.db = req.result; this.ok = true; resolve(true); };
        req.onerror = () => resolve(false);
        req.onblocked = () => resolve(false);
        setTimeout(() => resolve(this.ok), 4000);
      });
    }

    _tx(store, mode) { return this.db.transaction(store, mode).objectStore(store); }

    listWorlds() {
      if (!this.ok) return Promise.resolve([...this.mem.worlds.values()]);
      return new Promise((resolve) => {
        try {
          const r = this._tx('worlds', 'readonly').getAll();
          r.onsuccess = () => resolve((r.result || []).sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0)));
          r.onerror = () => resolve([]);
        } catch (e) { resolve([]); }
      });
    }

    saveWorld(meta) {
      if (!this.ok) { this.mem.worlds.set(meta.id, meta); return Promise.resolve(); }
      return new Promise((resolve) => {
        try {
          const r = this._tx('worlds', 'readwrite').put(meta);
          r.onsuccess = () => resolve(); r.onerror = () => resolve();
        } catch (e) { resolve(); }
      });
    }

    loadChunks(worldId) {
      const out = new Map();
      const prefix = worldId + ':';
      if (!this.ok) {
        for (const [k, v] of this.mem.chunks) if (k.startsWith(prefix)) out.set(+k.slice(prefix.length), v);
        return Promise.resolve(out);
      }
      return new Promise((resolve) => {
        try {
          const store = this._tx('chunks', 'readonly');
          const range = IDBKeyRange.bound(prefix, prefix + '￿');
          const rk = store.getAllKeys(range);
          const rv = store.getAll(range);
          rv.onsuccess = () => {
            const keys = rk.result || [];
            const vals = rv.result || [];
            for (let i = 0; i < keys.length; i++) out.set(+String(keys[i]).slice(prefix.length), vals[i]);
            resolve(out);
          };
          rv.onerror = () => resolve(out);
        } catch (e) { resolve(out); }
      });
    }

    saveChunk(worldId, key, data) {
      const k = worldId + ':' + key;
      if (!this.ok) { this.mem.chunks.set(k, data); return; }
      this.pending.set(k, data);
      if (!this.flushTimer) this.flushTimer = setTimeout(() => this.flush(), 800);
    }

    flush() {
      this.flushTimer = null;
      if (!this.ok || !this.pending.size) return Promise.resolve();
      const items = [...this.pending];
      this.pending.clear();
      return new Promise((resolve) => {
        try {
          const tx = this.db.transaction('chunks', 'readwrite');
          const st = tx.objectStore('chunks');
          for (const [k, v] of items) st.put(v, k);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
          tx.onabort = () => resolve();
        } catch (e) { resolve(); }
      });
    }

    deleteWorld(id) {
      const prefix = id + ':';
      if (!this.ok) {
        this.mem.worlds.delete(id);
        for (const k of [...this.mem.chunks.keys()]) if (k.startsWith(prefix)) this.mem.chunks.delete(k);
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        try {
          const tx = this.db.transaction(['worlds', 'chunks'], 'readwrite');
          tx.objectStore('worlds').delete(id);
          tx.objectStore('chunks').delete(IDBKeyRange.bound(prefix, prefix + '￿'));
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch (e) { resolve(); }
      });
    }
  }

  MC.Storage = Storage;
})();
