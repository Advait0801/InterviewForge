var eraseOverlapIntervals = function (intervals) {
  const sorted = [...intervals].sort((a, b) => a[1] - b[1]);
  let removed = 0, end = -Infinity;
  for (const [s, e] of sorted) {
    if (s >= end) end = e;
    else removed++;
  }
  return removed;
};
