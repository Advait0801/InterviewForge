var splitArray = function (nums, k) {
  let lo = Math.max(...nums), hi = nums.reduce((a, b) => a + b, 0);
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    let parts = 1, sum = 0;
    for (const x of nums) {
      if (sum + x > mid) { parts++; sum = 0; }
      sum += x;
    }
    if (parts <= k) hi = mid;
    else lo = mid + 1;
  }
  return lo;
};
