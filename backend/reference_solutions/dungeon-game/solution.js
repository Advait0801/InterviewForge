var calculateMinimumHP = function (dungeon) {
  const rows = dungeon.length, cols = dungeon[0].length;
  const need = new Array(cols + 1).fill(Infinity);
  need[cols - 1] = 1;
  for (let r = rows - 1; r >= 0; r--) {
    const next = new Array(cols + 1).fill(Infinity);
    for (let c = cols - 1; c >= 0; c--) {
      const after = Math.min(need[c], next[c + 1]);
      next[c] = Math.max(1, after - dungeon[r][c]);
    }
    need.splice(0, cols + 1, ...next);
  }
  return need[0];
};
