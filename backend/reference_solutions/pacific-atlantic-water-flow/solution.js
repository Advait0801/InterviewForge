var pacificAtlantic = function (heights) {
  const rows = heights.length, cols = heights[0].length;
  const flood = (starts) => {
    const seen = Array.from({ length: rows }, () => new Array(cols).fill(false));
    const stack = [...starts];
    for (const [r, c] of starts) seen[r][c] = true;
    while (stack.length) {
      const [r, c] = stack.pop();
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !seen[nr][nc] && heights[nr][nc] >= heights[r][c]) {
          seen[nr][nc] = true;
          stack.push([nr, nc]);
        }
      }
    }
    return seen;
  };
  const pac = [], atl = [];
  for (let r = 0; r < rows; r++) { pac.push([r, 0]); atl.push([r, cols - 1]); }
  for (let c = 0; c < cols; c++) { pac.push([0, c]); atl.push([rows - 1, c]); }
  const p = flood(pac), a = flood(atl), out = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (p[r][c] && a[r][c]) out.push([r, c]);
  return out;
};
