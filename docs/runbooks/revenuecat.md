# RevenueCat setup (founders)

Sticker pack purchases (FR-STK-07) go through RevenueCat. The code works against its sandbox; these steps need the founders' accounts. Nothing here is paid until real products go on sale.

1. **Project:** create a RevenueCat project with an iOS app for `me.pickld.app` (and later Android). Connect App Store Connect (in-app purchase key) so RevenueCat can verify receipts.
2. **Products:** in App Store Connect, create one **non-consumable** in-app purchase per paid pack. Its product id must equal the pack's `sticker_packs.store_product_id` (for example `me.pickld.pack.<slug>`). Add the products to RevenueCat. No entitlements or offerings are needed: Pickld reads purchases by product id.
3. **Webhook:** Project settings → Integrations → Webhooks:
   - URL: `https://<project>.supabase.co/functions/v1/revenuecat-webhook`
   - Authorization header: `Bearer <REVENUECAT_WEBHOOK_SECRET>` (generate with `openssl rand -hex 32`)
   - Environments: both sandbox and production.
4. **Secrets** on each Supabase project: `supabase secrets set REVENUECAT_WEBHOOK_SECRET=… REVENUECAT_SECRET_KEY=…` (the project's secret API key, v1; never put it in the app or the repo).
5. **Deploy** with `supabase functions deploy revenuecat-webhook` (its `verify_jwt = false` comes from `supabase/config.toml`; the function checks the shared secret itself).
6. **Check:** "Send test event" in the dashboard should answer 200.

How it works: the webhook only says _who_ bought. The function reads that user's verified one-time purchases from RevenueCat's REST API and makes their `purchase` rows in `owned_packs` match (`store_purchases_sync`, migration 0028), so refunds and restores to another account take a pack away and a forged event can't grant one. Sandbox receipts unlock packs except where `APP_ENV=production`.
