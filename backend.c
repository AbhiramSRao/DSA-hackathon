#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <limits.h>

/*
 * Student Index Recovery engine.
 * Input: fragment count, then one `root left right` row per fragment.
 * Use -1 for an empty child (student IDs must be non-negative).
 * Output is a small pipe-delimited protocol consumed by app.py.
 */
#define MAX_FRAGMENTS 100
#define MAX_NODES (MAX_FRAGMENTS * 3)
#define MAX_REASON 256

typedef struct Node {
    int value;
    struct Node *left;
    struct Node *right;
} Node;

typedef struct {
    int root, left, right;
    Node nodes[3];
    int used;
} Fragment;

static Fragment fragments[MAX_FRAGMENTS];
static int count;
static char reason[MAX_REASON];

static int find_root(int value) {
    int i;
    for (i = 0; i < count; i++) if (fragments[i].root == value) return i;
    return -1;
}

static void fail(const char *message) {
    snprintf(reason, sizeof(reason), "%s", message);
}

static Node *merge_fragment(int index, long long low, long long high) {
    Fragment *fragment = &fragments[index];
    Node *root = &fragment->nodes[0];
    int child_index;
    if (fragment->used) {
        fail("A fragment would be used more than once (cycle or repeated connection).");
        return NULL;
    }
    fragment->used = 1;
    if ((long long)root->value <= low || (long long)root->value >= high) {
        snprintf(reason, sizeof(reason), "Ordering conflict at ID %d: it must be strictly between its ancestor bounds.", root->value);
        return NULL;
    }
    if (fragment->left != -1) {
        child_index = find_root(fragment->left);
        if (child_index >= 0) {
            root->left = merge_fragment(child_index, low, root->value);
            if (!root->left) return NULL;
        }
    }
    if (fragment->right != -1) {
        child_index = find_root(fragment->right);
        if (child_index >= 0) {
            root->right = merge_fragment(child_index, root->value, high);
            if (!root->right) return NULL;
        }
    }
    return root;
}

static int validate_tree(Node *node, long long low, long long high) {
    if (!node) return 1;
    if ((long long)node->value <= low || (long long)node->value >= high) {
        snprintf(reason, sizeof(reason), "Ordering conflict at ID %d: it violates an ancestor's BST range.", node->value);
        return 0;
    }
    return validate_tree(node->left, low, node->value) && validate_tree(node->right, node->value, high);
}

static void inorder(Node *node, int *out, int *used) {
    if (!node) return;
    inorder(node->left, out, used);
    out[(*used)++] = node->value;
    inorder(node->right, out, used);
}

static int node_count(Node *node) {
    if (!node) return 0;
    return 1 + node_count(node->left) + node_count(node->right);
}

static Node *output_nodes[MAX_NODES];
static int output_count;

static void gather_nodes(Node *node) {
    if (!node) return;
    output_nodes[output_count++] = node;
    gather_nodes(node->left);
    gather_nodes(node->right);
}

static int index_of_node(Node *node) {
    int i;
    for (i = 0; i < output_count; i++) if (output_nodes[i] == node) return i;
    return -1;
}

static void emit_nodes(void) {
    int i;
    int left_index, right_index;
    for (i = 0; i < output_count; i++) {
        left_index = index_of_node(output_nodes[i]->left);
        right_index = index_of_node(output_nodes[i]->right);
        printf("%d,%d,%d;", output_nodes[i]->value, left_index, right_index);
    }
}

static int add_value(int value, int *seen, int *seen_count) {
    int i;
    if (value == -1) return 1;
    if (value < 0) return 0;
    for (i = 0; i < *seen_count; i++) if (seen[i] == value) return 0;
    seen[(*seen_count)++] = value;
    return 1;
}

int main(void) {
    int i, roots_as_child[MAX_FRAGMENTS] = {0}, candidates = 0, root_index = -1;
    int seen[MAX_NODES], seen_count = 0, traversal[MAX_NODES], traversal_count = 0;
    Node *tree;
    if (scanf("%d", &count) != 1 || count < 1 || count > MAX_FRAGMENTS) {
        puts("ERR|Enter between 1 and 100 fragments."); return 0;
    }
    for (i = 0; i < count; i++) {
        Fragment *f = &fragments[i];
        if (scanf("%d %d %d", &f->root, &f->left, &f->right) != 3) {
            puts("ERR|Could not read every fragment row."); return 0;
        }
        if (f->root < 0 || (f->left < -1) || (f->right < -1)) {
            puts("ERR|IDs must be non-negative integers; use -1 only for an empty child."); return 0;
        }
        f->nodes[0].value = f->root;
        f->nodes[0].left = f->left == -1 ? NULL : &f->nodes[1];
        f->nodes[0].right = f->right == -1 ? NULL : &f->nodes[2];
        f->nodes[1].value = f->left; f->nodes[1].left = NULL; f->nodes[1].right = NULL;
        f->nodes[2].value = f->right; f->nodes[2].left = NULL; f->nodes[2].right = NULL;
        if ((f->left != -1 && f->left >= f->root) || (f->right != -1 && f->right <= f->root)) {
            snprintf(reason, sizeof(reason), "Fragment %d is not a valid BST: its child violates the root ordering.", i + 1);
            printf("ERR|%s\n", reason); return 0;
        }
    }
    for (i = 0; i < count; i++) {
        int j;
        for (j = i + 1; j < count; j++) if (fragments[i].root == fragments[j].root) {
            snprintf(reason, sizeof(reason), "Duplicate fragment root ID %d.", fragments[i].root);
            printf("ERR|%s\n", reason); return 0;
        }
    }
    /* A root can also occur as a child: that is the intended join point. */
    for (i = 0; i < count; i++) {
        int children[2] = {fragments[i].left, fragments[i].right}, k;
        for (k = 0; k < 2; k++) if (children[k] != -1) {
            int j, matched = find_root(children[k]);
            if (matched >= 0) roots_as_child[matched] = 1;
            else if (!add_value(children[k], seen, &seen_count)) {
                snprintf(reason, sizeof(reason), "Duplicate student ID %d appears in multiple fragment nodes.", children[k]);
                printf("ERR|%s\n", reason); return 0;
            }
        }
    }
    for (i = 0; i < count; i++) if (!roots_as_child[i]) { candidates++; root_index = i; }
    if (candidates != 1) {
        puts(candidates == 0 ? "ERR|No final root candidate: fragment connections form a cycle." : "ERR|Fragments are disconnected: more than one root candidate remains.");
        return 0;
    }
    tree = merge_fragment(root_index, LLONG_MIN, LLONG_MAX);
    if (!tree) { printf("ERR|%s\n", reason); return 0; }
    for (i = 0; i < count; i++) if (!fragments[i].used) {
        snprintf(reason, sizeof(reason), "Disconnected or unused fragment rooted at %d.", fragments[i].root);
        printf("ERR|%s\n", reason); return 0;
    }
    if (!validate_tree(tree, LLONG_MIN, LLONG_MAX)) { printf("ERR|%s\n", reason); return 0; }
    inorder(tree, traversal, &traversal_count);
    gather_nodes(tree);
    printf("OK|%d|%d|%d|", tree->value, count, node_count(tree));
    for (i = 0; i < traversal_count; i++) printf("%s%d", i ? "," : "", traversal[i]);
    printf("|"); emit_nodes(); putchar('\n');
    return 0;
}
