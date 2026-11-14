import { useCallback, useEffect, useRef, useState } from 'react';
import type { FlatListProps } from 'react-native';

type ViewableInfo<T> = Parameters<NonNullable<FlatListProps<T>['onViewableItemsChanged']>>[0];

/**
 * The day of the first row on screen, where the scrubber's thumb rests (FR-SOC-01). Feed `onViewable` into the
 * list's `onViewableItemsChanged`; it is stable, because FlatList refuses a new handler after mount.
 */
export function useTopRowDay<T>(dayOfItem: (item: T) => string) {
  const [day, setDay] = useState<string | null>(null);
  const latest = useRef(dayOfItem);
  useEffect(() => {
    latest.current = dayOfItem;
  }, [dayOfItem]);
  const onViewable = useCallback(({ viewableItems }: ViewableInfo<T>) => {
    let first: ViewableInfo<T>['viewableItems'][number] | undefined;
    for (const v of viewableItems) {
      if (typeof v.index === 'number' && (first === undefined || (first.index ?? Infinity) > v.index)) first = v;
    }
    if (first === undefined) return;
    const next = latest.current(first.item);
    setDay((was) => (was === next ? was : next));
  }, []);
  return { day, onViewable };
}
