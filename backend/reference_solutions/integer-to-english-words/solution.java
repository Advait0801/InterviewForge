class Solution {
    private static final String[] BELOW_20 = {"", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
        "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"};
    private static final String[] TENS = {"", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"};
    private void spell(int n, List<String> words) {
        if (n >= 100) { words.add(BELOW_20[n / 100]); words.add("Hundred"); n %= 100; }
        if (n >= 20) { words.add(TENS[n / 10]); n %= 10; }
        if (n > 0) words.add(BELOW_20[n]);
    }
    public String numberToWords(int num) {
        if (num == 0) return "Zero";
        List<String> words = new ArrayList<>();
        int[] values = {1000000000, 1000000, 1000, 1};
        String[] names = {"Billion", "Million", "Thousand", ""};
        for (int i = 0; i < 4; i++) {
            if (num >= values[i]) {
                spell(num / values[i], words);
                if (!names[i].isEmpty()) words.add(names[i]);
                num %= values[i];
            }
        }
        return String.join(" ", words);
    }
}
