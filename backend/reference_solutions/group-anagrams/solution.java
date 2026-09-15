class Solution {
    public List<List<String>> groupAnagrams(String[] strs) {
        Map<String, List<String>> groups = new LinkedHashMap<>();
        for (String w : strs) {
            char[] key = w.toCharArray();
            Arrays.sort(key);
            groups.computeIfAbsent(new String(key), x -> new ArrayList<>()).add(w);
        }
        return new ArrayList<>(groups.values());
    }
}
