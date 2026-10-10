var cherryPickup = function (grid) {
  // Two walkers from (0,0) to (n-1,n-1) at once; dp over step and both rows.
  const n = grid.length, NEG = -Infinity;
  let dp = Array.from({ length: n }, () => new Array(n).fill(NEG));
  dp[0][0] = grid[0][0];
  for (let step = 1; step <= 2 * n - 2; step++) {
    const next = Array.from({ length: n }, () => new Array(n).fill(NEG));
    for (let r1 = Math.max(0, step - n + 1); r1 <= Math.min(n - 1, step); r1++)
      for (let r2 = Math.max(0, step - n + 1); r2 <= Math.min(n - 1, step); r2++) {
        const c1 = step - r1, c2 = step - r2;
        if (grid[r1][c1] === -1 || grid[r2][c2] === -1) continue;
        let best = NEG;
        for (const a of [r1, r1 - 1]) for (const b of [r2, r2 - 1]) if (a >= 0 && b >= 0) best = Math.max(best, dp[a][b]);
        if (best === NEG) continue;
        next[r1][r2] = best + grid[r1][c1] + (r1 !== r2 ? grid[r2][c2] : 0);
      }
    dp = next;
  }
  return Math.max(0, dp[n - 1][n - 1]);
};
