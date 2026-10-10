var insert = function (intervals, newInterval) {
  const out = [];
  let [s, e] = newInterval, i = 0;
  while (i < intervals.length && intervals[i][1] < s) out.push(intervals[i++]);
  while (i < intervals.length && intervals[i][0] <= e) {
    s = Math.min(s, intervals[i][0]);
    e = Math.max(e, intervals[i][1]);
    i++;
  }
  out.push([s, e]);
  while (i < intervals.length) out.push(intervals[i++]);
  return out;
};
