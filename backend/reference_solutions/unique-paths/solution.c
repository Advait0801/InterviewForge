int uniquePaths(int m, int n) {
    long long* row = (long long*)malloc(n * sizeof(long long));
    for (int c = 0; c < n; c++) row[c] = 1;
    for (int r = 1; r < m; r++)
        for (int c = 1; c < n; c++) row[c] += row[c - 1];
    int answer = (int)row[n - 1];
    free(row);
    return answer;
}
