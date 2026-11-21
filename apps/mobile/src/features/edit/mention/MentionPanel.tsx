import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { TextField } from '@/components/TextField';
import { textStyle } from '@/theme/text';
import { bubble, colors, sizes, space } from '@/theme/tokens';

import { BubbleSwatch } from '../bubble/BubbleSwatch';
import { bubbleColorSchema, type BubbleColor, type Mention, type Overlay } from '../edits';
import { newOverlayId } from '../text/textOverlay';
import { newMentionScale, rescaleMention } from './mentionLayout';
import { useTaggablePeople, type TaggablePerson } from './useTaggablePeople';

export type MentionPanelProps = {
  selected: Mention | null;
  /** Ids of people already tagged on this photo: each person once. */
  taggedIds: readonly string[];
  onAdd: (overlay: Overlay) => void;
  onUpdate: (id: string, update: (overlay: Overlay) => Overlay) => void;
};

/** Where a new mention lands: a little above the middle, centred, upright. */
const NEW_MENTION = { x: 0.5, y: 0.4, rotation: 0 } as const;

/**
 * The Mention tool (0172): tag a mutual reader with an "@username" sticker. Only people you read who also read
 * you are listed (the database refuses anyone else). With a mention selected on the photo, picking someone
 * changes who it tags; otherwise it adds one.
 */
export function MentionPanel({ selected, taggedIds, onAdd, onUpdate }: MentionPanelProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [nextColor, setNextColor] = useState<BubbleColor>('white');
  const color = selected?.color ?? nextColor;
  const people = useTaggablePeople(query);

  const pick = (person: TaggablePerson) => {
    if (selected) {
      onUpdate(selected.id, (o) =>
        o.type === 'mention'
          ? { ...o, userId: person.id, username: person.username, scale: rescaleMention(o, person.username) }
          : o,
      );
      return;
    }
    onAdd({
      id: newOverlayId(),
      type: 'mention',
      ...NEW_MENTION,
      scale: newMentionScale(person.username),
      userId: person.id,
      username: person.username,
      color,
    });
  };
  const chooseColor = (next: BubbleColor) => {
    setNextColor(next);
    if (selected) onUpdate(selected.id, (o) => (o.type === 'mention' ? { ...o, color: next } : o));
  };

  const list = people.data ?? [];
  return (
    <View style={styles.root} testID="editor-panel-mention">
      <TextField
        label={t('editMention.field')}
        value={query}
        onChangeText={setQuery}
        placeholder={t('editMention.placeholder')}
        accessibilityHint={selected ? t('editMention.fieldHintSelected') : t('editMention.fieldHint')}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        testID="mention-search"
      />
      {people.isPending ? (
        <ActivityIndicator color={colors.muted} accessibilityLabel={t('editMention.loading')} />
      ) : people.isError ? (
        <Text style={[textStyle('bodySmall'), styles.problem]} accessibilityRole="alert" testID="mention-failed">
          {t('editMention.failed')}
        </Text>
      ) : list.length === 0 ? (
        <Text style={[textStyle('bodySmall'), styles.note]} testID="mention-empty">
          {query.trim() ? t('editMention.noMatch') : t('editMention.nobody')}
        </Text>
      ) : (
        <View testID="mention-people">
          {list.map((person) => {
            const current = selected?.userId === person.id;
            const taken = !current && taggedIds.includes(person.id);
            return (
              <Pressable
                key={person.id}
                onPress={() => pick(person)}
                disabled={taken || current}
                accessibilityRole="button"
                accessibilityLabel={t('editMention.person', { name: person.displayName, username: person.username })}
                accessibilityHint={
                  taken
                    ? t('editMention.alreadyTagged')
                    : selected
                      ? t('editMention.swapHint')
                      : t('editMention.addHint')
                }
                accessibilityState={{ disabled: taken, selected: current }}
                testID={`mention-person-${person.username}`}
              >
                {({ pressed }) => (
                  <View style={[styles.person, pressed ? styles.pressed : null]}>
                    <Avatar name={person.displayName} uri={person.avatarUrl} size="sm" decorative />
                    <View style={styles.names}>
                      <Text style={[textStyle('bodyMedium', '700'), styles.username]} numberOfLines={1}>
                        @{person.username}
                      </Text>
                      <Text style={[textStyle('bodySmall'), styles.note]} numberOfLines={1}>
                        {person.displayName}
                      </Text>
                    </View>
                    {current || taken ? <Icon name="check" color="brandText" size={18} strokeWidth={2.4} /> : null}
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      )}
      <View style={styles.colorRow} accessibilityLabel={t('editMention.colors')} testID="mention-colors">
        <Text style={[textStyle('label'), styles.label]} importantForAccessibility="no" accessibilityElementsHidden>
          {t('editBubble.color')}
        </Text>
        {bubbleColorSchema.options.map((c) => (
          <BubbleSwatch
            key={c}
            color={c}
            label={t(`editBubble.colorName.${c}`)}
            selected={c === color}
            onPress={() => chooseColor(c)}
            testID={`mention-color-${c}`}
          />
        ))}
      </View>
      <Text style={[textStyle('bodySmall'), styles.note]} testID="mention-rules">
        {t('editMention.rules')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.md + 2 },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: sizes.minTap,
    paddingVertical: space.xs,
  },
  pressed: { opacity: 0.6 },
  names: { flex: 1, minWidth: 0 },
  username: { color: colors.ink },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 10 - 4 * bubble.swatchRing },
  label: { minWidth: bubble.colorLabelWidth, color: colors.muted },
  problem: { color: colors.danger },
  note: { color: colors.muted },
});
