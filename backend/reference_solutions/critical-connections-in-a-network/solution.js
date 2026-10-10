var criticalConnections = function (n, connections) {
  const adj = Array.from({ length: n }, () => []);
  for (const [a, b] of connections) { adj[a].push(b); adj[b].push(a); }
  const disc = new Array(n).fill(-1), low = new Array(n).fill(0), out = [];
  let time = 0;
  // Iterative DFS: recursion depth would reach n.
  for (let s = 0; s < n; s++) {
    if (disc[s] !== -1) continue;
    const stack = [[s, -1, 0]];
    disc[s] = low[s] = time++;
    while (stack.length) {
      const top = stack[stack.length - 1];
      const [u, parent] = top;
      if (top[2] < adj[u].length) {
        const v = adj[u][top[2]++];
        if (v === parent) continue;
        if (disc[v] === -1) {
          disc[v] = low[v] = time++;
          stack.push([v, u, 0]);
        } else low[u] = Math.min(low[u], disc[v]);
      } else {
        stack.pop();
        if (parent !== -1) {
          low[parent] = Math.min(low[parent], low[u]);
          if (low[u] > disc[parent]) out.push([parent, u]);
        }
      }
    }
  }
  return out;
};
