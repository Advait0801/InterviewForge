class Solution {
public:
    string addBinary(string a, string b) {
        int i = (int)a.size() - 1, j = (int)b.size() - 1, carry = 0;
        string out;
        while (i >= 0 || j >= 0 || carry) {
            int total = carry;
            if (i >= 0) total += a[i--] - '0';
            if (j >= 0) total += b[j--] - '0';
            out.push_back((char)('0' + total % 2));
            carry = total / 2;
        }
        reverse(out.begin(), out.end());
        return out;
    }
};
