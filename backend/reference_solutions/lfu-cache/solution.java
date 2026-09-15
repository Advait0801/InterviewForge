class LFUCache {
    private final int capacity;
    private int minCount = 0;
    private final Map<Integer, Integer> values = new HashMap<>();
    private final Map<Integer, Integer> counts = new HashMap<>();
    private final Map<Integer, LinkedHashSet<Integer>> groups = new HashMap<>();  // use count -> keys, oldest first

    public LFUCache(int capacity) {
        this.capacity = capacity;
    }

    private void use(int key) {
        int count = counts.get(key);
        LinkedHashSet<Integer> group = groups.get(count);
        group.remove(key);
        if (group.isEmpty()) {
            groups.remove(count);
            if (minCount == count) minCount++;
        }
        counts.put(key, count + 1);
        groups.computeIfAbsent(count + 1, k -> new LinkedHashSet<>()).add(key);
    }

    public int get(int key) {
        if (!values.containsKey(key)) return -1;
        use(key);
        return values.get(key);
    }

    public void put(int key, int value) {
        if (values.containsKey(key)) {
            values.put(key, value);
            use(key);
            return;
        }
        if (values.size() == capacity) {
            LinkedHashSet<Integer> group = groups.get(minCount);
            int victim = group.iterator().next();
            group.remove(victim);
            if (group.isEmpty()) groups.remove(minCount);
            values.remove(victim);
            counts.remove(victim);
        }
        values.put(key, value);
        counts.put(key, 1);
        groups.computeIfAbsent(1, k -> new LinkedHashSet<>()).add(key);
        minCount = 1;
    }
}
