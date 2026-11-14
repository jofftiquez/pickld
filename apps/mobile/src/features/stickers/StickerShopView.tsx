import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { SecondaryButton } from '@/components/SecondaryButton';
import { deviceLocale } from '@/lib/format';
import { textStyle } from '@/theme/text';
import { colors, radius, shadow, space, stickerShop, stickerTool } from '@/theme/tokens';

import { BANNER_LAYOUTS, CARD_LAYOUTS, PackArt } from './PackArt';
import type { Shop, ShopPack } from './shop';

export type StickerShopViewProps = {
  /** Undefined while the first load runs. */
  shop: Shop | undefined;
  failed?: boolean;
  /** Store prices by product id; a pack without one shows no price. */
  prices: ReadonlyMap<string, string>;
  query: string;
  onQuery: (query: string) => void;
  insets: EdgeInsets;
  onOpenPack: (pack: ShopPack) => void;
  onRetry: () => void;
  locale?: string;
};

/**
 * The Sticker shop (StickerShop; FR-STK-06): search, the seasonal pack on sale, "For you" (paid packs that
 * match the onboarding answers first) and "Yours" (owned and earned packs). Every pack opens Pack preview.
 * The Stickers page shows it under Shop (D-61) and draws the title above it.
 */
export function StickerShopView({
  shop,
  failed = false,
  prices,
  query,
  onQuery,
  insets,
  onOpenPack,
  onRetry,
  locale = deviceLocale(),
}: StickerShopViewProps) {
  const { t } = useTranslation();
  const priceOf = (pack: ShopPack) => (pack.productId === null ? undefined : prices.get(pack.productId));
  const reason = (r: Shop['reasons'][number]) => t(`setup.people.options.${r.group}.${r.key}`, { defaultValue: r.key });
  const empty = shop !== undefined && !shop.seasonal && shop.forYou.length === 0 && shop.yours.length === 0;

  return (
    <View style={styles.screen} testID="sticker-shop">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}
      >
        <View style={styles.search}>
          <Icon name="search" size={18} color="muted" />
          <TextInput
            value={query}
            onChangeText={onQuery}
            placeholder={t('stickerShop.search')}
            placeholderTextColor={colors.muted}
            accessibilityLabel={t('stickerShop.searchLabel')}
            returnKeyType="search"
            autoCorrect={false}
            style={[textStyle('body'), styles.searchInput]}
            testID="sticker-shop-search"
          />
        </View>

        {shop === undefined ? (
          <View style={styles.message}>
            <Text style={[textStyle('body'), styles.center]}>
              {failed ? t('stickerShop.failed') : t('stickerShop.loading')}
            </Text>
            {failed ? (
              <SecondaryButton label={t('stickerShop.retry')} onPress={onRetry} testID="sticker-shop-retry" />
            ) : null}
          </View>
        ) : empty ? (
          <Text style={[textStyle('body'), styles.center, styles.message]} testID="sticker-shop-no-results">
            {t('stickerShop.noResults', { query: query.trim() })}
          </Text>
        ) : (
          <>
            {shop.seasonal ? (
              <SeasonalBanner pack={shop.seasonal} price={priceOf(shop.seasonal)} locale={locale} onOpen={onOpenPack} />
            ) : null}

            {shop.forYou.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHead}>
                  <Text accessibilityRole="header" style={[textStyle('cardTitle'), { color: colors.ink }]}>
                    {t('stickerShop.forYou')}
                  </Text>
                  {shop.reasons.length > 0 ? (
                    <Text style={[textStyle('label', '500'), styles.reason]} numberOfLines={1}>
                      {shop.reasons.length === 1
                        ? t('stickerShop.because1', { a: reason(shop.reasons[0]!) })
                        : t('stickerShop.because2', { a: reason(shop.reasons[0]!), b: reason(shop.reasons[1]!) })}
                    </Text>
                  ) : null}
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.rowScroller}
                  contentContainerStyle={styles.row}
                  testID="sticker-shop-for-you"
                >
                  {shop.forYou.map((pack) => (
                    <PackCard
                      key={pack.id}
                      pack={pack}
                      price={priceOf(pack)}
                      style={{ width: stickerShop.cardWidth }}
                      onOpen={onOpenPack}
                    />
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {shop.yours.length > 0 ? (
              <View style={styles.section}>
                <Text accessibilityRole="header" style={[textStyle('cardTitle'), styles.yoursTitle]}>
                  {t('stickerShop.yours')}
                </Text>
                <View style={styles.grid} testID="sticker-shop-yours">
                  {pairs(shop.yours).map((pair) => (
                    <View key={pair.map((p) => p.id).join()} style={styles.gridRow}>
                      {pair.map((pack) => (
                        <PackCard key={pack.id} pack={pack} style={styles.gridCard} onOpen={onOpenPack} />
                      ))}
                      {pair.length === 1 ? <View style={styles.gridCard} /> : null}
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function pairs<T>(items: readonly T[]): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  return rows;
}

function SeasonalBanner({
  pack,
  price,
  locale,
  onOpen,
}: {
  pack: ShopPack;
  price: string | undefined;
  locale: string;
  onOpen: (pack: ShopPack) => void;
}) {
  const { t } = useTranslation();
  // available_to is the first instant off sale; the last day on sale is the day before, in Manila (0029).
  const until =
    pack.availableTo === null
      ? null
      : new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' }).format(
          new Date(Date.parse(pack.availableTo) - 1),
        );
  const blurb = pack.description?.split('. ')[0]?.replace(/\.$/, '') ?? null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        price
          ? t('stickerShop.packLabel', { name: pack.name, count: pack.stickerCount, price })
          : t('stickerShop.packName', { name: pack.name, count: pack.stickerCount })
      }
      accessibilityHint={t('stickerShop.openHint')}
      onPress={() => onOpen(pack)}
      style={styles.banner}
      testID={`sticker-shop-seasonal-${pack.slug}`}
    >
      <View style={styles.bannerText}>
        <Text style={[textStyle('caption', '800'), styles.eyebrow]} numberOfLines={1}>
          {until === null ? t('stickerShop.limited') : t('stickerShop.limitedUntil', { date: until })}
        </Text>
        <Text style={[textStyle('noticeTitle'), styles.bannerTitle]} numberOfLines={1}>
          {pack.name}
        </Text>
        {blurb ? (
          <Text style={[textStyle('bodySmall', '400'), styles.bannerBlurb]} numberOfLines={1}>
            {blurb}
          </Text>
        ) : null}
      </View>
      {/* Over the text, as designed: the blurb runs under the stickers. */}
      <PackArt samples={pack.stickers} layouts={BANNER_LAYOUTS} />
      {price ? (
        <View style={styles.bannerPrice}>
          <Text style={[textStyle('label', '800'), { color: stickerShop.seasonal }]}>{price}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function PackCard({
  pack,
  price,
  style,
  onOpen,
}: {
  pack: ShopPack;
  price?: string | undefined;
  style: object;
  onOpen: (pack: ShopPack) => void;
}) {
  const { t } = useTranslation();
  const earned = pack.owned && pack.tier === 'earned';
  const status = pack.owned ? (earned ? t('stickerShop.earned') : t('stickerShop.owned')) : price;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        status
          ? t('stickerShop.packLabel', { name: pack.name, count: pack.stickerCount, price: status })
          : t('stickerShop.packName', { name: pack.name, count: pack.stickerCount })
      }
      accessibilityHint={t('stickerShop.openHint')}
      onPress={() => onOpen(pack)}
      style={[styles.card, style]}
      testID={`sticker-shop-pack-${pack.slug}`}
    >
      <View
        style={[
          styles.cardArt,
          {
            backgroundColor: pack.owned
              ? stickerShop.ownedTint
              : (stickerTool.packTint[pack.slug] ?? stickerTool.packTintDefault),
          },
        ]}
      >
        <PackArt samples={pack.stickers} layouts={CARD_LAYOUTS} testID={`sticker-shop-art-${pack.slug}`} />
      </View>
      <View style={styles.cardFoot}>
        <View style={styles.cardName}>
          <Text style={[textStyle('bodyMedium', '700'), { color: colors.ink }]} numberOfLines={2}>
            {pack.name}
          </Text>
          <Text style={[textStyle('caption', '500'), { color: colors.muted }]}>
            {t('stickerShop.count', { count: pack.stickerCount })}
          </Text>
        </View>
        {pack.owned ? (
          earned ? (
            <View style={styles.earned}>
              <Text style={[textStyle('label', '700'), { color: colors.brandText }]}>{t('stickerShop.earned')}</Text>
            </View>
          ) : (
            <View style={styles.owned}>
              <Icon name="check" size={14} strokeWidth={2.6} color="brandText" />
              <Text style={[textStyle('label', '700'), { color: colors.brandText }]}>{t('stickerShop.owned')}</Text>
            </View>
          )
        ) : price ? (
          <View style={styles.price}>
            <Text style={[textStyle('label', '800'), { color: colors.surface }]}>{price}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: space.xl, gap: space.md + 2 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: stickerShop.searchHeight,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
    paddingHorizontal: space.md + 2,
    ...shadow.card,
  },
  searchInput: { flex: 1, color: colors.ink, paddingVertical: space.sm },
  message: { gap: space.md, paddingVertical: space.xxl },
  center: { textAlign: 'center', color: colors.muted },
  banner: {
    height: stickerShop.bannerHeight,
    borderRadius: stickerShop.bannerRadius,
    backgroundColor: stickerShop.seasonal,
    overflow: 'hidden',
  },
  bannerText: { position: 'absolute', left: 18, top: 16, right: 18, gap: 2 },
  eyebrow: { color: stickerShop.seasonalEyebrow, letterSpacing: 0.88, textTransform: 'uppercase' },
  bannerTitle: { color: colors.surface },
  bannerBlurb: { color: stickerShop.seasonalText },
  bannerPrice: {
    position: 'absolute',
    left: 18,
    bottom: 16,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  section: { gap: space.md },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.sm },
  reason: { color: colors.muted, flexShrink: 1 },
  rowScroller: { marginRight: -space.xl },
  row: { gap: space.md, paddingRight: space.xl },
  yoursTitle: { color: colors.ink, marginTop: space.xs },
  grid: { gap: space.lg },
  gridRow: { flexDirection: 'row', gap: space.md },
  gridCard: { flex: 1 },
  card: { gap: space.sm },
  cardArt: { height: stickerShop.cardArtHeight, borderRadius: stickerShop.cardRadius, overflow: 'hidden' },
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  cardName: { flex: 1 },
  price: { backgroundColor: colors.brand, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  owned: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  earned: { backgroundColor: colors.brandTint, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
});
