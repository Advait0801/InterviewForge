var islandPerimeter = function (grid) {
  let p = 0;
  for (let r = 0; r < grid.length; r++)
    for (let c = 0; c < grid[0].length; c++) {
      if (!grid[r][c]) continue;
      p += 4;
      if (r > 0 && grid[r - 1][c]) p -= 2;
      if (c > 0 && grid[r][c - 1]) p -= 2;
    }
  return p;
};
