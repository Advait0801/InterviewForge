var countDigitOne = function (n) {
  let count = 0;
  for (let f = 1; f <= n; f *= 10) {
    const higher = Math.floor(n / (f * 10)), cur = Math.floor(n / f) % 10, lower = n % f;
    if (cur === 0) count += higher * f;
    else if (cur === 1) count += higher * f + lower + 1;
    else count += (higher + 1) * f;
  }
  return count;
};
