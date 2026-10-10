var setZeroes = function (matrix) {
  const rows = new Set(), cols = new Set();
  matrix.forEach((row, r) => row.forEach((v, c) => { if (v === 0) { rows.add(r); cols.add(c); } }));
  matrix.forEach((row, r) => row.forEach((_, c) => { if (rows.has(r) || cols.has(c)) row[c] = 0; }));
};
