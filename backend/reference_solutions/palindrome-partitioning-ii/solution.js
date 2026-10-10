var minCut = function (s) {
  const n = s.length, cut = Array.from({ length: n + 1 }, (_, i) => i - 1);
  for (let center = 0; center < n; center++) {
    for (const odd of [0, 1]) {
      let l = center, r = center + odd;
      while (l >= 0 && r < n && s[l] === s[r]) {
        cut[r + 1] = Math.min(cut[r + 1], cut[l] + 1);
        l--; r++;
      }
    }
  }
  return cut[n];
};
