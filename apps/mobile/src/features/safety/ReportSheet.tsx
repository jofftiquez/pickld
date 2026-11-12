import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { PrimaryButton } from '@/components/PrimaryButton';
import { RadioRow } from '@/components/RadioRow';
import { SecondaryButton } from '@/components/SecondaryButton';
import { textStyle } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';

import { REPORT_REASONS, ReportError, useReport, type ReportReason, type ReportTarget } from './submitReport';

export type ReportSheetProps = {
  visible: boolean;
  /** What is reported; null while closed. */
  subject: { target: ReportTarget; targetId: string } | null;
  /** The person whose content or account it is, e.g. "Mika Reyes". */
  name: string;
  onClose: () => void;
  /** Opens Block for the same person (M3-22): the Block tab and Also block. Hidden when absent. */
  onBlock?: () => void;
};

/**
 * Report (Report) and Report sent (ReportThanks) in one sheet, for jars, moments, comments and profiles
 * (FR-SAF-01): seven reasons, then thanks with Also block and Done. The person never learns who reported.
 */
export function ReportSheet({ visible, subject, name, onClose, onBlock }: ReportSheetProps) {
  const { t } = useTranslation();
  const report = useReport();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const firstName = name.trim().split(/\s+/)[0] ?? name;
  const close = () => {
    onClose();
    setReason(null);
    report.reset();
  };
  // Block opens once the sheet is fully gone: iOS can't present its dialog over a dismissing sheet.
  const blockAfterClose = useRef(false);
  const closeThenBlock = () => {
    blockAfterClose.current = true;
    close();
  };
  const error = report.error instanceof ReportError ? report.error.kind : report.error ? 'failed' : null;

  return (
    <BottomSheet
      visible={visible}
      onClose={close}
      onClosed={() => {
        if (blockAfterClose.current) {
          blockAfterClose.current = false;
          onBlock?.();
        }
      }}
      accessibilityLabel={t('report.title')}
      testID="report-sheet"
    >
      {report.isSuccess && subject ? (
        <View style={styles.sent} testID="report-sent">
          <View style={styles.check}>
            <Icon name="check" color="brandText" size={28} strokeWidth={2.4} />
          </View>
          <Text accessibilityRole="header" style={[textStyle('profileName'), styles.center, { color: colors.ink }]}>
            {t('report.sentTitle')}
          </Text>
          <Text style={[textStyle('bodyMedium'), styles.center, styles.sentBody]}>
            {t(`report.sentBody.${subject.target}`, { name: firstName })}
          </Text>
          <View style={styles.actions}>
            {onBlock ? (
              <SecondaryButton
                variant="outlineDanger"
                label={t('report.alsoBlock', { name: firstName })}
                onPress={closeThenBlock}
                testID="report-also-block"
              />
            ) : null}
            <PrimaryButton label={t('report.done')} onPress={close} testID="report-done" />
          </View>
        </View>
      ) : (
        <View style={styles.form}>
          {onBlock ? (
            <View style={styles.tabs}>
              <View
                style={[styles.tab, { backgroundColor: colors.dangerTint }]}
                accessibilityState={{ selected: true }}
              >
                <Text style={[textStyle('bodyMedium', '700'), { color: colors.danger }]}>{t('report.tab')}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('report.blockTab')}
                onPress={closeThenBlock}
                style={[styles.tab, { backgroundColor: colors.subtle }]}
                testID="report-block-tab"
              >
                <Text style={[textStyle('bodyMedium', '700'), { color: colors.ink }]}>{t('report.blockTab')}</Text>
              </Pressable>
            </View>
          ) : null}
          <Text accessibilityRole="header" style={[textStyle('sectionTitle'), { color: colors.ink }]}>
            {t('report.title')}
          </Text>
          <Text style={[textStyle('bodySmall'), { color: colors.muted }]}>
            {t('report.anonymous', { name: firstName })}
          </Text>
          <View accessibilityRole="radiogroup">
            {REPORT_REASONS.map((r, i) => (
              <RadioRow
                key={r}
                label={t(`report.reason.${r}`)}
                selected={reason === r}
                onSelect={() => setReason(r)}
                divider={i < REPORT_REASONS.length - 1}
                testID={`report-reason-${r}`}
              />
            ))}
          </View>
          {error ? (
            <Text accessibilityRole="alert" style={[textStyle('bodySmall', '600'), { color: colors.danger }]}>
              {t(`report.error.${error}`)}
            </Text>
          ) : null}
          <View style={styles.submit}>
            <PrimaryButton
              label={t('report.submit')}
              disabled={reason === null || subject === null || report.isPending}
              onPress={() => {
                if (reason && subject) report.mutate({ ...subject, reason });
              }}
              testID="report-submit"
            />
          </View>
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.sm },
  tabs: { flexDirection: 'row', gap: space.sm, marginBottom: space.xs },
  tab: {
    flex: 1,
    height: sizes.minTap,
    borderRadius: radius.thumbLg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submit: { marginTop: space.sm },
  sent: { alignItems: 'center', gap: space.sm + 2 },
  check: {
    width: sizes.noticeThumb,
    height: sizes.noticeThumb,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { textAlign: 'center' },
  sentBody: { color: colors.inkSoft, lineHeight: 21 },
  actions: { alignSelf: 'stretch', gap: space.sm, marginTop: space.sm },
});
