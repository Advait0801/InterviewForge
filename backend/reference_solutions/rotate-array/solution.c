static void reverseRange(int* a, int i, int j) {
    while (i < j) { int t = a[i]; a[i++] = a[j]; a[j--] = t; }
}
void rotate(int* nums, int numsSize, int k) {
    k %= numsSize;
    reverseRange(nums, 0, numsSize - 1);
    reverseRange(nums, 0, k - 1);
    reverseRange(nums, k, numsSize - 1);
}
