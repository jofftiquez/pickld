import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { turnOnGuideTips } from '@/features/guide/guideTips';
import { appVersion } from '@/lib/appVersion';
import { useAuthStore } from '@/lib/authStore';
import { GUIDELINES_URL, SUPPORT_EMAIL } from '@/lib/links';
import { showToast } from '@/lib/toast';

import { mailtoUrl } from './helpModel';
import { HelpView } from './HelpView';

/** /settings/help (M4-17): Contact support and Send feedback open an email with the app version attached. */
export function HelpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [noMail, setNoMail] = useState<string | null>(null);
  const userId = useAuthStore((s) => s.session?.user.id ?? null);

  async function email(subject: string) {
    const body = t('help.mail.body', {
      version: appVersion(),
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
      onGuide={() => router.push({ pathname: '/guide', params: { from: 'help' } })}
      onShowTips={() => {
        if (!userId) return;
        void turnOnGuideTips(userId).then(() => showToast('tipsOn'));
      }}
    />
  );
}
