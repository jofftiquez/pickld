import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/Card';
import { DangerButton } from '@/components/DangerButton';
import { Icon } from '@/components/Icon';
import { PillButton } from '@/components/PillButton';
import { RoundIconButton } from '@/components/RoundIconButton';
import { TextField } from '@/components/TextField';
import { formatShortDate, formatTime } from '@/lib/format';
import { hitSlopFor } from '@/lib/hitSlop';
import { textStyle } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';

import { canDelete, type ExportCard } from './deleteModel';

export type DeleteAccountViewProps = {
  insets: EdgeInsets;
  /** Null while unknown: the body then names no numbers. */
  counts: { jars: number; moments: number } | null;
  exportCard: ExportCard;
  exportBusy: boolean;
  deleting: boolean;
  error: 'delete' | 'export' | null;
  onBack: () => void;
  onRequestExport: () => void;
  onOpenExport: (url: string) => void;
  onDelete: () => void;
};

/** Delete account (FR-PRV-02, FR-PRV-03; design: Delete). The button turns on only once DELETE is typed. */
export function DeleteAccountView(props: DeleteAccountViewProps) {
  const { t } = useTranslation();
  const { insets, counts, exportCard: card } = props;
  const [typed, setTyped] = useState('');
  const armed = canDelete(typed) && !props.deleting;

  const exportText =
    card.kind === 'preparing'
      ? t('deleteAccount.export.pending')
      : card.kind === 'ready'
        ? t('deleteAccount.export.done', {
            // The link lasts 24 hours, so the day matters as much as the time.
            date: card.expiresAt ? formatShortDate(new Date(card.expiresAt)) : '',
            time: card.expiresAt ? formatTime(new Date(card.expiresAt)) : '',
          })
        : card.kind === 'failed'
          ? t('deleteAccount.export.failed')
          : t('deleteAccount.export.none');

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { paddingTop: insets.top }]}
      testID="delete-screen"
    >
      <View style={styles.header}>
        <RoundIconButton
          icon="back"
          accessibilityLabel={t('deleteAccount.back')}
          onPress={props.onBack}
          testID="delete-back"
        />
        <Text accessibilityRole="header" style={[textStyle('cropTitle'), { color: colors.ink }]}>
          {t('deleteAccount.title')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.warning}>
          <Icon name="warning" size={28} strokeWidth={2} color="danger" />
        </View>
        <Text accessibilityRole="header" style={[textStyle('screenTitle'), styles.heading]}>
          {t('deleteAccount.heading')}
        </Text>
        <Text style={[textStyle('body'), styles.body]} testID="delete-body">
          {counts
            ? t('deleteAccount.body', {
                jars: t('deleteAccount.jars', { count: counts.jars }),
                moments: t('deleteAccount.moments', { count: counts.moments }),
              })
            : t('deleteAccount.bodyUnknown')}
        </Text>

        <Card style={styles.exportCard} testID="delete-export">
          <View style={styles.exportIcon}>
            <Icon name="download" size={20} strokeWidth={2} />
          </View>
          <View style={styles.exportText}>
            <Text style={[textStyle('cardTitle', '800'), { color: colors.ink }]}>{t('deleteAccount.keep')}</Text>
            <Text style={[textStyle('bodySmall'), { color: colors.muted }]} testID="delete-export-status">
              {exportText}
            </Text>
          </View>
          {card.kind === 'ready' ? (
            <PillButton
              label={t('deleteAccount.open')}
              accessibilityLabel={t('deleteAccount.openLabel')}
              onPress={() => props.onOpenExport(card.url)}
              testID="delete-export-open"
            />
          ) : (
            <PillButton
              variant="subtle"
              label={
                card.kind === 'preparing'
                  ? t('deleteAccount.preparing')
                  : card.kind === 'failed'
                    ? t('deleteAccount.retry')
                    : t('deleteAccount.download')
              }
              accessibilityLabel={t('deleteAccount.downloadLabel')}
              disabled={card.kind === 'preparing' || props.exportBusy}
              onPress={props.onRequestExport}
              testID="delete-export-request"
            />
          )}
        </Card>

        <TextField
          label={t('deleteAccount.confirmLabel')}
          value={typed}
          onChangeText={setTyped}
          placeholder={t('deleteAccount.confirmWord')}
          accessibilityHint={t('deleteAccount.confirmHint')}
          autoCapitalize="characters"
          autoComplete="off"
          testID="delete-confirm"
        />
        {props.error ? (
          <Text accessibilityRole="alert" style={[textStyle('bodySmall', '600'), styles.error]} testID="delete-error">
            {props.error === 'delete' ? t('deleteAccount.failed') : t('deleteAccount.exportFailed')}
          </Text>
        ) : null}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + space.lg }]}>
        <DangerButton
          label={t('deleteAccount.delete')}
          disabled={!armed}
          onPress={props.onDelete}
          testID="delete-submit"
        />
        <Pressable
          accessibilityRole="button"
          onPress={props.onBack}
          hitSlop={hitSlopFor(undefined, 20)}
          style={styles.keep}
          testID="delete-keep"
        >
          <Text style={[textStyle('body', '700'), styles.link]}>{t('deleteAccount.keepAccount')}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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
  content: { paddingHorizontal: space.xxl, paddingTop: space.lg, gap: space.md },
  warning: {
    width: sizes.permissionIcon + 10,
    height: sizes.permissionIcon + 10,
    borderRadius: radius.permissionIcon + 2,
    backgroundColor: colors.dangerTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: { color: colors.ink, marginTop: space.sm },
  body: { color: colors.inkSoft, lineHeight: 23 },
  exportCard: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.xs },
  exportIcon: {
    width: sizes.permissionIcon,
    height: sizes.permissionIcon,
    borderRadius: radius.permissionIcon,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportText: { flex: 1, gap: 2 },
  error: { color: colors.danger },
  footer: { paddingHorizontal: space.xxl, gap: space.md, alignItems: 'center' },
  keep: { paddingVertical: space.xs },
  link: { color: colors.brandLink, textDecorationLine: 'underline' },
});
