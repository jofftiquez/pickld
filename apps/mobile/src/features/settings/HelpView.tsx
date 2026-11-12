import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/icons';
import { PillButton } from '@/components/PillButton';
import { RoundIconButton } from '@/components/RoundIconButton';
import { hitSlopFor } from '@/lib/hitSlop';
import { textStyle } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';

import { searchFaq, type Faq } from './helpModel';

export type HelpViewProps = {
  insets: EdgeInsets;
  /** Shown when no mail app could open the email; carries the address to write to. */
  noMail: string | null;
  onBack: () => void;
  onContact: () => void;
  onFeedback: () => void;
  onGuidelines: () => void;
};

/** Help & feedback (FR-SET-02; design: Help). The sticker restore question waits for sticker sales (D-6). */
export function HelpView({ insets, noMail, onBack, onContact, onFeedback, onGuidelines }: HelpViewProps) {
  const { t } = useTranslation();
  const faq = t('help.faq', { returnObjects: true }) as unknown as Faq[];
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const shown = searchFaq(faq, query);

  const action = (o: {
    icon: IconName;
    tint: boolean;
    title: string;
    body: string;
    label: string;
    a11y: string;
    primary: boolean;
    onPress: () => void;
    testID: string;
  }) => (
    <Card style={styles.actionCard}>
      <View style={[styles.actionIcon, { backgroundColor: o.tint ? colors.brandTint : colors.subtle }]}>
        <Icon name={o.icon} size={20} strokeWidth={1.8} />
      </View>
      <View style={styles.actionText}>
        <Text style={[textStyle('cardTitle', '800'), { color: colors.ink }]}>{o.title}</Text>
        <Text style={[textStyle('bodySmall'), { color: colors.muted }]}>{o.body}</Text>
      </View>
      <PillButton
        label={o.label}
        accessibilityLabel={o.a11y}
        variant={o.primary ? 'primary' : 'subtle'}
        onPress={o.onPress}
        testID={o.testID}
      />
    </Card>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} testID="help-screen">
      <View style={styles.header}>
        <RoundIconButton icon="back" accessibilityLabel={t('help.back')} onPress={onBack} testID="help-back" />
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          accessibilityRole="header"
          style={[textStyle('cropTitle'), styles.headerTitle, { color: colors.ink }]}
        >
          {t('help.title')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}
      >
        <View style={styles.search}>
          <Icon name="search" size={20} strokeWidth={2} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('help.search')}
            placeholderTextColor={colors.muted}
            accessibilityLabel={t('help.searchLabel')}
            returnKeyType="search"
            autoCorrect={false}
            style={[textStyle('body'), styles.searchInput]}
            testID="help-search"
          />
        </View>

        <Text accessibilityRole="header" style={[textStyle('bodySmall', '700'), styles.section]}>
          {t('help.common')}
        </Text>
        {shown.length === 0 ? (
          <Text style={[textStyle('bodySmall'), styles.empty]} testID="help-no-results">
            {t('help.noResults', { query: query.trim() })}
          </Text>
        ) : (
          <Card style={styles.listCard}>
            {shown.map((f, i) => {
              const expanded = open === f.q;
              return (
                <View key={f.q} style={i < shown.length - 1 ? styles.divider : undefined}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={f.q}
                    accessibilityState={{ expanded }}
                    onPress={() => setOpen(expanded ? null : f.q)}
                    style={styles.question}
                    testID={`help-faq-${i}`}
                  >
                    <Text style={[textStyle('body', '600'), styles.questionText]}>{f.q}</Text>
                    <View style={expanded ? styles.chevronOpen : undefined}>
                      <Icon name="chevronRight" size={18} strokeWidth={2} />
                    </View>
                  </Pressable>
                  {expanded ? (
                    <Text style={[textStyle('bodySmall'), styles.answer]} testID={`help-faq-${i}-answer`}>
                      {f.a}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </Card>
        )}

        <Text accessibilityRole="header" style={[textStyle('bodySmall', '700'), styles.section]}>
          {t('help.stuck')}
        </Text>
        {action({
          icon: 'comment',
          tint: true,
          title: t('help.contact'),
          body: t('help.contactBody'),
          label: t('help.contactAction'),
          a11y: t('help.contactLabel'),
          primary: true,
          onPress: onContact,
          testID: 'help-contact',
        })}
        {action({
          icon: 'sparkle',
          tint: false,
          title: t('help.feedback'),
          body: t('help.feedbackBody'),
          label: t('help.feedbackAction'),
          a11y: t('help.feedbackLabel'),
          primary: false,
          onPress: onFeedback,
          testID: 'help-feedback',
        })}
        {noMail ? (
          <Text accessibilityRole="alert" selectable style={[textStyle('bodySmall', '600'), styles.noMail]}>
            {noMail}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t('help.guidelines')}
          onPress={onGuidelines}
          hitSlop={hitSlopFor(undefined, 20)}
          style={styles.guidelines}
          testID="help-guidelines"
        >
          <Text style={[textStyle('body', '700'), styles.link]}>{t('help.guidelines')}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Shrinks to fit one line at large text instead of pushing the header's buttons off screen (D-37).
  headerTitle: { flexShrink: 1 },
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.xxl,
    paddingBottom: space.md,
  },
  headerSpacer: { width: sizes.roundButton },
  content: { paddingHorizontal: space.xl, gap: space.sm + 2 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm + 2,
    minHeight: sizes.textField,
    paddingHorizontal: space.lg,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
  },
  searchInput: { flex: 1, color: colors.ink, paddingVertical: space.sm },
  section: { color: colors.muted, marginTop: space.sm, marginHorizontal: space.xs },
  listCard: { paddingVertical: 2 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  question: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48, paddingVertical: space.sm },
  questionText: { flex: 1, color: colors.ink },
  chevronOpen: { transform: [{ rotate: '90deg' }] },
  answer: { color: colors.inkSoft, paddingBottom: space.md, lineHeight: 19 },
  empty: { color: colors.muted, marginHorizontal: space.xs },
  actionCard: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  actionIcon: {
    width: sizes.permissionIcon,
    height: sizes.permissionIcon,
    borderRadius: radius.permissionIcon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { flex: 1, gap: 2 },
  noMail: { color: colors.danger, marginHorizontal: space.xs },
  guidelines: { alignSelf: 'center', marginTop: space.sm },
  link: { color: colors.brandLink, textDecorationLine: 'underline' },
});
