int leastInterval(char* tasks, int tasksSize, int n) {
    int counts[26] = {0};
    for (int i = 0; i < tasksSize; i++) counts[tasks[i] - 'A']++;
    int peak = 0, atPeak = 0;
    for (int i = 0; i < 26; i++) if (counts[i] > peak) peak = counts[i];
    for (int i = 0; i < 26; i++) if (counts[i] == peak) atPeak++;
    int slots = (peak - 1) * (n + 1) + atPeak;
    return slots > tasksSize ? slots : tasksSize;
}
