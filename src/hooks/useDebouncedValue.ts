import { useEffect, useState } from 'react'

/**
 * Returns `value` delayed by `delayMs`, collapsing rapid changes into one
 * update. Seeded with the initial value so the first render is immediate.
 *
 * Used to keep expensive derived work (markdown parsing and sanitizing) off
 * the keystroke path.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
