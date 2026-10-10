var rob = function (nums) {
  let take = 0, skip = 0;
  for (const x of nums) [take, skip] = [skip + x, Math.max(take, skip)];
  return Math.max(take, skip);
};
