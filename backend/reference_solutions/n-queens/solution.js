var solveNQueens = function (n) {
  const out = [], cols = new Array(n).fill(-1);
  const used = new Set(), d1 = new Set(), d2 = new Set();
  const place = (r) => {
    if (r === n) {
      out.push(cols.map((c) => ".".repeat(c) + "Q" + ".".repeat(n - c - 1)));
      return;
    }
    for (let c = 0; c < n; c++) {
      if (used.has(c) || d1.has(r - c) || d2.has(r + c)) continue;
      used.add(c); d1.add(r - c); d2.add(r + c); cols[r] = c;
      place(r + 1);
      used.delete(c); d1.delete(r - c); d2.delete(r + c);
    }
  };
  place(0);
  return out;
};
