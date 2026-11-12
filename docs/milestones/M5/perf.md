# M5-02 · Performance measurements (NFR-PERF-01, NFR-PERF-02)

Measured on 2026-11-12, on a **Release** build (`xcodebuild -configuration Release`) running on the iPhone 17 Pro Simulator (iOS 27.2) on a mac.large satellite, against the local Supabase stack. Dale is signed in.

## Method

- **Start time:** `scripts/perf/record.sh start 5 <dir>` records the Simulator screen during each launch, and `scripts/perf/analyze.py start <dir>` reads the recordings. The time runs from the first frame that changes (the launch begins) to the frame after which nothing changes any more (Today drawn with its photos). No timer inside the app is involved.
  - Cold: the process is killed, then the app is launched again.
  - Warm: the app is in the background (Settings in front), then brought back.
- **Scroll:** `scripts/perf/feed-seed.sql` adds 59 full published jars (472 moments) from people Dale reads; `feed-seed-down.sql` removes them. `scripts/perf/record.sh scroll` records eight fast swipes down the Jars feed (`feed-scroll.yaml`). The Simulator records a frame only when the screen changes, so while the list moves, a gap longer than 1.5 display intervals counts as a dropped frame.
- **Baseline:** iOS Settings scrolled with the same swipes, to show what the Simulator itself drops.

## Results

| Measure | Target | Result |
| --- | --- | --- |
| Cold start to Today usable | ≤ 4 s | runs 2200, 2267, 2067, 2050, 2250 ms; **median 2.2 s**, max 2.27 s ✅ |
| Warm start to Today usable | ≤ 2 s | runs 817, 783, 800, 800, 800 ms; **median 0.8 s** ✅ |
| Jars feed scroll | 60 fps | 50–56 fps average, 7–8% of frames dropped, worst gap 42–53 ms (3 runs) |
| iOS Settings scroll (baseline) | — | 60 fps average, 2% dropped, worst gap 33 ms |
| My days calendar | 60 fps | One month fits on about one screen, so there is little to scroll. Not measured separately |

Most of the cold start is the splash screen while the JS bundle and fonts load. Today renders on its first frame after the splash, with no loading state.

## What was tried on the feed

Each change was built in Release and measured over 3 runs. None moved the dropped-frame rate outside the 7–8% range of the unchanged build, so none was kept:

| Change | Dropped frames |
| --- | --- |
| None (baseline build) | 8.1%, 7.5%, 7.2% |
| `FeedJarCard` memoised, stable `renderItem` and `onPress` | 7.4%, 8.2%, 8.3% |
| No image fade-in (`transition={0}`) and no card shadow | 7.4%, 7.1%, 7.8% |
| `maxToRenderPerBatch={2}` | 8.4%, 8.4%, 7.0% |

The drops come in short runs of ~33 ms frames right after each swipe starts, then the list moves at a steady 60 fps. The Simulator renders on the Mac's GPU and decodes images in software, so it isn't a reliable measure of a phone's frame rate.

## Still needed

- **The 60 fps scroll check needs a real device:** an iPhone (Instruments › Animation Hitches) and a mid-range Android phone (Android captures are missing, D-15). Run `scripts/perf/feed-seed.sql` locally or the equivalent on staging first. If a device shows hitches, profile before changing code; the experiments above are the first things to try.
- Start times on an older phone (for example an iPhone 12 or a Pixel 6a).
