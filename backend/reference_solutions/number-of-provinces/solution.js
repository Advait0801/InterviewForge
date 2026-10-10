var findCircleNum = function (isConnected) {
  const n = isConnected.length, parent = [...Array(n).keys()];
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  let groups = n;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      if (!isConnected[i][j]) continue;
      const a = find(i), b = find(j);
      if (a !== b) { parent[a] = b; groups--; }
    }
  return groups;
};
