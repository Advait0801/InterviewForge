class Solution:
    def findCircleNum(self, isConnected: List[List[int]]) -> int:
        n = len(isConnected)
        parent = list(range(n))
        def find(x):
            while parent[x] != x:
                parent[x] = parent[parent[x]]
                x = parent[x]
            return x
        provinces = n
        for i in range(n):
            for j in range(i + 1, n):
                if isConnected[i][j]:
                    a, b = find(i), find(j)
                    if a != b:
                        parent[a] = b
                        provinces -= 1
        return provinces
