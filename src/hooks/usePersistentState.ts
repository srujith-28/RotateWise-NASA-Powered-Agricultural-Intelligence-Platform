import { useEffect, useState } from 'react';

export function usePersistentState<T>(
  storageKey: string,
  initialValue: T
): [T, React.Dispatch<React.SetStateAction<T>>, string | null] {
  const [storageError, setStorageError] = useState<string | null>(null);

  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw !== null) {
        return JSON.parse(raw) as T;
      }
    } catch {
      // Fall back safely to initialValue if browser storage is unavailable or corrupted
    }
    return initialValue;
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
      setStorageError(null);
    } catch {
      setStorageError('Unable to persist changes to browser storage.');
    }
  }, [storageKey, state]);

  return [state, setState, storageError];
}
