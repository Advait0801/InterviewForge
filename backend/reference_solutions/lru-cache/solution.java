class LRUCache {
    private final LinkedHashMap<Integer, Integer> items;

    public LRUCache(int capacity) {
        items = new LinkedHashMap<Integer, Integer>(16, 0.75f, true) {
            @Override
            protected boolean removeEldestEntry(Map.Entry<Integer, Integer> eldest) {
                return size() > capacity;
            }
        };
    }

    public int get(int key) {
        return items.getOrDefault(key, -1);
    }

    public void put(int key, int value) {
        items.put(key, value);
    }
}
