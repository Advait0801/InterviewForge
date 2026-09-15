/* Keys are bounded (0..10^4), so the recency list is kept in index arrays. */
typedef struct {
    int capacity;
    int size;
    int head;   /* most recently used */
    int tail;   /* least recently used */
    int value[10001];
    int prev[10001];
    int next[10001];
    bool present[10001];
} LRUCache;

static void lruUnlink(LRUCache* c, int k) {
    if (c->prev[k] != -1) c->next[c->prev[k]] = c->next[k]; else c->head = c->next[k];
    if (c->next[k] != -1) c->prev[c->next[k]] = c->prev[k]; else c->tail = c->prev[k];
}

static void lruPushFront(LRUCache* c, int k) {
    c->prev[k] = -1;
    c->next[k] = c->head;
    if (c->head != -1) c->prev[c->head] = k;
    c->head = k;
    if (c->tail == -1) c->tail = k;
}

LRUCache* lRUCacheCreate(int capacity) {
    LRUCache* c = (LRUCache*)calloc(1, sizeof(LRUCache));
    c->capacity = capacity;
    c->head = c->tail = -1;
    return c;
}

int lRUCacheGet(LRUCache* obj, int key) {
    if (!obj->present[key]) return -1;
    lruUnlink(obj, key);
    lruPushFront(obj, key);
    return obj->value[key];
}

void lRUCachePut(LRUCache* obj, int key, int value) {
    if (obj->present[key]) {
        obj->value[key] = value;
        lruUnlink(obj, key);
        lruPushFront(obj, key);
        return;
    }
    if (obj->size == obj->capacity) {
        int evict = obj->tail;
        lruUnlink(obj, evict);
        obj->present[evict] = false;
        obj->size--;
    }
    obj->present[key] = true;
    obj->value[key] = value;
    lruPushFront(obj, key);
    obj->size++;
}

void lRUCacheFree(LRUCache* obj) {
    free(obj);
}
