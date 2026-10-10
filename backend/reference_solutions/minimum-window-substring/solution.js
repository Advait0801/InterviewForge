var minWindow = function (s, t) {
  const need = new Map();
  for (const c of t) need.set(c, (need.get(c) || 0) + 1);
  let missing = t.length, start = 0, bestStart = 0, bestLen = Infinity;
  for (let end = 0; end < s.length; end++) {
    const c = s[end];
    if (need.has(c)) {
      if (need.get(c) > 0) missing--;
      need.set(c, need.get(c) - 1);
    }
    while (missing === 0) {
      if (end - start + 1 < bestLen) { bestLen = end - start + 1; bestStart = start; }
      const d = s[start++];
      if (need.has(d)) {
        need.set(d, need.get(d) + 1);
        if (need.get(d) > 0) missing++;
      }
    }
  }
  return bestLen === Infinity ? "" : s.slice(bestStart, bestStart + bestLen);
};
