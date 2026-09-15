class Solution {
    public String addBinary(String a, String b) {
        int i = a.length() - 1, j = b.length() - 1, carry = 0;
        StringBuilder out = new StringBuilder();
        while (i >= 0 || j >= 0 || carry != 0) {
            int total = carry;
            if (i >= 0) total += a.charAt(i--) - '0';
            if (j >= 0) total += b.charAt(j--) - '0';
            out.append((char) ('0' + total % 2));
            carry = total / 2;
        }
        return out.reverse().toString();
    }
}
