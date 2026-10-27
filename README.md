# ig-autopost

A small, zero-dependency Instagram auto-poster. You list posts in `queue/posts.json`; a GitHub Actions workflow runs every 30 minutes and publishes whatever is due through the official **Instagram Graph API**. Supports single images, carousels (2-10 items) and Reels.

No servers, no paid services, no npm packages.

## How it works

```
queue/posts.json  ->  GitHub Actions (cron, every 30 min)  ->  Instagram Graph API
        ^                                  |
        +---- status updated to posted ----+
```

- A post is **due** when its `status` is `pending` and `scheduledAt` is in the past.
- After a run, the workflow commits the updated status back to the repo, so nothing is ever posted twice.
- A failed post is marked `failed` with the error message and is **not** retried automatically. This avoids duplicates. Fix the cause and set it back to `pending`.
- Only one post is published per run by default (`MAX_POSTS_PER_RUN`).

## Requirements

- An Instagram **Business or Creator** account linked to a Facebook Page you own
- A Meta developer app with the **Instagram Graph API** product
- A long-lived access token with `instagram_basic` and `instagram_content_publish`
- Media must be at a **public https URL**. The Graph API cannot upload local files. Use Cloudinary, S3, or a public repo's raw URLs.

## Setup

1. **Fork or clone this repo.**
2. **Get your credentials** (Meta developer dashboard and Graph API Explorer):
   - Generate a token with the permissions above and exchange it for a long-lived token.
   - Find your Instagram account ID: `GET /me/accounts`, then `GET /{page-id}?fields=instagram_business_account`.
3. **Add GitHub secrets** (Settings > Secrets and variables > Actions > Secrets):

   | Secret | Purpose |
   | --- | --- |
   | `INSTAGRAM_ACCESS_TOKEN` | Token used to publish |
   | `INSTAGRAM_ACCOUNT_ID` | Your Instagram business account ID |
   | `FACEBOOK_APP_ID` | Used only by the token expiry check |
   | `FACEBOOK_APP_SECRET` | Used only by the token expiry check |

   Optional **variables** (same page, Variables tab): `INSTAGRAM_API_VERSION` (default `v25.0`), `MAX_POSTS_PER_RUN` (default `1`).
4. **Allow the workflow to push:** Settings > Actions > General > Workflow permissions > *Read and write permissions*.
5. **Add posts** to `queue/posts.json` and push.
6. **Test safely:** Actions > *Publish due Instagram posts* > Run workflow (dry run is on by default).

## Queue format

```json
{
  "posts": [
    {
      "id": "launch-day",
      "type": "image",
      "imageUrl": "https://cdn.example.com/launch.jpg",
      "caption": "We're live! #launch",
      "scheduledAt": "2026-11-01T18:00:00+05:00",
      "status": "pending"
    },
    {
      "id": "behind-the-scenes",
      "type": "carousel",
      "mediaUrls": ["https://cdn.example.com/1.jpg", "https://cdn.example.com/2.jpg"],
      "caption": "A look behind the scenes",
      "scheduledAt": "2026-11-02T18:00:00+05:00",
      "status": "pending"
    },
    {
      "id": "reel-1",
      "type": "reel",
      "videoUrl": "https://cdn.example.com/reel.mp4",
      "caption": "Quick tip",
      "scheduledAt": "2026-11-03T18:00:00+05:00",
      "status": "pending"
    }
  ]
}
```

Use an explicit UTC offset in `scheduledAt` (Pakistan is `+05:00`). GitHub's cron runs in UTC and can start several minutes late, so posts go out on the first run after their scheduled time.

## Local use

```bash
cp .env.example .env      # fill it in, then load it: export $(grep -v '^#' .env | xargs)
npm run validate          # check the queue
npm run post:dry          # see what would be published
npm run post              # actually publish due posts
npm run check-token       # check token expiry
```

Requires Node 18 or newer.

## Token expiry

User tokens last about 60 days. The **Check Instagram token** workflow runs every Monday and fails (GitHub emails you) when the token is invalid or expires within 10 days. Page access tokens derived from a long-lived user token do not expire, which is the easiest way to avoid this chore.

## Limits and safety

- Instagram allows roughly 25 API-published posts per 24 hours per account. The default of 1 post per 30-minute run stays well under that.
- Use this only on accounts you own, and follow Meta's Platform Terms and Instagram's Community Guidelines. This project does not do follow/unfollow, mass commenting or DM automation, which is what typically gets accounts restricted.
- Never commit tokens. `.env` is git-ignored. In a public repo, **your queue file is public too**, so do not put unreleased content or private captions in it.

## License

MIT
