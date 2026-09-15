class Solution {
    public List<String> letterCombinations(String digits) {
        List<String> out = new ArrayList<>();
        if (digits.isEmpty()) return out;
        String[] keys = {"", "", "abc", "def", "ghi", "jkl", "mno", "pqrs", "tuv", "wxyz"};
        out.add("");
        for (char d : digits.toCharArray()) {
            List<String> next = new ArrayList<>();
            for (String prefix : out)
                for (char ch : keys[d - '0'].toCharArray()) next.add(prefix + ch);
            out = next;
        }
        return out;
    }
}
