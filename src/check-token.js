// Inspects the access token and fails loudly if it is invalid or close to expiry,
// so GitHub emails you BEFORE posting silently stops working.
//
// Needs INSTAGRAM_ACCESS_TOKEN, FACEBOOK_APP_ID and FACEBOOK_APP_SECRET.

import { API_VERSION, requireEnv } from "./graph.js";

const WARN_DAYS = Number(process.env.TOKEN_WARN_DAYS || 10);

const token = requireEnv("INSTAGRAM_ACCESS_TOKEN");
const appToken = `${requireEnv("FACEBOOK_APP_ID")}|${requireEnv("FACEBOOK_APP_SECRET")}`;

const url = new URL(`https://graph.facebook.com/${API_VERSION}/debug_token`);
url.searchParams.set("input_token", token);
url.searchParams.set("access_token", appToken);

const res = await fetch(url);
const { data, error } = await res.json();

if (error || !data) {
  console.error(`Could not inspect token: ${error?.message || "no data returned"}`);
  process.exit(1);
}
if (!data.is_valid) {
  console.error("Token is INVALID or expired. Generate a new long-lived token and update the secret.");
  process.exit(1);
}

// expires_at === 0 means the token does not expire (e.g. a Page token derived from a long-lived user token).
if (!data.expires_at) {
  console.log("Token is valid and does not expire.");
} else {
  const daysLeft = Math.floor((data.expires_at * 1000 - Date.now()) / 86_400_000);
  console.log(`Token is valid. Expires in ${daysLeft} day(s).`);
  if (daysLeft <= WARN_DAYS) {
    console.error(`Token expires in ${daysLeft} day(s) (threshold ${WARN_DAYS}). Refresh it soon.`);
    process.exit(1);
  }
}
