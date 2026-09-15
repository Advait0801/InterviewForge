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
  "add-two-numbers": {
    className: "Solution",
    methodName: "addTwoNumbers",
    params: [{ name: "l1", type: "ListNode" }, { name: "l2", type: "ListNode" }],
    returnType: "ListNode",
  },
  "generate-parentheses": {
    className: "Solution",
    methodName: "generateParenthesis",
    params: [{ name: "n", type: "int" }],
    returnType: "string[]",
    unorderedOutput: true,
  },
  "remove-nth-node-from-end-of-list": {
    className: "Solution",
    methodName: "removeNthFromEnd",
    params: [{ name: "head", type: "ListNode" }, { name: "n", type: "int" }],
    returnType: "ListNode",
  },
  "search-a-2d-matrix": {
    className: "Solution",
    methodName: "searchMatrix",
    params: [{ name: "matrix", type: "int[][]" }, { name: "target", type: "int" }],
    returnType: "bool",
  },
  "find-minimum-in-rotated-sorted-array": {
    className: "Solution",
    methodName: "findMin",
    params: [{ name: "nums", type: "int[]" }],
    returnType: "int",
  },
  "kth-largest-element-in-an-array": {
    className: "Solution",
    methodName: "findKthLargest",
    params: [{ name: "nums", type: "int[]" }, { name: "k", type: "int" }],
    returnType: "int",
  },
  "subsets": {
    className: "Solution",
    methodName: "subsets",
    params: [{ name: "nums", type: "int[]" }],
    returnType: "int[][]",
    unorderedOutput: true,
    unorderedInner: true,
  },
  "combination-sum": {
    className: "Solution",
    methodName: "combinationSum",
    params: [{ name: "candidates", type: "int[]" }, { name: "target", type: "int" }],
    returnType: "int[][]",
    unorderedOutput: true,
    unorderedInner: true,
  },
  "letter-combinations-of-a-phone-number": {
    className: "Solution",
    methodName: "letterCombinations",
    params: [{ name: "digits", type: "string" }],
    returnType: "string[]",
    unorderedOutput: true,
  },
  "word-search": {
    className: "Solution",
    methodName: "exist",
    params: [{ name: "board", type: "char[][]" }, { name: "word", type: "string" }],
    returnType: "bool",
  },
  "spiral-matrix": {
    className: "Solution",
    methodName: "spiralOrder",
    params: [{ name: "matrix", type: "int[][]" }],
    returnType: "int[]",
  },
  "set-matrix-zeroes": {
    className: "Solution",
    methodName: "setZeroes",
    params: [{ name: "matrix", type: "int[][]" }],
    returnType: "void",
  },
  "jump-game": {
    className: "Solution",
    methodName: "canJump",
    params: [{ name: "nums", type: "int[]" }],
    returnType: "bool",
  },
  "unique-paths": {
    className: "Solution",
    methodName: "uniquePaths",
    params: [{ name: "m", type: "int" }, { name: "n", type: "int" }],
    returnType: "int",
  },
  "longest-increasing-subsequence": {
    className: "Solution",
    methodName: "lengthOfLIS",
    params: [{ name: "nums", type: "int[]" }],
    returnType: "int",
  },
  "house-robber": {
    className: "Solution",
    methodName: "rob",
    params: [{ name: "nums", type: "int[]" }],
    returnType: "int",
  },
  "house-robber-ii": {
    className: "Solution",
    methodName: "rob",
    params: [{ name: "nums", type: "int[]" }],
    returnType: "int",
  },
  "decode-ways": {
    className: "Solution",
    methodName: "numDecodings",
    params: [{ name: "s", type: "string" }],
    returnType: "int",
  },
  "partition-equal-subset-sum": {
    className: "Solution",
    methodName: "canPartition",
    params: [{ name: "nums", type: "int[]" }],
    returnType: "bool",
  },
  "longest-common-subsequence": {
    className: "Solution",
    methodName: "longestCommonSubsequence",
    params: [{ name: "text1", type: "string" }, { name: "text2", type: "string" }],
    returnType: "int",
  },
  "merge-intervals": {
    className: "Solution",
    methodName: "merge",
    params: [{ name: "intervals", type: "int[][]" }],
    returnType: "int[][]",
    unorderedOutput: true,
  },
  "insert-interval": {
    className: "Solution",
    methodName: "insert",
    params: [{ name: "intervals", type: "int[][]" }, { name: "newInterval", type: "int[]" }],
    returnType: "int[][]",
  },
  "non-overlapping-intervals": {
    className: "Solution",
    methodName: "eraseOverlapIntervals",
    params: [{ name: "intervals", type: "int[][]" }],
    returnType: "int",
  },
  "daily-temperatures": {
    className: "Solution",
    methodName: "dailyTemperatures",
    params: [{ name: "temperatures", type: "int[]" }],
    returnType: "int[]",
  },
  "evaluate-reverse-polish-notation": {
    className: "Solution",
    methodName: "evalRPN",
    params: [{ name: "tokens", type: "string[]" }],
    returnType: "int",
  },
  "binary-tree-right-side-view": {
    className: "Solution",
    methodName: "rightSideView",
    params: [{ name: "root", type: "TreeNode" }],
    returnType: "int[]",
  },
  "kth-smallest-element-in-a-bst": {
    className: "Solution",
    methodName: "kthSmallest",
    params: [{ name: "root", type: "TreeNode" }, { name: "k", type: "int" }],
    returnType: "int",
  },
  "construct-binary-tree-from-preorder-and-inorder-traversal": {
    className: "Solution",
    methodName: "buildTree",
    params: [{ name: "preorder", type: "int[]" }, { name: "inorder", type: "int[]" }],
    returnType: "TreeNode",
  },
  "count-good-nodes-in-binary-tree": {
    className: "Solution",
    methodName: "goodNodes",
    params: [{ name: "root", type: "TreeNode" }],
    returnType: "int",
  },
  "pacific-atlantic-water-flow": {
    className: "Solution",
    methodName: "pacificAtlantic",
    params: [{ name: "heights", type: "int[][]" }],
    returnType: "int[][]",
    unorderedOutput: true,
  },
  "number-of-provinces": {
    className: "Solution",
    methodName: "findCircleNum",
    params: [{ name: "isConnected", type: "int[][]" }],
    returnType: "int",
  },
  "gas-station": {
    className: "Solution",
    methodName: "canCompleteCircuit",
    params: [{ name: "gas", type: "int[]" }, { name: "cost", type: "int[]" }],
    returnType: "int",
  },
  "sort-colors": {
    className: "Solution",
    methodName: "sortColors",
    params: [{ name: "nums", type: "int[]" }],
    returnType: "void",
  },
  "find-the-duplicate-number": {
    className: "Solution",
    methodName: "findDuplicate",
    params: [{ name: "nums", type: "int[]" }],
    returnType: "int",
  },
  "longest-consecutive-sequence": {
    className: "Solution",
    methodName: "longestConsecutive",
    params: [{ name: "nums", type: "int[]" }],
    returnType: "int",
  },
  "valid-sudoku": {
    className: "Solution",
    methodName: "isValidSudoku",
    params: [{ name: "board", type: "char[][]" }],
    returnType: "bool",
  },
  "subarray-sum-equals-k": {
    className: "Solution",
    methodName: "subarraySum",
    params: [{ name: "nums", type: "int[]" }, { name: "k", type: "int" }],
    returnType: "int",
  },
  "maximum-product-subarray": {
    className: "Solution",
    methodName: "maxProduct",
    params: [{ name: "nums", type: "int[]" }],
    returnType: "int",
  },
  "palindromic-substrings": {
    className: "Solution",
    methodName: "countSubstrings",
    params: [{ name: "s", type: "string" }],
    returnType: "int",
  },
  "coin-change-ii": {
    className: "Solution",
    methodName: "change",
    params: [{ name: "amount", type: "int" }, { name: "coins", type: "int[]" }],
    returnType: "int",
  },
  "target-sum": {
    className: "Solution",
    methodName: "findTargetSumWays",
    params: [{ name: "nums", type: "int[]" }, { name: "target", type: "int" }],
    returnType: "int",
  },
  "rotate-array": {
    className: "Solution",
    methodName: "rotate",
    params: [{ name: "nums", type: "int[]" }, { name: "k", type: "int" }],
    returnType: "void",
  },
  "koko-eating-bananas": {
    className: "Solution",
    methodName: "minEatingSpeed",
    params: [{ name: "piles", type: "int[]" }, { name: "h", type: "int" }],
    returnType: "int",
  },
  "min-stack": {
    className: "MinStack",
    isDesign: true,
    methods: [
      { name: "push", params: [{ name: "val", type: "int" }], returnType: "void" },
      { name: "pop", params: [], returnType: "void" },
      { name: "top", params: [], returnType: "int" },
      { name: "getMin", params: [], returnType: "int" },
    ],
  },
  "lru-cache": {
    className: "LRUCache",
    isDesign: true,
    constructorParams: [{ name: "capacity", type: "int" }],
    methods: [
      { name: "get", params: [{ name: "key", type: "int" }], returnType: "int" },
      { name: "put", params: [{ name: "key", type: "int" }, { name: "value", type: "int" }], returnType: "void" },
    ],
  },
  "time-based-key-value-store": {
    className: "TimeMap",
    isDesign: true,
    methods: [
      { name: "set", params: [{ name: "key", type: "string" }, { name: "value", type: "string" }, { name: "timestamp", type: "int" }], returnType: "void" },
      { name: "get", params: [{ name: "key", type: "string" }, { name: "timestamp", type: "int" }], returnType: "string" },
    ],
  },
  "regular-expression-matching": {
    className: "Solution",
    methodName: "isMatch",
    params: [{ name: "s", type: "string" }, { name: "p", type: "string" }],
    returnType: "bool",
  },
  "wildcard-matching": {
    className: "Solution",
    methodName: "isMatch",
    params: [{ name: "s", type: "string" }, { name: "p", type: "string" }],
    returnType: "bool",
  },
  "first-missing-positive": {
    className: "Solution",
    methodName: "firstMissingPositive",
    params: [{ name: "nums", type: "int[]" }],
    returnType: "int",
  },
  "sliding-window-maximum": {
    className: "Solution",
    methodName: "maxSlidingWindow",
    params: [{ name: "nums", type: "int[]" }, { name: "k", type: "int" }],
    returnType: "int[]",
  },
  "word-ladder": {
    className: "Solution",
    methodName: "ladderLength",
    params: [{ name: "beginWord", type: "string" }, { name: "endWord", type: "string" }, { name: "wordList", type: "string[]" }],
    returnType: "int",
  },
  "binary-tree-maximum-path-sum": {
    className: "Solution",
    methodName: "maxPathSum",
    params: [{ name: "root", type: "TreeNode" }],
    returnType: "int",
  },
  "reverse-nodes-in-k-group": {
    className: "Solution",
    methodName: "reverseKGroup",
    params: [{ name: "head", type: "ListNode" }, { name: "k", type: "int" }],
    returnType: "ListNode",
  },
  "longest-increasing-path-in-a-matrix": {
    className: "Solution",
    methodName: "longestIncreasingPath",
    params: [{ name: "matrix", type: "int[][]" }],
    returnType: "int",
  },
  "burst-balloons": {
    className: "Solution",
    methodName: "maxCoins",
    params: [{ name: "nums", type: "int[]" }],
    returnType: "int",
  },
  "distinct-subsequences": {
    className: "Solution",
    methodName: "numDistinct",
    params: [{ name: "s", type: "string" }, { name: "t", type: "string" }],
    returnType: "int",
  },
  "best-time-to-buy-and-sell-stock-iv": {
    className: "Solution",
    methodName: "maxProfit",
    params: [{ name: "k", type: "int" }, { name: "prices", type: "int[]" }],
    returnType: "int",
  },
  "candy": {
    className: "Solution",
    methodName: "candy",
    params: [{ name: "ratings", type: "int[]" }],
    returnType: "int",
  },
  "basic-calculator": {
    className: "Solution",
    methodName: "calculate",
    params: [{ name: "s", type: "string" }],
    returnType: "int",
  },
  "count-of-smaller-numbers-after-self": {
    className: "Solution",
    methodName: "countSmaller",
    params: [{ name: "nums", type: "int[]" }],
    returnType: "int[]",
  },
  "maximal-rectangle": {
    className: "Solution",
    methodName: "maximalRectangle",
    params: [{ name: "matrix", type: "char[][]" }],
    returnType: "int",
  },
  "palindrome-partitioning-ii": {
    className: "Solution",
    methodName: "minCut",
    params: [{ name: "s", type: "string" }],
    returnType: "int",
  },
};
