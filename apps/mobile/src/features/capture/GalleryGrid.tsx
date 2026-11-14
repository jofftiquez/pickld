import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ListRenderItem,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { PillButton } from '@/components/PillButton';
import { RoundIconButton } from '@/components/RoundIconButton';
import { formatDate, formatShortDate, formatTime } from '@/lib/format';
import { addDays, localDateIn } from '@/lib/jars';
import { captureError } from '@/lib/monitoring';
import { useLargeText } from '@/lib/useLargeText';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { textStyle } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';

import {
  GALLERY_COLUMNS,
  galleryItems,
  itemOffsets,
  needsOlder,
  targetIndex,
  type GalleryItem,
  type LibraryPhoto,
} from './galleryDays';
import {
  chooseMorePhotos,
  libraryPhotoFile,
  loadLibraryPhotos,
  onLibraryChange,
  type LibraryAccess,
} from './libraryPhotos';
import type { PickedPhoto } from './pickFromGallery';

/** Photos per library page. */
const PAGE = 240;
/** How many pages the grid loads looking for the day being filled before it opens anyway. */
const MAX_SEEK_PAGES = 25;
/** How long the date pill stays after scrolling stops. */
const PILL_HOLD_MS = 1200;
const PILL_FADE_MS = 150;

export type GalleryGridProps = {
  access: LibraryAccess;
  /** The phone's IANA zone: days are the photos' dates there, as for the moment. */
  tz: string;
  /** The past day being filled (YYYY-MM-DD): highlighted, and the grid opens there. Null for today's jar. */
  target: string | null;
  insets: EdgeInsets;
  onPick: (photo: PickedPhoto) => void;
  onClose: () => void;
  /** The library couldn't be read: the caller falls back to the system picker. */
  onUnavailable: () => void;
};

/**
 * Choose a photo (FR-CAP-02; no design, after the Crop and Camera screens): the phone's photos grouped by
 * the day they were taken, with sticky day headers and a date pill while scrolling, so someone backdating
 * can see which day they are in. The day being filled is tinted, tagged Filling and outlined, and the grid
 * opens on it. Uses only the Photos access the user already gave.
 */
