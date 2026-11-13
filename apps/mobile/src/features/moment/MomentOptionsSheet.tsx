import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { DangerButton } from '@/components/DangerButton';
import { Dialog } from '@/components/Dialog';
import { Icon } from '@/components/Icon';
import { RoundIconButton } from '@/components/RoundIconButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { RadioRow } from '@/components/RadioRow';
import { VISIBILITY_ICON } from '@/components/VisibilityBadge';
import type { Edits } from '@/features/edit/edits';
import { VISIBILITIES, VISIBILITY_KEY, type Visibility } from '@/lib/visibility';
import { textStyle } from '@/theme/text';
import { colors, radius, sizes, space, type Slot } from '@/theme/tokens';

import { MomentView } from './MomentView';
import type { OptionError } from './momentActions';
import { OptionRow } from './OptionRow';

/**
 * `all`: every option. `more`: the moment preview's More menu (D-54), without what its action bar already
 * has (Edit caption, Edit stickers and filters, Visibility). `visibility`: the preview's Visibility action,
 * opened straight on the Visibility page with no way back to the options.
 */
export type MomentOptionsMode = 'all' | 'more' | 'visibility';

export type MomentOptionsSheetProps = {
  visible: boolean;
  mode?: MomentOptionsMode;
  slot: Slot;
  /** "7:30 AM · Mon, Nov 9", already formatted in the jar's zone. */
  when: string;
  thumbUri: string | null;
  edits: Edits;
  /** Who can see the moment (D-48). */
  visibility: Visibility;
  /** Empty slots in the same jar a move can go to (D-3), in slot order. */
  freeSlots: readonly Slot[];
  /** An option is running: rows are disabled until it finishes. */
  busy: boolean;
  error: OptionError | null;
  onEditCaption: () => void;
  onEditMoment: () => void;
  onRecrop: () => void;
  onChangeVisibility: (visibility: Visibility) => void;
  onMove: (slot: Slot) => void;
  /** Delete moment after the user confirmed it in the dialog. */
  onDelete: () => void;
  onClose: () => void;
};

/**
 * Moment options (FR-CAP-10; design: MomentOptions): the moment's photo, slot and time, then Edit caption,
 * Edit stickers and filters, Re-crop, Visibility (a second page with Readers, Everyone and Only me; D-48),
 * Move to another moment (a second page listing the jar's empty slots) and Delete moment, which asks for
 * confirmation first. Cancel closes it.
 */
export function MomentOptionsSheet(props: MomentOptionsSheetProps) {
  const { slot, freeSlots, busy, error, visibility, mode = 'all' } = props;
  const { t } = useTranslation();
  const firstPage = mode === 'visibility' ? 'visibility' : 'options';
  const [page, setPage] = useState<'options' | 'move' | 'visibility'>(firstPage);
  const visibilityLabel = t(`visibility.${VISIBILITY_KEY[visibility]}`);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const slotLabel = t(`slots.${slot}`);

  const close = () => {
    setPage(firstPage);
    setConfirmDelete(false);
    props.onClose();
  };

  return (
    <BottomSheet
      visible={props.visible}
      onClose={close}
      accessibilityLabel={mode === 'visibility' ? t('momentOptions.visibilityTitle') : t('momentOptions.title')}
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
          {mode === 'all' ? (
            <>
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
            </>
          ) : null}
          <OptionRow
            icon="photo"
            label={t('momentOptions.recrop')}
            accessibilityHint={t('momentOptions.recropHint')}
            onPress={props.onRecrop}
            disabled={busy}
            testID="moment-options-recrop"
          />
          {mode === 'all' ? (
            <OptionRow
              icon={VISIBILITY_ICON[visibility]}
              label={t('momentOptions.visibility')}
              accessibilityLabel={t('momentOptions.visibilityValue', { value: visibilityLabel })}
              accessibilityHint={t('momentOptions.visibilityHint')}
              onPress={() => setPage('visibility')}
              trailing={
                <View style={styles.trailingValue}>
                  <Text style={[textStyle('bodyMedium', '500'), styles.muted]}>{visibilityLabel}</Text>
                  <Icon name="chevronRight" color="chevron" size={18} strokeWidth={2} />
                </View>
              }
              disabled={busy}
              testID="moment-options-visibility"
            />
          ) : null}
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
      ) : page === 'visibility' ? (
        <View>
          <View style={styles.moveHeader}>
            {mode === 'visibility' ? null : (
              <RoundIconButton
                icon="back"
                accessibilityLabel={t('momentOptions.backToOptions')}
                onPress={() => setPage('options')}
                testID="moment-options-visibility-back"
              />
            )}
            <View style={styles.headerText}>
              <Text accessibilityRole="header" style={[textStyle('body', '700'), styles.slot]}>
                {t('momentOptions.visibilityTitle')}
              </Text>
              <Text style={[textStyle('label', '500'), styles.muted]}>{t('momentOptions.visibilitySubtitle')}</Text>
            </View>
          </View>
          <View accessibilityRole="radiogroup" accessibilityLabel={t('momentOptions.visibilityTitle')}>
            {VISIBILITIES.map((option, i) => (
              <RadioRow
                key={option}
                label={t(`visibility.${VISIBILITY_KEY[option]}`)}
                description={t(`visibility.${VISIBILITY_KEY[option]}Body`)}
                selected={visibility === option}
                onSelect={() => {
                  if (!busy && option !== visibility) props.onChangeVisibility(option);
                }}
                divider={i < VISIBILITIES.length - 1}
                testID={`moment-options-visibility-${option}`}
              />
            ))}
          </View>
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
  trailingValue: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  moveHeader: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingBottom: space.md },
  noSlots: { paddingVertical: space.lg },
  error: { color: colors.danger, marginTop: space.md },
  cancel: { marginTop: space.sm + 2 },
});
