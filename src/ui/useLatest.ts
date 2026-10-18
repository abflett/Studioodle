import { useLayoutEffect, useRef } from 'react';

/** Event listeners see committed props without mutations during React rendering. */
export function useLatest<T>(value: T) {
  const latest = useRef(value);
  useLayoutEffect(() => { latest.current = value; }, [value]);
  return latest;
}
