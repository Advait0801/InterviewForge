from collections import OrderedDict, defaultdict

class LFUCache:

    def __init__(self, capacity: int):
        self.capacity = capacity
        self.values = {}
        self.counts = {}
        self.groups = defaultdict(OrderedDict)  # use count -> keys, least recently used first
        self.min_count = 0

    def _use(self, key):
        count = self.counts[key]
        del self.groups[count][key]
        if not self.groups[count]:
            del self.groups[count]
            if self.min_count == count:
                self.min_count = count + 1
        self.counts[key] = count + 1
        self.groups[count + 1][key] = None

    def get(self, key: int) -> int:
        if key not in self.values:
            return -1
        self._use(key)
        return self.values[key]

    def put(self, key: int, value: int) -> None:
        if key in self.values:
            self.values[key] = value
            self._use(key)
            return
        if len(self.values) == self.capacity:
            victim, _ = self.groups[self.min_count].popitem(last=False)
            if not self.groups[self.min_count]:
                del self.groups[self.min_count]
            del self.values[victim]
            del self.counts[victim]
        self.values[key] = value
        self.counts[key] = 1
        self.groups[1][key] = None
        self.min_count = 1
