export const createWithCache = (cache: Map<string, unknown>) => {
  return <T>(key: string, fn: () => T, options?: { stale?: (old: T) => boolean }) => {
    let c = cache.get(key) as T | undefined
    if (c !== undefined && !options?.stale?.(c)) {
      return c
    }
    c = fn()
    cache.set(key, c)
    return c as T
  }
}

export type WithCache = ReturnType<typeof createWithCache>
