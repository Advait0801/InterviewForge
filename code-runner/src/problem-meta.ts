export interface ParamMeta {
  name: string;
  type: string;
}

export interface MethodMeta {
  name: string;
  params: ParamMeta[];
  returnType: string;
}

export interface ProblemMeta {
  className: string;
  methodName?: string;
  isDesign?: boolean;
  params?: ParamMeta[];
  returnType?: string;
  methods?: MethodMeta[];
  constructorParams?: ParamMeta[];
  // C has no objects: LeetCode's C Codec is plain serialize/deserialize
  // functions rather than codecCreate/codecSerialize(obj, ...).
  cFreeFunctions?: boolean;
  unorderedOutput?: boolean;
  // Also ignore element order *inside* each item of an unordered result. Only
  // for problems where that order carries no meaning (a 3sum triplet, an
  // anagram group). Off by default: for n-queens the order of rows IS the board.
  unorderedInner?: boolean;
}

export const PROBLEM_META: Record<string, ProblemMeta> = {
  "two-sum": {
    className: "Solution",
    methodName: "twoSum",
    params: [{ name: "nums", type: "int[]" }, { name: "target", type: "int" }],
    returnType: "int[]",
    unorderedOutput: true,
  },
  "reverse-string": {
    className: "Solution",
    methodName: "reverseString",
    params: [{ name: "s", type: "char[]" }],
    returnType: "void",
  },
  "valid-parentheses": {
    className: "Solution",
    methodName: "isValid",
    params: [{ name: "s", type: "string" }],
    returnType: "bool",
  },
  "best-time-to-buy-and-sell-stock": {
    className: "Solution",
    methodName: "maxProfit",
    params: [{ name: "prices", type: "int[]" }],
    returnType: "int",
  },
  "merge-two-sorted-lists": {
    className: "Solution",
    methodName: "mergeTwoLists",
    params: [{ name: "list1", type: "ListNode" }, { name: "list2", type: "ListNode" }],
    returnType: "ListNode",
  },
  "missing-number": {
    className: "Solution",
    methodName: "missingNumber",
    params: [{ name: "nums", type: "int[]" }],
    returnType: "int",
  },
  "longest-substring-without-repeating-characters": {
    className: "Solution",
    methodName: "lengthOfLongestSubstring",
    params: [{ name: "s", type: "string" }],
    returnType: "int",
  },
  "3sum": {
    className: "Solution",
    methodName: "threeSum",
    params: [{ name: "nums", type: "int[]" }],
    returnType: "int[][]",
    unorderedOutput: true,
    unorderedInner: true,
  },
  "product-of-array-except-self": {
    className: "Solution",
    methodName: "productExceptSelf",
    params: [{ name: "nums", type: "int[]" }],
    returnType: "int[]",
  },
  "number-of-islands": {
    className: "Solution",
    methodName: "numIslands",
    params: [{ name: "grid", type: "char[][]" }],
    returnType: "int",
  },
  "course-schedule": {
    className: "Solution",
    methodName: "canFinish",
    params: [{ name: "numCourses", type: "int" }, { name: "prerequisites", type: "int[][]" }],
    returnType: "bool",
  },
  "coin-change": {
    className: "Solution",
    methodName: "coinChange",
    params: [{ name: "coins", type: "int[]" }, { name: "amount", type: "int" }],
    returnType: "int",
  },
  "top-k-frequent-elements": {
    className: "Solution",
    methodName: "topKFrequent",
    params: [{ name: "nums", type: "int[]" }, { name: "k", type: "int" }],
    returnType: "int[]",
    unorderedOutput: true,
  },
  "lowest-common-ancestor-of-a-binary-search-tree": {
    className: "Solution",
    methodName: "lowestCommonAncestor",
    params: [{ name: "root", type: "TreeNode" }, { name: "p", type: "int" }, { name: "q", type: "int" }],
    returnType: "int",
  },
  "implement-trie-prefix-tree": {
    className: "Trie",
    isDesign: true,
    methods: [
      { name: "insert", params: [{ name: "word", type: "string" }], returnType: "void" },
      { name: "search", params: [{ name: "word", type: "string" }], returnType: "bool" },
      { name: "startsWith", params: [{ name: "prefix", type: "string" }], returnType: "bool" },
    ],
  },
  "task-scheduler": {
    className: "Solution",
    methodName: "leastInterval",
    params: [{ name: "tasks", type: "char[]" }, { name: "n", type: "int" }],
    returnType: "int",
  },
  "trapping-rain-water": {
    className: "Solution",
    methodName: "trap",
    params: [{ name: "height", type: "int[]" }],
    returnType: "int",
  },
  "merge-k-sorted-lists": {
    className: "Solution",
    methodName: "mergeKLists",
    params: [{ name: "lists", type: "ListNode[]" }],
    returnType: "ListNode",
  },
  "word-search-ii": {
    className: "Solution",
    methodName: "findWords",
    params: [{ name: "board", type: "char[][]" }, { name: "words", type: "string[]" }],
    returnType: "string[]",
    unorderedOutput: true,
  },
  "median-of-two-sorted-arrays": {
    className: "Solution",
    methodName: "findMedianSortedArrays",
    params: [{ name: "nums1", type: "int[]" }, { name: "nums2", type: "int[]" }],
    returnType: "double",
  },
  "serialize-and-deserialize-binary-tree": {
    className: "Codec",
    isDesign: true,
    cFreeFunctions: true,
    methods: [
      { name: "serialize", params: [{ name: "root", type: "TreeNode" }], returnType: "string" },
      { name: "deserialize", params: [{ name: "data", type: "string" }], returnType: "TreeNode" },
    ],
  },
  "find-median-from-data-stream": {
    className: "MedianFinder",
    isDesign: true,
    methods: [
      { name: "addNum", params: [{ name: "num", type: "int" }], returnType: "void" },
      { name: "findMedian", params: [], returnType: "double" },
    ],
  },
  "contains-duplicate": {
    className: "Solution",
    methodName: "containsDuplicate",
    params: [{ name: "nums", type: "int[]" }],
    returnType: "bool",
  },
  "valid-palindrome": {
    className: "Solution",
    methodName: "isPalindrome",
    params: [{ name: "s", type: "string" }],
    returnType: "bool",
  },
  "maximum-subarray": {
    className: "Solution",
    methodName: "maxSubArray",
    params: [{ name: "nums", type: "int[]" }],
    returnType: "int",
  },
  "climbing-stairs": {
    className: "Solution",
    methodName: "climbStairs",
    params: [{ name: "n", type: "int" }],
    returnType: "int",
  },
  "linked-list-cycle": {
    className: "Solution",
    methodName: "hasCycle",
    params: [
      { name: "head", type: "int[]" },
      { name: "pos", type: "int" },
    ],
    returnType: "bool",
  },
  "invert-binary-tree": {
    className: "Solution",
    methodName: "invertTree",
    params: [{ name: "root", type: "TreeNode" }],
    returnType: "TreeNode",
  },
  "container-with-most-water": {
    className: "Solution",
    methodName: "maxArea",
    params: [{ name: "height", type: "int[]" }],
    returnType: "int",
  },
  "search-in-rotated-sorted-array": {
    className: "Solution",
    methodName: "search",
    params: [
      { name: "nums", type: "int[]" },
      { name: "target", type: "int" },
    ],
    returnType: "int",
  },
  "group-anagrams": {
    className: "Solution",
    methodName: "groupAnagrams",
    params: [{ name: "strs", type: "string[]" }],
    returnType: "string[][]",
    unorderedOutput: true,
    unorderedInner: true,
  },
  "rotate-image": {
    className: "Solution",
    methodName: "rotate",
    params: [{ name: "matrix", type: "int[][]" }],
    returnType: "void",
  },
  "validate-binary-search-tree": {
    className: "Solution",
    methodName: "isValidBST",
    params: [{ name: "root", type: "TreeNode" }],
    returnType: "bool",
  },
  "binary-tree-level-order-traversal": {
    className: "Solution",
    methodName: "levelOrder",
    params: [{ name: "root", type: "TreeNode" }],
    returnType: "int[][]",
  },
  "rotting-oranges": {
    className: "Solution",
    methodName: "orangesRotting",
    params: [{ name: "grid", type: "int[][]" }],
    returnType: "int",
  },
  "word-break": {
    className: "Solution",
    methodName: "wordBreak",
    params: [
      { name: "s", type: "string" },
      { name: "wordDict", type: "string[]" },
    ],
    returnType: "bool",
  },
  "longest-valid-parentheses": {
    className: "Solution",
    methodName: "longestValidParentheses",
    params: [{ name: "s", type: "string" }],
    returnType: "int",
  },
  "minimum-window-substring": {
    className: "Solution",
    methodName: "minWindow",
    params: [
      { name: "s", type: "string" },
      { name: "t", type: "string" },
    ],
    returnType: "string",
  },
  "edit-distance": {
    className: "Solution",
    methodName: "minDistance",
    params: [
      { name: "word1", type: "string" },
      { name: "word2", type: "string" },
    ],
    returnType: "int",
  },
  "largest-rectangle-in-histogram": {
    className: "Solution",
    methodName: "largestRectangleArea",
    params: [{ name: "heights", type: "int[]" }],
    returnType: "int",
  },
  "n-queens": {
    className: "Solution",
    methodName: "solveNQueens",
    params: [{ name: "n", type: "int" }],
    returnType: "string[][]",
    unorderedOutput: true,
  },
  "maximum-profit-in-job-scheduling": {
    className: "Solution",
    methodName: "jobScheduling",
    params: [
      { name: "startTime", type: "int[]" },
      { name: "endTime", type: "int[]" },
      { name: "profit", type: "int[]" },
    ],
    returnType: "int",
  },
  "valid-anagram": {
    className: "Solution",
    methodName: "isAnagram",
    params: [{ name: "s", type: "string" }, { name: "t", type: "string" }],
    returnType: "bool",
  },
  "reverse-linked-list": {
    className: "Solution",
    methodName: "reverseList",
    params: [{ name: "head", type: "ListNode" }],
    returnType: "ListNode",
  },
  "maximum-depth-of-binary-tree": {
    className: "Solution",
    methodName: "maxDepth",
    params: [{ name: "root", type: "TreeNode" }],
    returnType: "int",
  },
  "same-tree": {
    className: "Solution",
    methodName: "isSameTree",
    params: [{ name: "p", type: "TreeNode" }, { name: "q", type: "TreeNode" }],
    returnType: "bool",
  },
  "symmetric-tree": {
    className: "Solution",
    methodName: "isSymmetric",
    params: [{ name: "root", type: "TreeNode" }],
    returnType: "bool",
  },
  "binary-search": {
    className: "Solution",
    methodName: "search",
    params: [{ name: "nums", type: "int[]" }, { name: "target", type: "int" }],
    returnType: "int",
  },
  "ransom-note": {
    className: "Solution",
    methodName: "canConstruct",
    params: [{ name: "ransomNote", type: "string" }, { name: "magazine", type: "string" }],
    returnType: "bool",
  },
  "majority-element": {
    className: "Solution",
    methodName: "majorityElement",
    params: [{ name: "nums", type: "int[]" }],
    returnType: "int",
  },
  "single-number": {
    className: "Solution",
    methodName: "singleNumber",
    params: [{ name: "nums", type: "int[]" }],
    returnType: "int",
  },
  "move-zeroes": {
    className: "Solution",
    methodName: "moveZeroes",
    params: [{ name: "nums", type: "int[]" }],
    returnType: "void",
  },
  "palindrome-number": {
    className: "Solution",
    methodName: "isPalindrome",
    params: [{ name: "x", type: "int" }],
    returnType: "bool",
  },
  "roman-to-integer": {
    className: "Solution",
    methodName: "romanToInt",
    params: [{ name: "s", type: "string" }],
    returnType: "int",
  },
  "longest-common-prefix": {
    className: "Solution",
    methodName: "longestCommonPrefix",
    params: [{ name: "strs", type: "string[]" }],
    returnType: "string",
  },
  "plus-one": {
    className: "Solution",
    methodName: "plusOne",
    params: [{ name: "digits", type: "int[]" }],
    returnType: "int[]",
  },
  "sqrtx": {
    className: "Solution",
    methodName: "mySqrt",
    params: [{ name: "x", type: "int" }],
    returnType: "int",
  },
  "merge-sorted-array": {
    className: "Solution",
    methodName: "merge",
    params: [{ name: "nums1", type: "int[]" }, { name: "m", type: "int" }, { name: "nums2", type: "int[]" }, { name: "n", type: "int" }],
    returnType: "void",
  },
  "pascals-triangle": {
    className: "Solution",
    methodName: "generate",
    params: [{ name: "numRows", type: "int" }],
    returnType: "int[][]",
  },
  "diameter-of-binary-tree": {
    className: "Solution",
    methodName: "diameterOfBinaryTree",
    params: [{ name: "root", type: "TreeNode" }],
    returnType: "int",
  },
  "balanced-binary-tree": {
    className: "Solution",
    methodName: "isBalanced",
    params: [{ name: "root", type: "TreeNode" }],
    returnType: "bool",
  },
  "middle-of-the-linked-list": {
    className: "Solution",
    methodName: "middleNode",
    params: [{ name: "head", type: "ListNode" }],
    returnType: "ListNode",
  },
  "palindrome-linked-list": {
    className: "Solution",
    methodName: "isPalindrome",
    params: [{ name: "head", type: "ListNode" }],
    returnType: "bool",
  },
  "intersection-of-two-arrays": {
    className: "Solution",
    methodName: "intersection",
    params: [{ name: "nums1", type: "int[]" }, { name: "nums2", type: "int[]" }],
    returnType: "int[]",
    unorderedOutput: true,
  },
  "happy-number": {
    className: "Solution",
    methodName: "isHappy",
    params: [{ name: "n", type: "int" }],
    returnType: "bool",
  },
  "is-subsequence": {
    className: "Solution",
    methodName: "isSubsequence",
    params: [{ name: "s", type: "string" }, { name: "t", type: "string" }],
    returnType: "bool",
  },
  "counting-bits": {
    className: "Solution",
    methodName: "countBits",
    params: [{ name: "n", type: "int" }],
    returnType: "int[]",
  },
  "fizz-buzz": {
    className: "Solution",
    methodName: "fizzBuzz",
    params: [{ name: "n", type: "int" }],
    returnType: "string[]",
  },
  "search-insert-position": {
    className: "Solution",
    methodName: "searchInsert",
    params: [{ name: "nums", type: "int[]" }, { name: "target", type: "int" }],
    returnType: "int",
  },
  "add-binary": {
    className: "Solution",
    methodName: "addBinary",
    params: [{ name: "a", type: "string" }, { name: "b", type: "string" }],
    returnType: "string",
  },
  "binary-tree-inorder-traversal": {
    className: "Solution",
    methodName: "inorderTraversal",
    params: [{ name: "root", type: "TreeNode" }],
    returnType: "int[]",
  },
  "flood-fill": {
    className: "Solution",
    methodName: "floodFill",
    params: [{ name: "image", type: "int[][]" }, { name: "sr", type: "int" }, { name: "sc", type: "int" }, { name: "color", type: "int" }],
    returnType: "int[][]",
  },
  "island-perimeter": {
    className: "Solution",
    methodName: "islandPerimeter",
    params: [{ name: "grid", type: "int[][]" }],
    returnType: "int",
  },
};
