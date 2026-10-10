var minRefuelStops = function (target, startFuel, stations) {
  // dp[i]: farthest reach with i stops.
  const dp = new Array(stations.length + 1).fill(0);
  dp[0] = startFuel;
  stations.forEach(([pos, fuel], i) => {
    for (let t = i; t >= 0; t--) if (dp[t] >= pos) dp[t + 1] = Math.max(dp[t + 1], dp[t] + fuel);
  });
  for (let i = 0; i < dp.length; i++) if (dp[i] >= target) return i;
  return -1;
};
