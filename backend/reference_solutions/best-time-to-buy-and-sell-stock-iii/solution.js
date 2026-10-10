var maxProfit = function (prices) {
  let b1 = -Infinity, s1 = 0, b2 = -Infinity, s2 = 0;
  for (const p of prices) {
    b1 = Math.max(b1, -p);
    s1 = Math.max(s1, b1 + p);
    b2 = Math.max(b2, s1 - p);
    s2 = Math.max(s2, b2 + p);
  }
  return s2;
};
