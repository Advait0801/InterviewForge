var numIslands = function (grid) {
  const rows = grid.length, cols = rows ? grid[0].length : 0;
  let count = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] !== "1") continue;
      count++;
      const stack = [[r, c]];
      grid[r][c] = "0";
      while (stack.length) {
        const [y, x] = stack.pop();
        for (const [dy, dx] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ny = y + dy, nx = x + dx;
          if (ny >= 0 && ny < rows && nx >= 0 && nx < cols && grid[ny][nx] === "1") {
            grid[ny][nx] = "0";
            stack.push([ny, nx]);
          }
        }
      }
    }
  }
  return count;
};
