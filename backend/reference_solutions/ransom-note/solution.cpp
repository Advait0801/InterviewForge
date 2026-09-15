class Solution {
public:
    bool canConstruct(string ransomNote, string magazine) {
        int counts[26] = {0};
        for (char ch : magazine) counts[ch - 'a']++;
        for (char ch : ransomNote) if (--counts[ch - 'a'] < 0) return false;
        return true;
    }
};
