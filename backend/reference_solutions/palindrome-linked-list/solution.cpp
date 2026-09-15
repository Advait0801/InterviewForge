class Solution {
public:
    bool isPalindrome(ListNode* head) {
        ListNode* slow = head, *fast = head, *prev = nullptr;
        while (fast && fast->next) { slow = slow->next; fast = fast->next->next; }
        while (slow) { ListNode* next = slow->next; slow->next = prev; prev = slow; slow = next; }
        for (; prev; prev = prev->next, head = head->next) if (prev->val != head->val) return false;
        return true;
    }
};
