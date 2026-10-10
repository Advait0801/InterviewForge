var maximalRectangle = function (matrix) {
  if (!matrix.length) return 0;
  const cols = matrix[0].length, h = new Array(cols).fill(0);
  let best = 0;
  for (const row of matrix) {
    for (let c = 0; c < cols; c++) h[c] = row[c] === "1" ? h[c] + 1 : 0;
    const stack = [];
    for (let i = 0; i <= cols; i++) {
      const cur = i === cols ? 0 : h[i];
      while (stack.length && h[stack[stack.length - 1]] >= cur) {
        const height = h[stack.pop()];
        const left = stack.length ? stack[stack.length - 1] + 1 : 0;
        best = Math.max(best, height * (i - left));
      }
      stack.push(i);
    }
  }
  return best;
};
