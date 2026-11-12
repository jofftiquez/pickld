#!/usr/bin/env python3
"""Reads Simulator screen recordings made by scripts/perf/record.sh (M5-02, NFR-PERF-01/02).

  python3 scripts/perf/analyze.py start <dir>    cold-*.mp4 and warm-*.mp4: launch to Today fully drawn
  python3 scripts/perf/analyze.py scroll <files>  scroll recordings: frames drawn and dropped while moving

Start: from the first frame that differs from the first one (the launch begins) to the first frame
after which every frame stays within THRESH of the last, settled frame (Today with its photos drawn).

Scroll: `simctl io recordVideo` writes a frame only when the screen changes, so while the list moves a
gap longer than 1.5 display intervals between two changed frames is a dropped frame.

Needs ffmpeg and ffprobe on PATH; standard library only.
"""
import glob
import os
import statistics
import subprocess
import sys

THRESH = 2.0  # mean absolute grey-level difference that counts as "changed"


def gray_frames(path, w, h, fps=None):
    vf = (f'fps={fps},' if fps else '') + f'scale={w}:{h},format=gray'
    args = ['ffmpeg', '-v', 'error', '-i', path, '-vf', vf] + ([] if fps else ['-fps_mode', 'passthrough'])
    raw = subprocess.run(args + ['-f', 'rawvideo', '-'], capture_output=True, check=True).stdout
    size = w * h
    return [raw[i:i + size] for i in range(0, len(raw) - size + 1, size)]


def diff(a, b):
    return sum(abs(x - y) for x, y in zip(a, b)) / len(a)


def start_ms(path, fps=60):
    f = gray_frames(path, 120, 260, fps)
    moved = next(i for i in range(len(f)) if diff(f[i], f[0]) > THRESH)
    to_last = [diff(x, f[-1]) for x in f]
    ready = len(f) - 1
    while ready > moved and to_last[ready - 1] <= THRESH:
        ready -= 1
    return (ready - moved) * 1000 / fps


def scroll(path):
    pts = [float(x.strip(',')) for x in subprocess.run(
        ['ffprobe', '-v', 'error', '-select_streams', 'v', '-show_entries', 'frame=pts_time', '-of', 'csv=p=0', path],
        capture_output=True, text=True, check=True).stdout.split()]
    f = gray_frames(path, 60, 130)
    n = min(len(pts), len(f))
    changed = [diff(f[i], f[i - 1]) > 1.0 for i in range(1, n)]
    gaps = [pts[i] - pts[i - 1] for i in range(1, n)]
    interval = statistics.median(g for g, c in zip(gaps, changed) if c)
    # Motion segments: runs of changed frames with gaps under 100 ms, at least 250 ms long.
    segs, seg = [], []
    for g, c in zip(gaps, changed):
        if c and g < 0.1:
            seg.append(g)
        elif seg:
            segs.append(seg)
            seg = []
    segs.append(seg)
    moving = [g for s in segs if sum(s) > 0.25 for g in s]
    total = sum(moving)
    expected = round(total / interval)
    dropped = sum(max(0, round(g / interval) - 1) for g in moving if g > 1.5 * interval)
    worst = max(moving) * 1000
    return f'{len(moving) / total:.1f} fps average, {dropped} of {expected} frames dropped ({100 * dropped / expected:.1f}%), ' \
           f'{total:.1f} s of motion, worst gap {worst:.0f} ms'


if __name__ == '__main__':
    mode, args = sys.argv[1], sys.argv[2:]
    if mode == 'start':
        for kind in ('cold', 'warm'):
            ms = [start_ms(p) for p in sorted(glob.glob(os.path.join(args[0], f'{kind}-*.mp4')))]
            print(f'{kind}: {[round(m) for m in ms]} ms, median {statistics.median(ms):.0f}, max {max(ms):.0f}')
    elif mode == 'scroll':
        for p in args:
            print(f'{os.path.basename(p)}: {scroll(p)}')
    else:
        sys.exit(__doc__)
