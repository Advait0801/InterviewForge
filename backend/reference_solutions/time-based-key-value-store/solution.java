class TimeMap {
    private final Map<String, TreeMap<Integer, String>> history = new HashMap<>();

    public TimeMap() {}

    public void set(String key, String value, int timestamp) {
        history.computeIfAbsent(key, k -> new TreeMap<>()).put(timestamp, value);
    }

    public String get(String key, int timestamp) {
        TreeMap<Integer, String> entries = history.get(key);
        if (entries == null) return "";
        Map.Entry<Integer, String> entry = entries.floorEntry(timestamp);
        return entry == null ? "" : entry.getValue();
    }
}
