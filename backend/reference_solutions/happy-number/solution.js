var isHappy = function (n) {
  const seen = new Set();
  while (n !== 1 && !seen.has(n)) {
    seen.add(n);
    n = [...String(n)].reduce((s, d) => s + d * d, 0);
  }
  return n === 1;
};
