#!/bin/zsh
# Runs on the Mac with a Release build installed and signed in on the booted Simulator (M5-02).
#   zsh scripts/perf/record.sh start <runs> <outdir>   cold-N.mp4 and warm-N.mp4
#   zsh scripts/perf/record.sh scroll <runs> <outdir>  feed-N.mp4 (Maestro swipes through the Jars feed)
# Then copy <outdir> to a machine with ffmpeg and run scripts/perf/analyze.py.
set -u
MODE=$1; RUNS=$2; OUT=$3; BID=me.pickld.app; HERE=${0:A:h}
mkdir -p $OUT
rec() { xcrun simctl io booted recordVideo --codec h264 --force "$1" >/dev/null 2>&1 & RPID=$!; sleep 1.5; }
stop() { kill -INT $RPID; wait $RPID 2>/dev/null; }
for i in $(seq 1 $RUNS); do
  if [[ $MODE == start ]]; then
    # Cold: the process is killed and the app is launched again (Settings in front meanwhile).
    xcrun simctl terminate booted $BID 2>/dev/null; xcrun simctl launch booted com.apple.Preferences >/dev/null; sleep 3
    rec $OUT/cold-$i.mp4; xcrun simctl launch booted $BID >/dev/null; sleep 7; stop
    # Warm: the app is in the background and brought back.
    xcrun simctl launch booted com.apple.Preferences >/dev/null; sleep 3
    rec $OUT/warm-$i.mp4; xcrun simctl launch booted $BID >/dev/null; sleep 7; stop
  else
    rec $OUT/feed-$i.mp4; maestro test $HERE/feed-scroll.yaml >$OUT/feed-$i.log 2>&1; sleep 1; stop
  fi
done
ls $OUT
