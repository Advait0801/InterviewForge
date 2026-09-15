static int digitSquareSum(int n) {
    int total = 0;
    while (n) { int d = n % 10; total += d * d; n /= 10; }
    return total;
}
bool isHappy(int n) {
    int slow = n, fast = digitSquareSum(n);
    while (fast != 1 && slow != fast) { slow = digitSquareSum(slow); fast = digitSquareSum(digitSquareSum(fast)); }
    return fast == 1;
}
