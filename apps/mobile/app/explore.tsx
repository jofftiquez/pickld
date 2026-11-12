import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { searchTerm } from '@/features/explore/explore';
import { ExploreView } from '@/features/explore/ExploreView';
import { useExplore, useExploreReading, usePeopleSearch } from '@/features/explore/useExplore';

// /explore (M6-08; FR-EXP-01, FR-EXP-02): search people, Suggested authors and Full jars today. Opened from
// Jars ("Find people" when empty).
export default function ExploreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const explore = useExplore();
  const search = usePeopleSearch(query);
  const reading = useExploreReading();
  return (
    <ExploreView
      data={explore.data}
      failed={explore.isError}
      insets={insets}
      query={query}
      onQueryChange={setQuery}
      results={search.term === null ? undefined : search.data}
      searching={searchTerm(query) !== null}
      searchFailed={search.term !== null && search.isError}
      busy={reading.busy}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/jars'))}
      onRetry={() => void explore.refetch()}
      onOpenProfile={(username) => router.push({ pathname: '/u/[username]', params: { username } })}
      onSetReading={(person, next) => reading.setReading(person.id, next)}
      onOpenJar={(id) => router.push({ pathname: '/jar/[id]', params: { id } })}
    />
  );
}
