class LFUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.values = new Map(); // key -> [value, freq]
    this.byFreq = new Map(); // freq -> Set of keys in recency order
    this.minFreq = 0;
  }

  touch(key) {
    const entry = this.values.get(key);
    const f = entry[1];
    this.byFreq.get(f).delete(key);
    if (this.byFreq.get(f).size === 0) {
      this.byFreq.delete(f);
      if (this.minFreq === f) this.minFreq = f + 1;
    }
    entry[1] = f + 1;
    if (!this.byFreq.has(f + 1)) this.byFreq.set(f + 1, new Set());
    this.byFreq.get(f + 1).add(key);
  }

  get(key) {
    if (!this.values.has(key)) return -1;
    this.touch(key);
    return this.values.get(key)[0];
  }

  put(key, value) {
    if (this.capacity <= 0) return;
    if (this.values.has(key)) {
      this.values.get(key)[0] = value;
      this.touch(key);
      return;
    }
    if (this.values.size >= this.capacity) {
      const keys = this.byFreq.get(this.minFreq);
      const evict = keys.values().next().value;
      keys.delete(evict);
      if (keys.size === 0) this.byFreq.delete(this.minFreq);
      this.values.delete(evict);
    }
    this.values.set(key, [value, 1]);
    if (!this.byFreq.has(1)) this.byFreq.set(1, new Set());
    this.byFreq.get(1).add(key);
    this.minFreq = 1;
  }
}
