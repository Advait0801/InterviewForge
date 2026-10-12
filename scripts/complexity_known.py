"""Solutions whose time complexity is known in advance, for Phase 12's complexity checks.

Each entry: (label, slug, language, expected class, code). The O(n log n) ones sort with a
hand-written merge sort, so the log factor is real work in the language itself rather than
a C library call that a Python loop around it would hide.
"""

PY_MERGE = '''
class Solution:
    def sortColors(self, nums):
        def sort(a):
            if len(a) <= 1:
                return a
            mid = len(a) // 2
            left, right = sort(a[:mid]), sort(a[mid:])
            out, i, j = [], 0, 0
            while i < len(left) and j < len(right):
                if left[i] <= right[j]:
                    out.append(left[i]); i += 1
                else:
                    out.append(right[j]); j += 1
            out.extend(left[i:]); out.extend(right[j:])
            return out
        nums[:] = sort(nums)
'''

JS_MERGE = '''
var sortColors = function(nums) {
  const sort = (a) => {
    if (a.length <= 1) return a;
    const mid = a.length >> 1, l = sort(a.slice(0, mid)), r = sort(a.slice(mid));
    const out = []; let i = 0, j = 0;
    while (i < l.length && j < r.length) out.push(l[i] <= r[j] ? l[i++] : r[j++]);
    while (i < l.length) out.push(l[i++]);
    while (j < r.length) out.push(r[j++]);
    return out;
  };
  const s = sort(nums);
  for (let k = 0; k < nums.length; k++) nums[k] = s[k];
};
'''

CPP_MERGE = '''
class Solution {
    void sortRange(vector<int>& a, vector<int>& tmp, int lo, int hi) {
        if (hi - lo <= 1) return;
        int mid = (lo + hi) / 2;
        sortRange(a, tmp, lo, mid); sortRange(a, tmp, mid, hi);
        int i = lo, j = mid, k = lo;
        while (i < mid && j < hi) tmp[k++] = a[i] <= a[j] ? a[i++] : a[j++];
        while (i < mid) tmp[k++] = a[i++];
        while (j < hi) tmp[k++] = a[j++];
        for (int x = lo; x < hi; x++) a[x] = tmp[x];
    }
public:
    void sortColors(vector<int>& nums) {
        vector<int> tmp(nums.size());
        sortRange(nums, tmp, 0, nums.size());
    }
};
'''

JAVA_MERGE = '''
class Solution {
    private void sortRange(int[] a, int[] tmp, int lo, int hi) {
        if (hi - lo <= 1) return;
        int mid = (lo + hi) >>> 1;
        sortRange(a, tmp, lo, mid); sortRange(a, tmp, mid, hi);
        int i = lo, j = mid, k = lo;
        while (i < mid && j < hi) tmp[k++] = a[i] <= a[j] ? a[i++] : a[j++];
        while (i < mid) tmp[k++] = a[i++];
        while (j < hi) tmp[k++] = a[j++];
        System.arraycopy(tmp, lo, a, lo, hi - lo);
    }
    public void sortColors(int[] nums) {
        sortRange(nums, new int[nums.length], 0, nums.length);
    }
}
'''

C_MERGE = '''
static void sortRange(int* a, int* tmp, int lo, int hi) {
    if (hi - lo <= 1) return;
    int mid = (lo + hi) / 2;
    sortRange(a, tmp, lo, mid); sortRange(a, tmp, mid, hi);
    int i = lo, j = mid, k = lo;
    while (i < mid && j < hi) tmp[k++] = a[i] <= a[j] ? a[i++] : a[j++];
    while (i < mid) tmp[k++] = a[i++];
    while (j < hi) tmp[k++] = a[j++];
    for (int x = lo; x < hi; x++) a[x] = tmp[x];
}
void sortColors(int* nums, int numsSize) {
    int* tmp = malloc(sizeof(int) * (numsSize > 0 ? numsSize : 1));
    sortRange(nums, tmp, 0, numsSize);
    free(tmp);
}
'''

