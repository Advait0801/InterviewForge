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
  unorderedOutput?: boolean;
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
};
