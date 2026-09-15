char** fizzBuzz(int n, int* returnSize) {
    char** out = (char**)malloc(n * sizeof(char*));
    for (int i = 1; i <= n; i++) {
        char* s = (char*)malloc(12);
        if (i % 15 == 0) strcpy(s, "FizzBuzz");
        else if (i % 3 == 0) strcpy(s, "Fizz");
        else if (i % 5 == 0) strcpy(s, "Buzz");
        else sprintf(s, "%d", i);
        out[i - 1] = s;
    }
    *returnSize = n;
    return out;
}
