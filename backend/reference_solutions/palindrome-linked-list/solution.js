var isPalindrome = function (head) {
  const vals = [];
  for (; head; head = head.next) vals.push(head.val);
  for (let i = 0, j = vals.length - 1; i < j; i++, j--) if (vals[i] !== vals[j]) return false;
  return true;
};