GO_MERGE = '''
func sortColors(nums []int) {
    tmp := make([]int, len(nums))
    var sortRange func(lo, hi int)
    sortRange = func(lo, hi int) {
        if hi-lo <= 1 {
            return
        }
        mid := (lo + hi) / 2
        sortRange(lo, mid)
        sortRange(mid, hi)
        i, j, k := lo, mid, lo
        for i < mid && j < hi {
            if nums[i] <= nums[j] {
                tmp[k] = nums[i]; i++
            } else {
                tmp[k] = nums[j]; j++
            }
            k++
        }
        for i < mid { tmp[k] = nums[i]; i++; k++ }
        for j < hi { tmp[k] = nums[j]; j++; k++ }
        copy(nums[lo:hi], tmp[lo:hi])
    }
    sortRange(0, len(nums))
}
'''

RUST_MERGE = '''
impl Solution {
    fn sort_range(a: &mut Vec<i32>, tmp: &mut Vec<i32>, lo: usize, hi: usize) {
        if hi - lo <= 1 { return; }
        let mid = (lo + hi) / 2;
        Self::sort_range(a, tmp, lo, mid);
        Self::sort_range(a, tmp, mid, hi);
        let (mut i, mut j, mut k) = (lo, mid, lo);
        while i < mid && j < hi {
            if a[i] <= a[j] { tmp[k] = a[i]; i += 1; } else { tmp[k] = a[j]; j += 1; }
            k += 1;
        }
        while i < mid { tmp[k] = a[i]; i += 1; k += 1; }
        while j < hi { tmp[k] = a[j]; j += 1; k += 1; }
        a[lo..hi].copy_from_slice(&tmp[lo..hi]);
    }
    pub fn sort_colors(nums: &mut Vec<i32>) {
        let mut tmp = vec![0; nums.len()];
        let n = nums.len();
        Self::sort_range(nums, &mut tmp, 0, n);
    }
}
'''

