var canFinish = function (numCourses, prerequisites) {
  const adj = Array.from({ length: numCourses }, () => []);
  const indeg = new Array(numCourses).fill(0);
  for (const [a, b] of prerequisites) { adj[b].push(a); indeg[a]++; }
  const queue = [];
  for (let i = 0; i < numCourses; i++) if (indeg[i] === 0) queue.push(i);
  let done = 0;
  while (queue.length) {
    const u = queue.pop();
    done++;
    for (const v of adj[u]) if (--indeg[v] === 0) queue.push(v);
  }
  return done === numCourses;
};
