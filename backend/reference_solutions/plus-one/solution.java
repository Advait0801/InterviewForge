class Solution {
    public int[] plusOne(int[] digits) {
        int[] out = digits.clone();
        for (int i = out.length - 1; i >= 0; i--) {
            if (out[i] < 9) { out[i]++; return out; }
            out[i] = 0;
        }
        int[] grown = new int[out.length + 1];
        grown[0] = 1;
        return grown;
    }
}
