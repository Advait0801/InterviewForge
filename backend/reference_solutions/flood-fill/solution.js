var floodFill = function (image, sr, sc, color) {
  const start = image[sr][sc];
  if (start === color) return image;
  const stack = [[sr, sc]];
  image[sr][sc] = color;
  while (stack.length) {
    const [r, c] = stack.pop();
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < image.length && nc >= 0 && nc < image[0].length && image[nr][nc] === start) {
        image[nr][nc] = color;
        stack.push([nr, nc]);
      }
    }
  }
  return image;
};
