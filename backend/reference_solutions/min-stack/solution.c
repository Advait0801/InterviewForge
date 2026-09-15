typedef struct {
    int* vals;
    int* mins;
    int size;
    int cap;
} MinStack;

MinStack* minStackCreate() {
    MinStack* s = (MinStack*)malloc(sizeof(MinStack));
    s->cap = 16;
    s->size = 0;
    s->vals = (int*)malloc(s->cap * sizeof(int));
    s->mins = (int*)malloc(s->cap * sizeof(int));
    return s;
}

void minStackPush(MinStack* obj, int val) {
    if (obj->size == obj->cap) {
        obj->cap *= 2;
        obj->vals = (int*)realloc(obj->vals, obj->cap * sizeof(int));
        obj->mins = (int*)realloc(obj->mins, obj->cap * sizeof(int));
    }
    obj->vals[obj->size] = val;
    obj->mins[obj->size] = (obj->size && obj->mins[obj->size - 1] < val) ? obj->mins[obj->size - 1] : val;
    obj->size++;
}

void minStackPop(MinStack* obj) {
    obj->size--;
}

int minStackTop(MinStack* obj) {
    return obj->vals[obj->size - 1];
}

int minStackGetMin(MinStack* obj) {
    return obj->mins[obj->size - 1];
}

void minStackFree(MinStack* obj) {
    free(obj->vals);
    free(obj->mins);
    free(obj);
}
