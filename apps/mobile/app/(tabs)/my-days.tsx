import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

// Placeholder My days tab until M2-25 builds the real screen.
export default function MyDaysScreen() {
  const { t } = useTranslation();
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text testID="screen-title" className="font-jakarta-800 text-screenTitle text-ink">
        {t('myDays.title')}
      </Text>
    </View>
  );
}
