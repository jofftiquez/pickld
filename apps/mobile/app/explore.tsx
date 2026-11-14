import { Redirect } from 'expo-router';

// /explore (pickld://explore and older links): Discover is a tab now (D-130), so this opens the tab instead of a
// stacked copy over the tabs.
export default function ExploreRedirect() {
  return <Redirect href="/discover" />;
}
