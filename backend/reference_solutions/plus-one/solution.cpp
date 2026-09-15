class Solution {
public:
    vector<int> plusOne(vector<int>& digits) {
        vector<int> out(digits);
        for (int i = (int)out.size() - 1; i >= 0; i--) {
            if (out[i] < 9) { out[i]++; return out; }
            out[i] = 0;
        }
        out.insert(out.begin(), 1);
        return out;
    }
};
