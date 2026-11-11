import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

// Placeholder Today route until M2-05 builds the real screen.
export default function TodayScreen() {
  const { t } = useTranslation();
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text testID="screen-title" className="font-jakarta-800 text-screenTitle text-ink">
        {t('today.title')}
      </Text>
    </View>
  );
}
