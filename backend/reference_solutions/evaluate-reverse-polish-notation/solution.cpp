class Solution {
public:
    int evalRPN(vector<string>& tokens) {
        vector<long long> stack;
        for (const string& t : tokens) {
            if (t.size() == 1 && string("+-*/").find(t[0]) != string::npos) {
                long long b = stack.back(); stack.pop_back();
                long long a = stack.back(); stack.pop_back();
                if (t[0] == '+') a += b;
                else if (t[0] == '-') a -= b;
                else if (t[0] == '*') a *= b;
                else a /= b;
                stack.push_back(a);
            } else {
                stack.push_back(stoll(t));
            }
        }
        return (int)stack.back();
    }
};
