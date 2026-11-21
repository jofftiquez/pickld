import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// pickld.me on Cloudflare Workers (docs/runbooks/staging.md, "Web site"). No incremental cache: the pages are
// either prerendered at build or rendered per request.
export default defineCloudflareConfig();
