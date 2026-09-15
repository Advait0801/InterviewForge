bool canFinish(int numCourses, int** prerequisites, int prerequisitesSize, int* prerequisitesColSize) {
    int* indegree = (int*)calloc(numCourses, sizeof(int));
    int* start = (int*)calloc(numCourses + 1, sizeof(int));
    int* edges = (int*)malloc(sizeof(int) * (prerequisitesSize + 1));
    for (int i = 0; i < prerequisitesSize; i++) { start[prerequisites[i][1] + 1]++; indegree[prerequisites[i][0]]++; }
    for (int i = 0; i < numCourses; i++) start[i + 1] += start[i];
    int* fill = (int*)malloc(sizeof(int) * (numCourses + 1));
    memcpy(fill, start, sizeof(int) * (numCourses + 1));
    for (int i = 0; i < prerequisitesSize; i++) edges[fill[prerequisites[i][1]]++] = prerequisites[i][0];

    int* queue = (int*)malloc(sizeof(int) * (numCourses + 1));
    int head = 0, tail = 0, taken = 0;
    for (int i = 0; i < numCourses; i++) if (indegree[i] == 0) queue[tail++] = i;
    while (head < tail) {
        int node = queue[head++];
        taken++;
        for (int e = start[node]; e < start[node + 1]; e++)
            if (--indegree[edges[e]] == 0) queue[tail++] = edges[e];
    }
    free(indegree); free(start); free(edges); free(fill); free(queue);
    return taken == numCourses;
}
