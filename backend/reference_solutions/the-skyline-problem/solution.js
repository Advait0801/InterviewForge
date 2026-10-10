var getSkyline = function (buildings) {
  const xs = [...new Set(buildings.flatMap(([l, r]) => [l, r]))].sort((a, b) => a - b);
  const out = [];
  let prev = 0;
  for (const x of xs) {
    let h = 0;
    for (const [l, r, height] of buildings) if (l <= x && x < r) h = Math.max(h, height);
    if (h !== prev) { out.push([x, h]); prev = h; }
  }
  return out;
};
