class Solution {
    static int step(int n) {
        int total = 0;
        while (n) { int d = n % 10; total += d * d; n /= 10; }
        return total;
    }
public:
    bool isHappy(int n) {
        int slow = n, fast = step(n);
        while (fast != 1 && slow != fast) { slow = step(slow); fast = step(step(fast)); }
        return fast == 1;
    }
};
