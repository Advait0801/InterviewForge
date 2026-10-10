var rob = function (nums) {
  if (nums.length === 1) return nums[0];
  const line = (a) => {
    let take = 0, skip = 0;
    for (const x of a) [take, skip] = [skip + x, Math.max(take, skip)];
    return Math.max(take, skip);
  };
  return Math.max(line(nums.slice(1)), line(nums.slice(0, -1)));
};
