import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { DangerButton } from '@/components/DangerButton';
import { Dialog } from '@/components/Dialog';
import { Icon } from '@/components/Icon';
import { RoundIconButton } from '@/components/RoundIconButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { Toggle } from '@/components/Toggle';
import type { Edits } from '@/features/edit/edits';
import { textStyle } from '@/theme/text';
import { colors, radius, sizes, space, type Slot } from '@/theme/tokens';

import { MomentView } from './MomentView';
import type { OptionError } from './momentActions';
import { OptionRow } from './OptionRow';

export type MomentOptionsSheetProps = {
  visible: boolean;
  slot: Slot;
  /** "7:30 AM · Mon, Nov 9", already formatted in the jar's zone. */
  when: string;
  thumbUri: string | null;
  edits: Edits;
  isPrivate: boolean;
  /** Empty slots in the same jar a move can go to (D-3), in slot order. */
  freeSlots: readonly Slot[];
  /** An option is running: rows are disabled until it finishes. */
  busy: boolean;
  error: OptionError | null;
  onEditCaption: () => void;
  onEditMoment: () => void;
  onRecrop: () => void;
  onChangePrivate: (isPrivate: boolean) => void;
  onMove: (slot: Slot) => void;
  /** Delete moment after the user confirmed it in the dialog. */
  onDelete: () => void;
  onClose: () => void;
};

/**
 * Moment options (FR-CAP-10; design: MomentOptions): the moment's photo, slot and time, then Edit caption,
 * Edit stickers and filters, Re-crop, Make private, Move to another moment (a second page listing the
 * jar's empty slots) and Delete moment, which asks for confirmation first. Cancel closes it.
 */
export function MomentOptionsSheet(props: MomentOptionsSheetProps) {
  const { slot, freeSlots, busy, error, isPrivate } = props;
  const { t } = useTranslation();
  const [page, setPage] = useState<'options' | 'move'>('options');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const slotLabel = t(`slots.${slot}`);

  const close = () => {
    setPage('options');
    setConfirmDelete(false);
    props.onClose();
  };

  return (
    <BottomSheet
      visible={props.visible}
      onClose={close}
      accessibilityLabel={t('momentOptions.title')}
      testID="moment-options"
    >
      {page === 'options' ? (
        <View>
          <View style={styles.header}>
            <View style={styles.thumb}>
              <MomentView uri={props.thumbUri} edits={props.edits} width={sizes.optionThumb} accessible={false} />
            </View>
            <View style={styles.headerText}>
              <Text accessibilityRole="header" style={[textStyle('body', '700'), styles.slot]}>
                {slotLabel}
              </Text>
              <Text style={[textStyle('label', '500'), styles.muted]}>{props.when}</Text>
            </View>
          </View>
          <OptionRow
            icon="caption"
            label={t('momentOptions.editCaption')}
            onPress={props.onEditCaption}
            disabled={busy}
            testID="moment-options-caption"
          />
          <OptionRow
            icon="sparkle"
            label={t('momentOptions.editMoment')}
            onPress={props.onEditMoment}
            disabled={busy}
            testID="moment-options-edit"
          />
          <OptionRow
            icon="photo"
            label={t('momentOptions.recrop')}
            accessibilityHint={t('momentOptions.recropHint')}
            onPress={props.onRecrop}
            disabled={busy}
            testID="moment-options-recrop"
          />
          <OptionRow
            icon="lock"
            label={t('momentOptions.private')}
            accessibilityRole="switch"
            checked={isPrivate}
            accessibilityHint={t('momentOptions.privateHint')}
            onPress={() => props.onChangePrivate(!isPrivate)}
            trailing={
              <Toggle
                value={isPrivate}
                onValueChange={() => undefined}
                accessibilityLabel={t('momentOptions.private')}
              />
            }
            disabled={busy}
            testID="moment-options-private"
          />
          <OptionRow
            icon="grid"
            label={t('momentOptions.move')}
            onPress={() => setPage('move')}
            trailing={<Icon name="chevronRight" color="chevron" size={18} strokeWidth={2} />}
            disabled={busy}
            testID="moment-options-move"
          />
          <OptionRow
            icon="close"
            tone="danger"
            label={t('momentOptions.delete')}
            onPress={() => setConfirmDelete(true)}
            divider={false}
            disabled={busy}
            testID="moment-options-delete"
          />
        </View>
      ) : (
        <View>
          <View style={styles.moveHeader}>
            <RoundIconButton
              icon="back"
              accessibilityLabel={t('momentOptions.backToOptions')}
              onPress={() => setPage('options')}
              testID="moment-options-move-back"
            />
            <View style={styles.headerText}>
              <Text accessibilityRole="header" style={[textStyle('body', '700'), styles.slot]}>
                {t('momentOptions.moveTitle')}
              </Text>
              <Text style={[textStyle('label', '500'), styles.muted]}>
                {t('momentOptions.moveSubtitle', { slot: slotLabel })}
              </Text>
            </View>
          </View>
          {freeSlots.length === 0 ? (
            <Text style={[textStyle('bodyMedium'), styles.muted, styles.noSlots]} testID="moment-options-no-slots">
              {t('momentOptions.noFreeSlots')}
            </Text>
          ) : (
            freeSlots.map((free, i) => (
              <OptionRow
                key={free}
                icon={free}
                label={t('momentOptions.moveTo', { slot: t(`slots.${free}`) })}
                onPress={() => props.onMove(free)}
                divider={i < freeSlots.length - 1}
                disabled={busy}
                testID={`moment-options-move-${free}`}
              />
            ))
          )}
        </View>
      )}
      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          style={[textStyle('bodySmall'), styles.error]}
          testID="moment-options-error"
        >
          {t(`momentOptions.error.${error}`)}
        </Text>
      ) : null}
      <View style={styles.cancel}>
        <SecondaryButton label={t('common.cancel')} onPress={close} testID="moment-options-cancel" />
      </View>
      {/* Inside the sheet so it opens over it (a modal from a modal). */}
      <Dialog
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t('momentOptions.deleteTitle', { slot: slotLabel })}
        message={t('momentOptions.deleteMessage')}
        testID="delete-moment-dialog"
      >
        <DangerButton
          label={t('momentOptions.deleteConfirm')}
          onPress={() => {
            setConfirmDelete(false);
            props.onDelete();
          }}
          testID="delete-moment-confirm"
        />
      </Dialog>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingBottom: space.sm },
  thumb: { width: sizes.optionThumb, borderRadius: radius.thumb, overflow: 'hidden' },
  headerText: { flex: 1 },
  slot: { color: colors.ink },
  muted: { color: colors.muted },
  moveHeader: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingBottom: space.md },
  noSlots: { paddingVertical: space.lg },
  error: { color: colors.danger, marginTop: space.md },
  cancel: { marginTop: space.sm + 2 },
});
