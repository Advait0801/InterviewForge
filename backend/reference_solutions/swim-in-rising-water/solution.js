var swimInWater = function (grid) {
  const n = grid.length;
  const reachable = (t) => {
    if (grid[0][0] > t) return false;
    const seen = Array.from({ length: n }, () => new Array(n).fill(false));
    const stack = [[0, 0]];
    seen[0][0] = true;
    while (stack.length) {
      const [r, c] = stack.pop();
      if (r === n - 1 && c === n - 1) return true;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < n && nc >= 0 && nc < n && !seen[nr][nc] && grid[nr][nc] <= t) {
          seen[nr][nc] = true;
          stack.push([nr, nc]);
        }
      }
    }
    return false;
  };
  let lo = 0, hi = n * n;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (reachable(mid)) hi = mid;
    else lo = mid + 1;
  }
  return lo;
};
