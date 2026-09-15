bool canConstruct(char* ransomNote, char* magazine) {
    int counts[26] = {0};
    for (; *magazine; magazine++) counts[*magazine - 'a']++;
    for (; *ransomNote; ransomNote++) if (--counts[*ransomNote - 'a'] < 0) return false;
    return true;
}
