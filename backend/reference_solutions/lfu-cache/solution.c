/* Keys are bounded (0..10^5), so per-key state lives in arrays. Eviction scans the
   stored keys for the lowest (use count, last use) pair. */
typedef struct {
    int capacity;
    int size;
    int tick;
    int* value;
    int* count;
    int* lastUsed;
    bool* present;
    int* keys;
} LFUCache;

LFUCache* lFUCacheCreate(int capacity) {
    LFUCache* c = (LFUCache*)malloc(sizeof(LFUCache));
    c->capacity = capacity;
    c->size = 0;
    c->tick = 0;
    c->value = (int*)calloc(100001, sizeof(int));
    c->count = (int*)calloc(100001, sizeof(int));
    c->lastUsed = (int*)calloc(100001, sizeof(int));
    c->present = (bool*)calloc(100001, sizeof(bool));
    c->keys = (int*)malloc(capacity * sizeof(int));
    return c;
}

int lFUCacheGet(LFUCache* obj, int key) {
    if (!obj->present[key]) return -1;
    obj->count[key]++;
    obj->lastUsed[key] = ++obj->tick;
    return obj->value[key];
}

void lFUCachePut(LFUCache* obj, int key, int value) {
    if (obj->present[key]) {
        obj->value[key] = value;
        obj->count[key]++;
        obj->lastUsed[key] = ++obj->tick;
        return;
    }
    if (obj->size == obj->capacity) {
        int victim = 0;
        for (int i = 1; i < obj->size; i++) {
            int a = obj->keys[i], b = obj->keys[victim];
            if (obj->count[a] < obj->count[b] || (obj->count[a] == obj->count[b] && obj->lastUsed[a] < obj->lastUsed[b])) victim = i;
        }
        obj->present[obj->keys[victim]] = false;
        obj->keys[victim] = obj->keys[--obj->size];
    }
    obj->present[key] = true;
    obj->value[key] = value;
    obj->count[key] = 1;
    obj->lastUsed[key] = ++obj->tick;
    obj->keys[obj->size++] = key;
}

void lFUCacheFree(LFUCache* obj) {
    free(obj->value);
    free(obj->count);
    free(obj->lastUsed);
    free(obj->present);
    free(obj->keys);
    free(obj);
}
