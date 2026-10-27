// Queue loading and validation, shared by post.js and validate.js.

import { readFile, writeFile } from "node:fs/promises";

export const QUEUE_FILE = process.env.QUEUE_FILE || "queue/posts.json";

const TYPES = ["image", "carousel", "reel"];
const MAX_CAPTION = 2200;

export async function loadQueue(file = QUEUE_FILE) {
  const raw = await readFile(file, "utf8");
  const data = JSON.parse(raw);
  if (!Array.isArray(data.posts)) {
    throw new Error(`${file} must contain a top-level "posts" array`);
  }
  return data;
}

export async function saveQueue(data, file = QUEUE_FILE) {
  await writeFile(file, JSON.stringify(data, null, 2) + "\n", "utf8");
}

// Returns a list of problems for one post (empty list = valid).
export function validatePost(post) {
  const problems = [];
  const tag = post.id || "(no id)";

  if (!post.id) problems.push("missing id");
  if (!TYPES.includes(post.type)) problems.push(`type must be one of: ${TYPES.join(", ")}`);
  if (typeof post.caption !== "string") problems.push("caption must be a string");
  else if (post.caption.length > MAX_CAPTION) problems.push(`caption exceeds ${MAX_CAPTION} characters`);
  if (post.caption && (post.caption.match(/#\w+/g) || []).length > 30) {
    problems.push("more than 30 hashtags (Instagram limit)");
  }

  const scheduled = Date.parse(post.scheduledAt);
  if (Number.isNaN(scheduled)) {
    problems.push('scheduledAt must be an ISO 8601 date, e.g. "2026-11-01T18:00:00+05:00"');
  }

  const isUrl = (u) => typeof u === "string" && /^https:\/\//.test(u);
  if (post.type === "image" && !isUrl(post.imageUrl)) problems.push("imageUrl must be a public https URL");
  if (post.type === "reel" && !isUrl(post.videoUrl)) problems.push("videoUrl must be a public https URL");
  if (post.type === "carousel") {
    const n = Array.isArray(post.mediaUrls) ? post.mediaUrls.length : 0;
    if (n < 2 || n > 10) problems.push("mediaUrls must contain 2-10 public https URLs");
    else if (!post.mediaUrls.every(isUrl)) problems.push("every entry in mediaUrls must be a public https URL");
  }

  if (!["pending", "posted", "failed"].includes(post.status)) {
    problems.push('status must be "pending", "posted" or "failed"');
  }

  return problems.map((p) => `${tag}: ${p}`);
}
