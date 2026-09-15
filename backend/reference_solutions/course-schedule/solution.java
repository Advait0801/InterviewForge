class Solution {
    public boolean canFinish(int numCourses, int[][] prerequisites) {
        List<List<Integer>> graph = new ArrayList<>();
        for (int i = 0; i < numCourses; i++) graph.add(new ArrayList<>());
        int[] indegree = new int[numCourses];
        for (int[] e : prerequisites) { graph.get(e[1]).add(e[0]); indegree[e[0]]++; }
        Deque<Integer> q = new ArrayDeque<>();
        for (int i = 0; i < numCourses; i++) if (indegree[i] == 0) q.add(i);
        int taken = 0;
        while (!q.isEmpty()) {
            int node = q.poll(); taken++;
            for (int nxt : graph.get(node)) if (--indegree[nxt] == 0) q.add(nxt);
        }
        return taken == numCourses;
    }
}
