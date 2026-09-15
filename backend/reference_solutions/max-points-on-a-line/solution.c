typedef struct { int dx, dy; } Direction;
static int directionCmp(const void* a, const void* b) {
    const Direction* p = (const Direction*)a, *q = (const Direction*)b;
    if (p->dx != q->dx) return p->dx < q->dx ? -1 : 1;
    return (p->dy > q->dy) - (p->dy < q->dy);
}
static int gcdAbs(int a, int b) {
    if (a < 0) a = -a;
    if (b < 0) b = -b;
    while (b) { int t = a % b; a = b; b = t; }
    return a;
}
int maxPoints(int** points, int pointsSize, int* pointsColSize) {
    if (pointsSize <= 2) return pointsSize;
    Direction* dirs = (Direction*)malloc(pointsSize * sizeof(Direction));
    int best = 1;
    for (int i = 0; i < pointsSize; i++) {
        int k = 0;
        for (int j = i + 1; j < pointsSize; j++) {
            int dx = points[j][0] - points[i][0], dy = points[j][1] - points[i][1];
            int g = gcdAbs(dx, dy);
            dx /= g;
            dy /= g;
            if (dx < 0 || (dx == 0 && dy < 0)) { dx = -dx; dy = -dy; }
            dirs[k].dx = dx;
            dirs[k].dy = dy;
            k++;
        }
        qsort(dirs, k, sizeof(Direction), directionCmp);
        for (int a = 0, b; a < k; a = b) {
            for (b = a; b < k && dirs[b].dx == dirs[a].dx && dirs[b].dy == dirs[a].dy; b++) ;
            if (b - a + 1 > best) best = b - a + 1;
        }
    }
    free(dirs);
    return best;
}
