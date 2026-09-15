void sortColors(int* nums, int numsSize) {
    int lo = 0, mid = 0, hi = numsSize - 1;
    while (mid <= hi) {
        if (nums[mid] == 0) { int t = nums[lo]; nums[lo++] = nums[mid]; nums[mid++] = t; }
        else if (nums[mid] == 2) { int t = nums[hi]; nums[hi--] = nums[mid]; nums[mid] = t; }
        else mid++;
    }
}
