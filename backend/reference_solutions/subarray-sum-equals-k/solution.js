var subarraySum = function (nums, k) {
  const prefix = new Map([[0, 1]]);
  let sum = 0, count = 0;
  for (const x of nums) {
    sum += x;
    count += prefix.get(sum - k) || 0;
    prefix.set(sum, (prefix.get(sum) || 0) + 1);
  }
  return count;
};
