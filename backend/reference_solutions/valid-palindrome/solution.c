#include <ctype.h>

bool isPalindrome(char* s) {
    int i = 0, j = (int)strlen(s) - 1;
    while (i < j) {
        while (i < j && !isalnum((unsigned char)s[i])) i++;
        while (i < j && !isalnum((unsigned char)s[j])) j--;
        if (tolower((unsigned char)s[i]) != tolower((unsigned char)s[j])) return false;
        i++; j--;
    }
    return true;
}
