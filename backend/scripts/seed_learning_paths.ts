/// <reference types="node" />
import { query } from "../src/db";

type PathDef = {
  slug: string;
  title: string;
  description: string;
  topic: string;
  difficulty_level: string;
  problemSlugs: string[];
};

const PATHS: PathDef[] = [
  {
    slug: "arrays-101",
    title: "Arrays 101",
    description: "Build intuition on two pointers, prefix sums, and array manipulation.",
    topic: "Array",
    difficulty_level: "beginner",
    problemSlugs: [
      "two-sum",
      "contains-duplicate",
      "best-time-to-buy-and-sell-stock",
      "maximum-subarray",
      "product-of-array-except-self",
      "3sum",
    ],
  },
  {
    slug: "linked-lists",
    title: "Linked Lists",
    description: "Traversal, merging, and cycle detection on linked structures.",
    topic: "Linked List",
    difficulty_level: "beginner",
    problemSlugs: ["merge-two-sorted-lists", "linked-list-cycle", "merge-k-sorted-lists"],
  },
  {
    slug: "trees-graphs",
    title: "Trees & Graphs",
    description: "BFS/DFS on trees and graphs, topological patterns.",
    topic: "Tree & Graph",
    difficulty_level: "intermediate",
    problemSlugs: [
      "invert-binary-tree",
      "lowest-common-ancestor-of-a-binary-search-tree",
      "validate-binary-search-tree",
      "binary-tree-level-order-traversal",
      "number-of-islands",
      "course-schedule",
    ],
  },
  {
    slug: "dynamic-programming",
    title: "Dynamic Programming",
    description: "Classic DP patterns from recursion to optimization.",
    topic: "Dynamic Programming",
    difficulty_level: "intermediate",
    problemSlugs: [
      "climbing-stairs",
      "coin-change",
      "word-break",
      "longest-valid-parentheses",
      "edit-distance",
      "maximum-profit-in-job-scheduling",
    ],
  },
  {
    slug: "strings-hashing",
    title: "Strings & Hashing",
    description: "Sliding window, anagrams, and substring problems.",
    topic: "String",
    difficulty_level: "intermediate",
    problemSlugs: [
      "valid-palindrome",
      "longest-substring-without-repeating-characters",
      "group-anagrams",
      "minimum-window-substring",
    ],
  },
  {
    slug: "sorting-searching",
    title: "Sorting & Searching",
    description: "Binary search variants, heaps, and order statistics.",
    topic: "Binary Search",
    difficulty_level: "advanced",
    problemSlugs: ["missing-number", "search-in-rotated-sorted-array", "top-k-frequent-elements", "median-of-two-sorted-arrays"],
  },
];

async function main() {
  for (const pathDef of PATHS) {
    const pathRes = await query<{ id: string }>(
      `INSERT INTO learning_paths (slug, title, description, topic, difficulty_level)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (slug) DO UPDATE SET
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         topic = EXCLUDED.topic,
         difficulty_level = EXCLUDED.difficulty_level
       RETURNING id`,
      [pathDef.slug, pathDef.title, pathDef.description, pathDef.topic, pathDef.difficulty_level]
    );
    const pathId = pathRes.rows[0].id;

    await query(`DELETE FROM learning_path_problems WHERE path_id = $1`, [pathId]);

    let position = 0;
    for (const slug of pathDef.problemSlugs) {
      const prob = await query<{ id: string }>(`SELECT id FROM problems WHERE slug = $1`, [slug]);
      if (prob.rows.length === 0) {
        console.warn(`Skip missing problem slug: ${slug}`);
        continue;
      }
      await query(
        `INSERT INTO learning_path_problems (path_id, problem_id, position) VALUES ($1, $2, $3)`,
        [pathId, prob.rows[0].id, position]
      );
      position += 1;
    }
    console.log(`Seeded path: ${pathDef.slug} (${position} problems)`);
  }
  console.log("Done seeding learning paths.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
