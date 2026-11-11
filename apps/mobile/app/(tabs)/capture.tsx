import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

// Placeholder Capture tab until M2-11 builds the real screen.
export default function CaptureScreen() {
  const { t } = useTranslation();
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text testID="screen-title" className="font-jakarta-800 text-screenTitle text-ink">
        {t('capture.title')}
      </Text>
    </View>
  );
}
