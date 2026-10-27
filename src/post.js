// Publishes due posts from queue/posts.json to Instagram.
//
//   node src/post.js            publish due posts
//   node src/post.js --dry-run  show what would be published, change nothing
//
// A post is "due" when status is "pending" and scheduledAt is in the past.
// Failed posts are marked "failed" and are NOT retried automatically, so a
// half-successful run can never cause a duplicate post. Fix the cause, then
// set the status back to "pending" yourself.

import { api, requireEnv, waitUntilReady } from "./graph.js";
import { loadQueue, saveQueue, validatePost } from "./queue.js";

const dryRun = process.argv.includes("--dry-run");
const maxPerRun = Number(process.env.MAX_POSTS_PER_RUN || 1);

async function createContainer(igId, post) {
  const caption = post.caption || "";

  if (post.type === "image") {
    return api(`/${igId}/media`, { method: "POST", params: { image_url: post.imageUrl, caption } });
  }

  if (post.type === "reel") {
    return api(`/${igId}/media`, {
      method: "POST",
      params: { media_type: "REELS", video_url: post.videoUrl, caption },
    });
  }

  // carousel: create one child container per item, then a parent container
  const children = [];
  for (const url of post.mediaUrls) {
    const isVideo = /\.(mp4|mov)(\?|$)/i.test(url);
    const child = await api(`/${igId}/media`, {
      method: "POST",
      params: isVideo
        ? { media_type: "VIDEO", video_url: url, is_carousel_item: "true" }
        : { image_url: url, is_carousel_item: "true" },
    });
    await waitUntilReady(child.id);
    children.push(child.id);
  }
  return api(`/${igId}/media`, {
    method: "POST",
    params: { media_type: "CAROUSEL", children: children.join(","), caption },
  });
}

async function publish(igId, post) {
  const container = await createContainer(igId, post);
  await waitUntilReady(container.id);
  const result = await api(`/${igId}/media_publish`, {
    method: "POST",
    params: { creation_id: container.id },
  });
  return result.id;
}

async function main() {
  const queue = await loadQueue();
  const now = Date.now();

  const due = queue.posts
    .filter((p) => p.status === "pending" && Date.parse(p.scheduledAt) <= now)
    .sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt))
    .slice(0, maxPerRun);

  if (due.length === 0) {
    console.log("No posts due. Nothing to do.");
    return;
  }

  const igId = dryRun ? "DRY_RUN" : requireEnv("INSTAGRAM_ACCOUNT_ID");
  let failures = 0;

  for (const post of due) {
    const problems = validatePost(post);
    if (problems.length) {
      console.error(`Skipping invalid post:\n  ${problems.join("\n  ")}`);
      post.status = "failed";
      post.error = problems.join("; ");
      failures++;
      continue;
    }

    if (dryRun) {
      console.log(`[dry-run] Would publish "${post.id}" (${post.type}) scheduled for ${post.scheduledAt}`);
      continue;
    }

    try {
      console.log(`Publishing "${post.id}" (${post.type})...`);
      post.mediaId = await publish(igId, post);
      post.status = "posted";
      post.postedAt = new Date().toISOString();
      delete post.error;
      console.log(`Published "${post.id}" -> media id ${post.mediaId}`);
    } catch (err) {
      post.status = "failed";
      post.error = err.message;
      failures++;
      console.error(`Failed to publish "${post.id}": ${err.message}`);
    }
  }

  if (!dryRun) await saveQueue(queue);
  if (failures > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
