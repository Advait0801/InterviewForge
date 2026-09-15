class Solution {
    public int longestValidParentheses(String s) {
        Deque<Integer> st = new ArrayDeque<>();
        st.push(-1);
        int best = 0;
        for (int i = 0; i < s.length(); i++) {
            if (s.charAt(i) == '(') { st.push(i); continue; }
            st.pop();
            if (st.isEmpty()) st.push(i);
            else best = Math.max(best, i - st.peek());
        }
        return best;
    }
}
