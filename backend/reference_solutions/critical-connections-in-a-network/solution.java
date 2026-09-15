class Solution {
    private List<Integer>[] graph;
    private int[] disc, low;
    private int timer;
    private List<List<Integer>> out;
    private void dfs(int u, int parent) {
        disc[u] = low[u] = timer++;
        for (int v : graph[u]) {
            if (v == parent) continue;
            if (disc[v] == -1) {
                dfs(v, u);
                low[u] = Math.min(low[u], low[v]);
                if (low[v] > disc[u]) out.add(Arrays.asList(u, v));
            } else {
                low[u] = Math.min(low[u], disc[v]);
            }
        }
    }
    @SuppressWarnings("unchecked")
    public List<List<Integer>> criticalConnections(int n, List<List<Integer>> connections) {
        graph = new List[n];
        for (int i = 0; i < n; i++) graph[i] = new ArrayList<>();
        for (List<Integer> e : connections) { graph[e.get(0)].add(e.get(1)); graph[e.get(1)].add(e.get(0)); }
        disc = new int[n];
        Arrays.fill(disc, -1);
        low = new int[n];
        timer = 0;
        out = new ArrayList<>();
        dfs(0, -1);
        return out;
    }
}
