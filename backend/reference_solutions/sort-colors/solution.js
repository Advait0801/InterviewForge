var sortColors = function (nums) {
  let lo = 0, mid = 0, hi = nums.length - 1;
  while (mid <= hi) {
    if (nums[mid] === 0) [nums[lo++], nums[mid++]] = [nums[mid], nums[lo]];
    else if (nums[mid] === 2) [nums[mid], nums[hi--]] = [nums[hi], nums[mid]];
    else mid++;
  }
};
