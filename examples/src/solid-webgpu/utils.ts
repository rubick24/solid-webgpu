export const createWithCache = (cache: Map<string, unknown>) => {
  return <T>(key: string, fn: () => T) => {
    let c = cache.get(key)
    if (c !== undefined) {
      return c as T
    }
    c = fn()
    cache.set(key, c)
    return c as T
  }
}
