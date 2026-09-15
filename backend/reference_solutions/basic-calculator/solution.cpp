class Solution {
public:
    int calculate(string s) {
        vector<pair<long long, int>> stack;
        long long total = 0, number = 0;
        int sign = 1;
        for (char ch : s) {
            if (isdigit(ch)) number = number * 10 + (ch - '0');
            else if (ch == '+' || ch == '-') { total += sign * number; number = 0; sign = ch == '+' ? 1 : -1; }
            else if (ch == '(') { stack.push_back({total, sign}); total = 0; sign = 1; }
            else if (ch == ')') {
                total += sign * number;
                auto [savedTotal, savedSign] = stack.back();
                stack.pop_back();
                total = savedTotal + savedSign * total;
                number = 0;
            }
        }
        return (int)(total + sign * number);
    }
};
