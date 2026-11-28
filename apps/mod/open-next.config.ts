import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// The moderation console on Cloudflare Workers, next to pickld.me (scripts/deploy/web.sh). No incremental
// cache: every console page is rendered per request for the signed-in moderator.
export default defineCloudflareConfig();
