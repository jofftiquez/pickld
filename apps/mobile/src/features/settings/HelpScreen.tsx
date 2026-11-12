import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GUIDELINES_URL, SUPPORT_EMAIL } from '@/lib/links';

import { mailtoUrl } from './helpModel';
import { HelpView } from './HelpView';

/** /settings/help (M4-17): Contact support and Send feedback open an email with the app version attached. */
export function HelpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [noMail, setNoMail] = useState<string | null>(null);

  async function email(subject: string) {
    const body = t('help.mail.body', {
      version: Constants.expoConfig?.version ?? '',
      platform: Platform.OS,
      os: String(Platform.Version),
    });
    try {
      await Linking.openURL(mailtoUrl(subject, body));
      setNoMail(null);
    } catch {
      setNoMail(t('help.noMail', { email: SUPPORT_EMAIL }));
    }
  }

  return (
    <HelpView
      insets={insets}
      noMail={noMail}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}
      onContact={() => void email(t('help.mail.supportSubject'))}
      onFeedback={() => void email(t('help.mail.feedbackSubject'))}
      onGuidelines={() => void WebBrowser.openBrowserAsync(GUIDELINES_URL)}
    />
  );
}
