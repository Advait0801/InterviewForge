class Solution {
    public int calculate(String s) {
        Deque<long[]> stack = new ArrayDeque<>();
        long total = 0, number = 0;
        int sign = 1;
        for (int i = 0; i < s.length(); i++) {
            char ch = s.charAt(i);
            if (Character.isDigit(ch)) number = number * 10 + (ch - '0');
            else if (ch == '+' || ch == '-') { total += sign * number; number = 0; sign = ch == '+' ? 1 : -1; }
            else if (ch == '(') { stack.push(new long[]{total, sign}); total = 0; sign = 1; }
            else if (ch == ')') {
                total += sign * number;
                long[] saved = stack.pop();
                total = saved[0] + saved[1] * total;
                number = 0;
            }
        }
        return (int) (total + sign * number);
    }
}