export function GalleryGrid({ access, tz, target, insets, onPick, onClose, onUnavailable }: GalleryGridProps) {
  const { t } = useTranslation();
  const largeText = useLargeText();
  const reduceMotion = useReduceMotion();
  const { width, fontScale } = useWindowDimensions();
  const [today] = useState(() => localDateIn(new Date(), tz));

  const [photos, setPhotos] = useState<LibraryPhoto[] | null>(null);
  const [end, setEnd] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const loadingMore = useRef(false);

  // First load: newest first, and when filling, on until the day being filled is loaded.
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const loaded: LibraryPhoto[] = [];
        let more = true;
        for (let pages = 0; more && pages < MAX_SEEK_PAGES; pages++) {
          const page = await loadLibraryPhotos(loaded.length, PAGE);
          loaded.push(...page);
          more = page.length === PAGE;
          if (target === null || !needsOlder(loaded, target, tz)) break;
        }
        if (!alive) return;
        setPhotos(loaded);
        setEnd(!more);
      } catch (error) {
        captureError(error, { area: 'gallery' });
        if (alive) onUnavailable();
      }
    })();
    return () => {
      alive = false;
    };
  }, [target, tz, onUnavailable]);

  // Photos added, removed or shared with Pickld (Choose more) show up without reopening.
  useEffect(() => {
    if (photos === null) return;
    const count = Math.max(photos.length, PAGE);
    return onLibraryChange(() => {
      loadLibraryPhotos(0, count).then(
        (page) => {
          setPhotos(page);
          setEnd(page.length < count);
        },
        (error: unknown) => captureError(error, { area: 'gallery' }),
      );
    });
  }, [photos]);

  const loadMore = () => {
    if (photos === null || end || loadingMore.current) return;
    loadingMore.current = true;
    loadLibraryPhotos(photos.length, PAGE)
      .then((page) => {
        setPhotos((current) => [...(current ?? []), ...page]);
        if (page.length < PAGE) setEnd(true);
      })
      .catch((error: unknown) => captureError(error, { area: 'gallery' }))
      .finally(() => {
        loadingMore.current = false;
      });
  };

  const cell = (width - sizes.galleryGap * (GALLERY_COLUMNS - 1)) / GALLERY_COLUMNS;
  const rowHeight = cell + sizes.galleryGap;
  const dayHeight = Math.ceil(sizes.galleryDayHeader * Math.max(1, fontScale));
  const items = useMemo(() => (photos === null ? [] : galleryItems(photos, tz)), [photos, tz]);
  const offsets = useMemo(() => itemOffsets(items, dayHeight, rowHeight), [items, dayHeight, rowHeight]);
  const sticky = useMemo(() => items.flatMap((item, i) => (item.kind === 'day' ? [i] : [])), [items]);
  const initialIndex = useMemo(() => (target === null ? null : targetIndex(items, target)), [items, target]);

  const dayLabel = useCallback(
    (localDate: string | null): string => {
      if (localDate === null) return t('gallery.noDate');
      if (localDate === today) return t('gallery.today');
      if (localDate === addDays(today, -1)) return t('gallery.yesterday');
      const date = new Date(`${localDate}T00:00:00Z`);
      return localDate.slice(0, 4) === today.slice(0, 4) ? formatShortDate(date, 'UTC') : formatDate(date, 'UTC');
    },
    [t, today],
  );

  // The date pill: the day at the top of the grid, shown while scrolling.
  const [topDay, setTopDay] = useState<string | null | undefined>(undefined);
  const [pill] = useState(() => new Animated.Value(0));
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => clearTimeout(hideTimer.current ?? undefined), []);
  const fadePill = (to: number) =>
    Animated.timing(pill, { toValue: to, duration: reduceMotion ? 0 : PILL_FADE_MS, useNativeDriver: true }).start();
  const showPill = () => {
    clearTimeout(hideTimer.current ?? undefined);
    fadePill(1);
  };
  const hidePillSoon = () => {
    clearTimeout(hideTimer.current ?? undefined);
    hideTimer.current = setTimeout(() => fadePill(0), PILL_HOLD_MS);
  };
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;
    let lo = 0;
    let hi = items.length - 1;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if ((offsets[mid] ?? 0) <= y + 1) lo = mid;
      else hi = mid - 1;
    }
    const day = items[lo]?.localDate;
    if (day !== topDay) setTopDay(day);
  };
  const pillDay = topDay !== undefined ? topDay : items[initialIndex ?? 0]?.localDate;

  const pickPhoto = async (photo: LibraryPhoto) => {
    if (opening !== null) return;
    setOpening(photo.id);
    setFailed(false);
    try {
      onPick(await libraryPhotoFile(photo, tz));
    } catch (error) {
      captureError(error, { area: 'gallery' });
      setFailed(true);
    } finally {
      setOpening(null);
    }
  };

  const renderItem: ListRenderItem<GalleryItem> = ({ item }) => {
    const isTarget = item.localDate !== null && item.localDate === target;
    const date = dayLabel(item.localDate);
    if (item.kind === 'day') {
      return (
        <View
          style={[styles.day, { height: dayHeight }, isTarget ? styles.dayTarget : null]}
          accessible
          accessibilityRole="header"
          accessibilityLabel={isTarget ? t('gallery.dayHeaderFilling', { date }) : date}
          testID={isTarget ? 'gallery-day-target' : undefined}
        >
          <Text
            style={[textStyle('bodySmall', '700'), { color: isTarget ? colors.brandText : colors.ink }]}
            numberOfLines={1}
          >
            {date}
          </Text>
          {isTarget ? (
            <View style={styles.tag}>
              <Text style={[textStyle('caption'), { color: colors.surface }]} numberOfLines={1}>
                {t('gallery.filling')}
              </Text>
            </View>
          ) : null}
        </View>
      );
    }
    return (
      <View style={[styles.row, { height: rowHeight }]}>
        {item.photos.map((photo, column) => (
          <Pressable
            key={photo.id}
            accessibilityRole="button"
            accessibilityLabel={
              photo.creationTime === null
                ? t('gallery.photoNoDate')
                : t('gallery.photo', { date, time: formatTime(new Date(photo.creationTime), tz) })
            }
            accessibilityHint={t('gallery.photoHint')}
            accessibilityState={{ busy: opening === photo.id }}
            onPress={() => void pickPhoto(photo)}
            style={[
              styles.cell,
              { width: cell, height: cell, marginRight: column < GALLERY_COLUMNS - 1 ? sizes.galleryGap : 0 },
            ]}
            testID={`gallery-photo-${photo.id}`}
          >
            <Image
              source={{ uri: photo.id }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              recyclingKey={photo.id}
            />
            {isTarget ? <View style={styles.ring} pointerEvents="none" /> : null}
            {opening === photo.id ? (
              <View style={styles.opening}>
                <ActivityIndicator color={colors.surface} />
              </View>
            ) : null}
          </Pressable>
        ))}
      </View>
    );
  };

  const filling = target === null ? null : formatShortDate(new Date(`${target}T00:00:00Z`), 'UTC');
  const pillIsTarget = pillDay !== undefined && pillDay !== null && pillDay === target;

  return (
    <View style={styles.root} testID="gallery-grid">
      <View style={[styles.bar, { paddingTop: insets.top + space.sm }]}>
        <RoundIconButton
          icon="close"
          accessibilityLabel={t('gallery.close')}
          accessibilityHint={t('gallery.closeHint')}
          onPress={onClose}
          testID="gallery-close"
        />
        <View style={styles.titleBlock}>
          <Text style={[textStyle('cropTitle'), { color: colors.ink }]} accessibilityRole="header" numberOfLines={1}>
            {t('gallery.title')}
          </Text>
          {filling ? (
            <Text style={[textStyle('bodySmall'), { color: colors.brandText }]} numberOfLines={1}>
              {t('gallery.forDate', { date: filling })}
            </Text>
          ) : null}
        </View>
        <View style={styles.barSpacer} />
      </View>

      {access === 'limited' ? (
        <View style={[styles.banner, largeText ? styles.bannerStacked : null]}>
          <Text style={[textStyle('bodySmall'), styles.bannerText]}>{t('gallery.limited')}</Text>
          <PillButton
            label={t('gallery.chooseMore')}
            accessibilityHint={t('gallery.chooseMoreHint')}
            onPress={() => {
              chooseMorePhotos().catch((error: unknown) => captureError(error, { area: 'gallery' }));
            }}
            testID="gallery-choose-more"
          />
        </View>
      ) : null}

      {failed ? (
        <Text style={[textStyle('bodySmall'), styles.failed]} accessibilityRole="alert">
          {t('gallery.photoFailed')}
        </Text>
      ) : null}

      {photos === null ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.muted} />
        </View>
      ) : photos.length === 0 ? (
        <View style={styles.center}>
          <Text style={[textStyle('body'), { color: colors.muted }]}>{t('gallery.empty')}</Text>
        </View>
      ) : (
        <View style={styles.list}>
          <FlatList
            data={items}
            keyExtractor={(item) => item.key}
            renderItem={renderItem}
            getItemLayout={(_, index) => ({
              length: (offsets[index + 1] ?? 0) - (offsets[index] ?? 0),
              offset: offsets[index] ?? 0,
              index,
            })}
            stickyHeaderIndices={sticky}
            initialScrollIndex={initialIndex ?? undefined}
            onEndReached={loadMore}
            onEndReachedThreshold={2}
            onScroll={onScroll}
            scrollEventThrottle={16}
            onScrollBeginDrag={showPill}
            onScrollEndDrag={hidePillSoon}
            onMomentumScrollBegin={showPill}
            onMomentumScrollEnd={hidePillSoon}
            contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }}
            testID="gallery-list"
          />
          {pillDay !== undefined ? (
            <Animated.View
              pointerEvents="none"
              accessible={false}
              importantForAccessibility="no-hide-descendants"
              style={[
                styles.pill,
                { bottom: insets.bottom + space.lg, opacity: pill },
                pillIsTarget ? styles.pillTarget : null,
              ]}
            >
              <Text style={[textStyle('label'), { color: colors.surface }]} numberOfLines={1}>
                {dayLabel(pillDay)}
              </Text>
            </Animated.View>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  titleBlock: { flex: 1, alignItems: 'center' },
  barSpacer: { width: sizes.roundButton },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginHorizontal: space.md,
    marginTop: space.md,
    marginBottom: space.sm,
    paddingVertical: sizes.bannerPaddingY,
    paddingHorizontal: sizes.bannerPaddingX,
    borderRadius: radius.banner,
    backgroundColor: colors.subtle,
  },
  bannerStacked: { flexDirection: 'column', alignItems: 'flex-start' },
  bannerText: { flexShrink: 1, color: colors.inkSoft },
  failed: { color: colors.danger, paddingHorizontal: space.lg, paddingVertical: space.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xxl },
  list: { flex: 1 },
  day: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    backgroundColor: colors.galleryHeader,
  },
  dayTarget: { backgroundColor: colors.brandTint },
  // brandText, not brand: white words on the brand green miss AA (rule 12 keeps that for primary buttons).
  tag: {
    backgroundColor: colors.brandText,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: sizes.pillPaddingY,
  },
  row: { flexDirection: 'row' },
  cell: { overflow: 'hidden', backgroundColor: colors.photoPlaceholder },
  ring: { ...StyleSheet.absoluteFill, borderWidth: sizes.galleryRing, borderColor: colors.brand },
  opening: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.scrim,
  },
  pill: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: '80%',
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.badge,
  },
  pillTarget: { backgroundColor: colors.brandText },
});
