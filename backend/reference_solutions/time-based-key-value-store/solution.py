import bisect
from collections import defaultdict

class TimeMap:

    def __init__(self):
        self.times = defaultdict(list)
        self.values = defaultdict(list)

    def set(self, key: str, value: str, timestamp: int) -> None:
        self.times[key].append(timestamp)
        self.values[key].append(value)

    def get(self, key: str, timestamp: int) -> str:
        i = bisect.bisect_right(self.times.get(key, []), timestamp)
        return self.values[key][i - 1] if i else ""
