int maxProduct(int* nums, int numsSize) {
    long long hi = nums[0], lo = nums[0], best = nums[0];
    for (int i = 1; i < numsSize; i++) {
        long long v = nums[i], a = hi * v, b = lo * v;
        hi = v; if (a > hi) hi = a; if (b > hi) hi = b;
        lo = v; if (a < lo) lo = a; if (b < lo) lo = b;
        if (hi > best) best = hi;
    }
    return (int)best;
}
