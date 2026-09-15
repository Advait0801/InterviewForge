from collections import Counter


class Solution:
    def leastInterval(self, tasks: List[str], n: int) -> int:
        counts = Counter(tasks).values()
        peak = max(counts)
        at_peak = sum(1 for c in counts if c == peak)
        return max(len(tasks), (peak - 1) * (n + 1) + at_peak)
