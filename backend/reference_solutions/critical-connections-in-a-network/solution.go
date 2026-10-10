func criticalConnections(n int, connections [][]int) [][]int {
	adj := make([][]int, n)
	for _, e := range connections {
		adj[e[0]] = append(adj[e[0]], e[1])
		adj[e[1]] = append(adj[e[1]], e[0])
	}
	disc, low := make([]int, n), make([]int, n)
	for i := range disc {
		disc[i] = -1
	}
	out := [][]int{}
	time := 0
	var dfs func(u, parent int)
	dfs = func(u, parent int) {
		disc[u], low[u] = time, time
		time++
		for _, v := range adj[u] {
			if v == parent {
				continue
			}
			if disc[v] == -1 {
				dfs(v, u)
				low[u] = min(low[u], low[v])
				if low[v] > disc[u] {
					out = append(out, []int{u, v})
				}
			} else {
				low[u] = min(low[u], disc[v])
			}
		}
	}
	for s := 0; s < n; s++ {
		if disc[s] == -1 {
			dfs(s, -1)
		}
	}
	return out
}
