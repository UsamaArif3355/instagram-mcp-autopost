// Checks queue/posts.json for mistakes. Runs on every push via GitHub Actions.
import { loadQueue, validatePost } from "./queue.js";

const queue = await loadQueue();
const problems = queue.posts.flatMap(validatePost);

const ids = queue.posts.map((p) => p.id);
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dupes.length) problems.push(`duplicate ids: ${[...new Set(dupes)].join(", ")}`);

if (problems.length) {
  console.error("Queue validation failed:\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log(`Queue OK: ${queue.posts.length} post(s) validated.`);