KNOWN = [
    # ── Python ──
    ("py two-sum hash map", "two-sum", "python3", "O(n)", '''
class Solution:
    def twoSum(self, nums, target):
        seen = {}
        for i, v in enumerate(nums):
            if target - v in seen:
                return [seen[target - v], i]
            seen[v] = i
        return []
'''),
    ("py two-sum brute force", "two-sum", "python3", "O(n²)", '''
class Solution:
    def twoSum(self, nums, target):
        for i in range(len(nums)):
            for j in range(i + 1, len(nums)):
                if nums[i] + nums[j] == target:
                    return [i, j]
        return []
'''),
    ("py merge sort", "sort-colors", "python3", "O(n log n)", PY_MERGE),
    ("py counting sort", "sort-colors", "python3", "O(n)", '''
class Solution:
    def sortColors(self, nums):
        counts = [0, 0, 0]
        for v in nums:
            counts[v] += 1
        i = 0
        for colour in range(3):
            for _ in range(counts[colour]):
                nums[i] = colour
                i += 1
'''),
    ("py binary search", "binary-search", "python3", "O(log n)", '''
class Solution:
    def search(self, nums, target):
        lo, hi = 0, len(nums) - 1
        while lo <= hi:
            mid = (lo + hi) // 2
            if nums[mid] == target:
                return mid
            if nums[mid] < target:
                lo = mid + 1
            else:
                hi = mid - 1
        return -1
'''),
    ("py linear search", "binary-search", "python3", "O(n)", '''
class Solution:
    def search(self, nums, target):
        for i, v in enumerate(nums):
            if v == target:
                return i
        return -1
'''),
    ("py palindromic substrings", "palindromic-substrings", "python3", "O(n²)", None),  # reference
    ("py longest common subsequence", "longest-common-subsequence", "python3", "O(n²)", None),
    # ── JavaScript ──
    ("js two-sum map", "two-sum", "javascript", "O(n)", '''
var twoSum = function(nums, target) {
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    if (seen.has(target - nums[i])) return [seen.get(target - nums[i]), i];
    seen.set(nums[i], i);
  }
  return [];
};
'''),
    ("js two-sum brute force", "two-sum", "javascript", "O(n²)", '''
var twoSum = function(nums, target) {
  for (let i = 0; i < nums.length; i++)
    for (let j = i + 1; j < nums.length; j++)
      if (nums[i] + nums[j] === target) return [i, j];
  return [];
};
'''),
    ("js merge sort", "sort-colors", "javascript", "O(n log n)", JS_MERGE),
    # ── C++ ──
    ("cpp two-sum hash map", "two-sum", "cpp", "O(n)", '''
class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> seen;
        for (int i = 0; i < (int)nums.size(); i++) {
            auto it = seen.find(target - nums[i]);
            if (it != seen.end()) return {it->second, i};
            seen[nums[i]] = i;
        }
        return {};
    }
};
'''),
    ("cpp two-sum brute force", "two-sum", "cpp", "O(n²)", '''
class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        for (int i = 0; i < (int)nums.size(); i++)
            for (int j = i + 1; j < (int)nums.size(); j++)
                if (nums[i] + nums[j] == target) return {i, j};
        return {};
    }
};
'''),
    ("cpp merge sort", "sort-colors", "cpp", "O(n log n)", CPP_MERGE),
    # ── Java ──
    ("java two-sum hash map", "two-sum", "java", "O(n)", '''
class Solution {
    public int[] twoSum(int[] nums, int target) {
        java.util.HashMap<Integer, Integer> seen = new java.util.HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            Integer j = seen.get(target - nums[i]);
            if (j != null) return new int[]{j, i};
            seen.put(nums[i], i);
        }
        return new int[0];
    }
}
'''),
    ("java two-sum brute force", "two-sum", "java", "O(n²)", '''
class Solution {
    public int[] twoSum(int[] nums, int target) {
        for (int i = 0; i < nums.length; i++)
            for (int j = i + 1; j < nums.length; j++)
                if (nums[i] + nums[j] == target) return new int[]{i, j};
        return new int[0];
    }
}
'''),
    ("java merge sort", "sort-colors", "java", "O(n log n)", JAVA_MERGE),
    # ── C ──
    ("c counting sort", "sort-colors", "c", "O(n)", '''
void sortColors(int* nums, int numsSize) {
    int counts[3] = {0, 0, 0};
    for (int i = 0; i < numsSize; i++) counts[nums[i]]++;
    int k = 0;
    for (int c = 0; c < 3; c++) for (int x = 0; x < counts[c]; x++) nums[k++] = c;
}
'''),
    ("c insertion sort", "sort-colors", "c", "O(n²)", '''
void sortColors(int* nums, int numsSize) {
    for (int i = 1; i < numsSize; i++) {
        int v = nums[i], j = i - 1;
        while (j >= 0 && nums[j] > v) { nums[j + 1] = nums[j]; j--; }
        nums[j + 1] = v;
    }
}
'''),
    ("c merge sort", "sort-colors", "c", "O(n log n)", C_MERGE),
    # ── Go ──
    ("go two-sum map", "two-sum", "go", "O(n)", '''
func twoSum(nums []int, target int) []int {
    seen := map[int]int{}
    for i, v := range nums {
        if j, ok := seen[target-v]; ok {
            return []int{j, i}
        }
        seen[v] = i
    }
    return []int{}
}
'''),
    ("go two-sum brute force", "two-sum", "go", "O(n²)", '''
func twoSum(nums []int, target int) []int {
    for i := range nums {
        for j := i + 1; j < len(nums); j++ {
            if nums[i]+nums[j] == target {
                return []int{i, j}
            }
        }
    }
    return []int{}
}
'''),
    ("go merge sort", "sort-colors", "go", "O(n log n)", GO_MERGE),
    # ── Rust ──
    ("rust two-sum hash map", "two-sum", "rust", "O(n)", '''
use std::collections::HashMap;
impl Solution {
    pub fn two_sum(nums: Vec<i32>, target: i32) -> Vec<i32> {
        let mut seen: HashMap<i32, i32> = HashMap::new();
        for (i, v) in nums.iter().enumerate() {
            if let Some(j) = seen.get(&(target - v)) { return vec![*j, i as i32]; }
            seen.insert(*v, i as i32);
        }
        vec![]
    }
}
'''),
    ("rust two-sum brute force", "two-sum", "rust", "O(n²)", '''
impl Solution {
    pub fn two_sum(nums: Vec<i32>, target: i32) -> Vec<i32> {
        for i in 0..nums.len() {
            for j in i + 1..nums.len() {
                if nums[i] + nums[j] == target { return vec![i as i32, j as i32]; }
            }
        }
        vec![]
    }
}
'''),
    ("rust merge sort", "sort-colors", "rust", "O(n log n)", RUST_MERGE),
]
