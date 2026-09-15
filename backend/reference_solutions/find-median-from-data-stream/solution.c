typedef struct {
    int* vals;
    int size;
    int cap;
} MedianFinder;

MedianFinder* medianFinderCreate() {
    MedianFinder* obj = (MedianFinder*)malloc(sizeof(MedianFinder));
    obj->cap = 16;
    obj->size = 0;
    obj->vals = (int*)malloc(sizeof(int) * obj->cap);
    return obj;
}

void medianFinderAddNum(MedianFinder* obj, int num) {
    if (obj->size == obj->cap) { obj->cap *= 2; obj->vals = (int*)realloc(obj->vals, sizeof(int) * obj->cap); }
    int lo = 0, hi = obj->size;  /* insertion point keeping vals sorted */
    while (lo < hi) {
        int mid = (lo + hi) / 2;
        if (obj->vals[mid] <= num) lo = mid + 1; else hi = mid;
    }
    memmove(obj->vals + lo + 1, obj->vals + lo, sizeof(int) * (obj->size - lo));
    obj->vals[lo] = num;
    obj->size++;
}

double medianFinderFindMedian(MedianFinder* obj) {
    int n = obj->size;
    if (n % 2) return obj->vals[n / 2];
    return ((double)obj->vals[n / 2 - 1] + obj->vals[n / 2]) / 2.0;
}

void medianFinderFree(MedianFinder* obj) {
    free(obj->vals);
    free(obj);
}
