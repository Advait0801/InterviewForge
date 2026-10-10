var maxPoints = function (points) {
  const gcd = (a, b) => (b === 0 ? Math.abs(a) : gcd(b, a % b));
  let best = Math.min(points.length, 1);
  for (let i = 0; i < points.length; i++) {
    const slopes = new Map();
    for (let j = i + 1; j < points.length; j++) {
      let dx = points[j][0] - points[i][0], dy = points[j][1] - points[i][1];
      const g = gcd(dx, dy);
      dx /= g; dy /= g;
      if (dx < 0 || (dx === 0 && dy < 0)) { dx = -dx; dy = -dy; }
      const key = `${dx}/${dy}`;
      slopes.set(key, (slopes.get(key) || 1) + 1);
      best = Math.max(best, slopes.get(key));
    }
  }
  return best;
};
