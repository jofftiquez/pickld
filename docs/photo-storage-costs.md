# Photo storage cost review (M6-12, T-505)

**Recommendation:** stay on Cloudflare R2. Review again once the R2 bill passes about **$100 a month**. At that point, moving storage to Backblaze B2 behind Cloudflare would save roughly half of the storage bill, about $55 a month. That's worth a day of work then, but not before. Nothing needs to change now.

Prices checked on 12 Nov 2026 against the [R2 pricing page](https://developers.cloudflare.com/r2/pricing) (updated 30 Oct 2026) and Backblaze's B2 price list (captured 31 Oct 2026). All figures are USD and exclude tax.

## What a moment costs to keep

The app uploads two WebP files for each moment (`src/lib/image/pipeline.ts`): the photo at 1440×1920, quality 0.85, and a thumbnail at 480×640, quality 0.8. Assume about **0.45 MB per moment**: roughly 400 KB for the photo and 45 KB for the thumbnail. That's an estimate. Replace it with the real average from the bucket's metrics once there is traffic. Objects are never overwritten, so storage only grows, except when people delete moments or accounts.

| Daily users (filling 4 slots a day on average) | Photos added a month | Storage after 12 months |
| ---------------------------------------------- | -------------------- | ----------------------- |
| 1,000                                          | about 53 GB          | about 0.6 TB            |
| 10,000                                         | about 530 GB         | about 6.4 TB            |
| 50,000                                         | about 2.7 TB         | about 32 TB             |

## R2 and B2 side by side

|                             | Cloudflare R2 (Standard)                        | Backblaze B2 behind Cloudflare                                                       |
| --------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------ |
| Storage                     | $0.015 per GB-month (first 10 GB free)          | $0.00695 per GB-month ($6.95 per TB; first 10 GB free)                               |
| Uploads (2 per moment)      | $4.50 per million after 1 million free a month  | Free                                                                                 |
| Reads by the photo Worker   | $0.36 per million after 10 million free a month | Free                                                                                 |
| Bandwidth to viewers        | Free                                            | Free through Cloudflare (Bandwidth Alliance); other egress free up to 3× stored data |
| How the Worker reads photos | R2 binding (today)                              | A signed S3 `GET` to B2 (`_shared/sigv4.ts` already signs requests)                  |

Cloudflare Worker requests and the CDN cost the same either way, so they aren't included.

## When the bill reaches $100

R2 storage reaches $100 a month at about **6.7 TB**. That's about 12–13 months in at 10,000 daily users. At that size:

| Monthly cost                                                  | R2             | B2 behind Cloudflare |
| ------------------------------------------------------------- | -------------- | -------------------- |
| Storage (6.7 TB)                                              | about $100     | about $46            |
| Uploads (about 2.4 million)                                   | about $6       | $0                   |
| Reads (about 15 million: 10,000 users × 50 photo views a day) | about $2       | $0                   |
| **Total**                                                     | **about $108** | **about $46**        |

B2 is about **45% of R2's storage price**, which works out to a little under half of the bill. The architecture plan's earlier figure was "about a third", so it has been updated. The saving grows in step with storage: about $260 a month at 32 TB.

## What a move would take

- **Uploads and deletes:** `fn:upload-url`, account deletion and data export already speak plain S3 through `_shared/sigv4.ts`. Point the S3 settings at a B2 bucket; no code changes.
- **Photo Worker:** swap the R2 binding for signed `GET`s to B2 (the SigV4 helper exists). This adds one round trip on cache misses. Keep the token check and the private bucket exactly as they are (D-12).
- **Existing photos:** copy the bucket once (for example with `rclone`), then switch the Worker. Objects are never overwritten, so a copy followed by a short catch-up pass is safe. Copying 6.7 TB (about 30 million objects) out of R2 costs nothing in bandwidth and about $10 in read operations.
- **Safety:** the CSAM Scanning Tool works on images served through Cloudflare's cache, whatever the origin, so it keeps working. Location data is already stripped before upload.
- **Two vendors instead of one:** a second account, a second key to rotate, and a separate outage risk. This is the main reason not to move early.

## Cheaper options that don't need a move

- **R2 Infrequent Access** ($0.01 per GB-month) for photos older than about 90 days, set with an R2 lifecycle rule. Old jars are opened rarely, but each read adds a $0.01 per GB retrieval fee and there's a 30-day minimum. This saves about a third of storage on old photos with no code change. Try it before B2, once older jars make up most of the storage.
- **Measure first:** if real photos average more than 0.45 MB, lowering `FULL_QUALITY` from 0.85 to 0.8 shrinks every photo, whatever the vendor.
