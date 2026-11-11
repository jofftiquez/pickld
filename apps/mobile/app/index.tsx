import { Redirect } from 'expo-router';

// The app opens on the Today tab.
export default function Index() {
  return <Redirect href="/(tabs)/today" />;
}
