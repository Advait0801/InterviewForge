class TimeMap {
  constructor() {
    this.store = new Map();
  }

  set(key, value, timestamp) {
    if (!this.store.has(key)) this.store.set(key, []);
    this.store.get(key).push([timestamp, value]);
  }

  get(key, timestamp) {
    const list = this.store.get(key) || [];
    let lo = 0, hi = list.length - 1, ans = "";
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (list[mid][0] <= timestamp) { ans = list[mid][1]; lo = mid + 1; }
      else hi = mid - 1;
    }
    return ans;
  }
}
