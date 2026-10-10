var totalNQueens = function (n) {
  const place = (r, cols, d1, d2) => {
    if (r === n) return 1;
    let count = 0;
    for (let c = 0; c < n; c++) {
      const a = 1 << c, b = 1 << (r + c), d = 1 << (r - c + n);
      if (cols & a || d1 & b || d2 & d) continue;
      count += place(r + 1, cols | a, d1 | b, d2 | d);
    }
    return count;
  };
  return place(0, 0, 0, 0);
};
