var jobScheduling = function (startTime, endTime, profit) {
  const jobs = startTime.map((s, i) => [s, endTime[i], profit[i]]).sort((a, b) => a[1] - b[1]);
  const ends = [0], best = [0];
  for (const [s, e, p] of jobs) {
    // Last finished job ending at or before s.
    let lo = 0, hi = ends.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (ends[mid] <= s) lo = mid;
      else hi = mid - 1;
    }
    const take = best[lo] + p;
    if (take > best[best.length - 1]) {
      ends.push(e);
      best.push(take);
    }
  }
  return best[best.length - 1];
};
