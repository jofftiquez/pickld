# Pickld

A photo diary for the day you actually had. Each day you fill a jar with up to eight moments, one per slot (where you are, what keeps you busy, who you're with, your outfit, a selfie, morning, afternoon and evening). The people who read you see your day as it happened.

**Your people, in order.** The Moments and Jars tabs show only the people you read, newest first. Likes never move a post up, and nothing you didn't choose is mixed in. Discover is separate: it starts with people your authors read, then everyone else who posts publicly, also newest first. Read more at [pickld.me/why](https://pickld.me/why) and [pickld.me/mission](https://pickld.me/mission).

## What's here

| Path | What it is |
| --- | --- |
| `apps/mobile` | The iPhone app (Expo, React Native, TypeScript) |
| `apps/web` | pickld.me: marketing pages and shared links (Next.js) |
| `apps/mod` | The moderation console (Next.js) |
| `supabase` | Postgres schema, row-level security, pgTAP tests and Edge Functions ([README](supabase/README.md)) |
| `workers/photos` | The photo delivery worker ([README](workers/photos/README.md)) |

## Develop

```sh
pnpm install
pnpm db:start        # local Supabase (Docker)
pnpm db:reset        # apply migrations and seed data
pnpm typecheck && pnpm lint && pnpm test && pnpm db:test
```

Contributors and coding agents: read [AGENTS.md](AGENTS.md) first. It covers the product principles, the non-negotiable rules and the conventions.
