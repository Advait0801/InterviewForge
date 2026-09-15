static int btIndex[6001];
static int btPos;
static struct TreeNode* btBuild(int* preorder, int lo, int hi) {
    if (lo > hi) return NULL;
    struct TreeNode* node = (struct TreeNode*)malloc(sizeof(struct TreeNode));
    node->val = preorder[btPos++];
    int mid = btIndex[node->val + 3000];
    node->left = btBuild(preorder, lo, mid - 1);
    node->right = btBuild(preorder, mid + 1, hi);
    return node;
}
struct TreeNode* buildTree(int* preorder, int preorderSize, int* inorder, int inorderSize) {
    for (int i = 0; i < inorderSize; i++) btIndex[inorder[i] + 3000] = i;
    btPos = 0;
    return btBuild(preorder, 0, inorderSize - 1);
}
