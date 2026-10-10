var combinationSum = function (candidates, target) {
  const out = [], cur = [];
  const sorted = [...candidates].sort((a, b) => a - b);
  const dfs = (start, remaining) => {
    if (remaining === 0) return out.push([...cur]);
    for (let i = start; i < sorted.length && sorted[i] <= remaining; i++) {
      cur.push(sorted[i]);
      dfs(i, remaining - sorted[i]);
      cur.pop();
    }
  };
  dfs(0, target);
  return out;
};
