import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { PillButton } from '@/components/PillButton';
import { TextField } from '@/components/TextField';
import { textStyle } from '@/theme/text';
import { colors, space } from '@/theme/tokens';

import { APPEAL_MAX, type RequestReviewResult, type ReviewState } from './useOwnMoment';

export type ReviewCardProps = {
  review: ReviewState;
  /** Sends the appeal; the card shows the sent state on `sent` or `alreadySent`. */
  onRequestReview: (message: string) => Promise<RequestReviewResult>;
};

/**
 * "Think we got it wrong?" on Moment removed (design: Removed; FR-SAF-05). One request per removal: once sent,
 * the card says so and offers nothing more. The appeal-sent state has no design (G-15).
 */
export function ReviewCard({ review, onRequestReview }: ReviewCardProps) {
  const { t } = useTranslation();
  const [composing, setComposing] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sentHere, setSentHere] = useState(false);
  const [failed, setFailed] = useState(false);

  const state = sentHere && review === 'available' ? 'sent' : review;
  if (state === 'none') return null;

  async function send() {
    setSending(true);
    setFailed(false);
    const result = await onRequestReview(message);
    setSending(false);
    if (result === 'error') setFailed(true);
    else setSentHere(true);
  }

  const title = t(`moment.review.${state}.title`);
  const body = t(`moment.review.${state}.body`);
  return (
    <Card testID={`moment-review-${state}`}>
      <View style={styles.stack}>
        <Text accessibilityRole="header" style={[textStyle('bodyMedium', '700'), { color: colors.ink }]}>
          {title}
        </Text>
        <Text style={[textStyle('bodySmall'), styles.body]}>{body}</Text>
        {state === 'available' && !composing ? (
          <PillButton
            variant="dark"
            label={t('moment.review.available.action')}
            onPress={() => setComposing(true)}
            testID="moment-review-request"
          />
        ) : null}
        {state === 'available' && composing ? (
          <>
            <TextField
              label={t('moment.review.message')}
              value={message}
              onChangeText={setMessage}
              maxLength={APPEAL_MAX}
              multiline
              placeholder={t('moment.review.messagePlaceholder')}
              autoFocus
              testID="moment-review-message"
            />
            {failed ? (
              <Text accessibilityRole="alert" style={[textStyle('bodySmall'), { color: colors.danger }]}>
                {t('moment.review.failed')}
              </Text>
            ) : null}
            <View style={styles.actions}>
              <PillButton
                variant="dark"
                label={t('moment.review.send')}
                onPress={() => void send()}
                disabled={sending}
                testID="moment-review-send"
              />
              <PillButton
                variant="subtle"
                label={t('moment.review.cancel')}
                onPress={() => setComposing(false)}
                disabled={sending}
              />
            </View>
          </>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.sm },
  body: { color: colors.muted },
  actions: { flexDirection: 'row', gap: space.sm },
});
