class Solution {
    vector<vector<int>> graph, out;
    vector<int> disc, low;
    int timer = 0;
    void dfs(int u, int parent) {
        disc[u] = low[u] = timer++;
        for (int v : graph[u]) {
            if (v == parent) continue;
            if (disc[v] == -1) {
                dfs(v, u);
                low[u] = min(low[u], low[v]);
                if (low[v] > disc[u]) out.push_back({u, v});
            } else {
                low[u] = min(low[u], disc[v]);
            }
        }
    }
public:
    vector<vector<int>> criticalConnections(int n, vector<vector<int>>& connections) {
        graph.assign(n, {});
        out.clear();
        disc.assign(n, -1);
        low.assign(n, 0);
        timer = 0;
        for (auto& e : connections) { graph[e[0]].push_back(e[1]); graph[e[1]].push_back(e[0]); }
        dfs(0, -1);
        return out;
    }
};
