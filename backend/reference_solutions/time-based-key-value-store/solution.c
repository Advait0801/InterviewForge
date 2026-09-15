/* Set timestamps are strictly increasing across all keys, so scanning the log
   backwards finds the latest entry for a key that is not after the query. */
typedef struct {
    char* key;
    char* value;
    int timestamp;
} TimeEntry;

typedef struct {
    TimeEntry* items;
    int size;
    int cap;
} TimeMap;

static char* timeMapCopy(const char* s) {
    size_t len = strlen(s);
    char* out = (char*)malloc(len + 1);
    memcpy(out, s, len + 1);
    return out;
}

TimeMap* timeMapCreate() {
    TimeMap* m = (TimeMap*)malloc(sizeof(TimeMap));
    m->cap = 16;
    m->size = 0;
    m->items = (TimeEntry*)malloc(m->cap * sizeof(TimeEntry));
    return m;
}

void timeMapSet(TimeMap* obj, char* key, char* value, int timestamp) {
    if (obj->size == obj->cap) {
        obj->cap *= 2;
        obj->items = (TimeEntry*)realloc(obj->items, obj->cap * sizeof(TimeEntry));
    }
    obj->items[obj->size].key = timeMapCopy(key);
    obj->items[obj->size].value = timeMapCopy(value);
    obj->items[obj->size].timestamp = timestamp;
    obj->size++;
}

char* timeMapGet(TimeMap* obj, char* key, int timestamp) {
    for (int i = obj->size - 1; i >= 0; i--)
        if (obj->items[i].timestamp <= timestamp && strcmp(obj->items[i].key, key) == 0) return obj->items[i].value;
    return (char*)"";
}

void timeMapFree(TimeMap* obj) {
    for (int i = 0; i < obj->size; i++) { free(obj->items[i].key); free(obj->items[i].value); }
    free(obj->items);
    free(obj);
}
