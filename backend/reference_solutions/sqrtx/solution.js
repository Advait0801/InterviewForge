var mySqrt = function (x) {
  let lo = 0, hi = x;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    if (mid * mid <= x) lo = mid;
    else hi = mid - 1;
  }
  return lo;
};
