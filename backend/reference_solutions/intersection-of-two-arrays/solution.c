int* intersection(int* nums1, int nums1Size, int* nums2, int nums2Size, int* returnSize) {
    bool present[1001] = {false};
    for (int i = 0; i < nums1Size; i++) present[nums1[i]] = true;
    int* out = (int*)malloc((nums2Size + 1) * sizeof(int));
    int k = 0;
    for (int i = 0; i < nums2Size; i++) {
        if (present[nums2[i]]) { present[nums2[i]] = false; out[k++] = nums2[i]; }
    }
    *returnSize = k;
    return out;
}
