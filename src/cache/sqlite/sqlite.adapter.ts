import cacheableManager, {CacheClient, CacheManagerOptions} from '@type-cacheable/core'
import * as cacheManager from 'cache-manager'

export class SQLiteAdapter implements CacheClient {
  private client: cacheManager.Cache

  constructor(client: cacheManager.Cache) {
    this.client = client

    this.get = this.get.bind(this)
    this.del = this.del.bind(this)
    this.delHash = this.delHash.bind(this)
    this.getClientTTL = this.getClientTTL.bind(this)
    this.keys = this.keys.bind(this)
    this.set = this.set.bind(this)
  }

  public async del(cacheKey: string | string[]): Promise<void> {
    const keys = Array.isArray(cacheKey) ? cacheKey : [cacheKey]
    await this.client.store.mdel(...keys)
  }

  async delHash(hashKeyOrKeys: string | string[]): Promise<void> {
    const keys = Array.isArray(hashKeyOrKeys) ? hashKeyOrKeys : [hashKeyOrKeys]
    const delPromises = keys.map((key) => this.keys(key).then(this.del))
    await Promise.all(delPromises)
  }

  public async get<T>(cacheKey: string): Promise<T | undefined> {
    return this.client.get<T>(cacheKey)
  }

  public getClientTTL(): cacheManager.Milliseconds {
    return 0
  }

  public async keys(pattern: string): Promise<string[]> {
    return this.client.store.keys(pattern)
  }

  public async set<T>(cacheKey: string, value: T, ttl?: cacheManager.Milliseconds): Promise<T> {
    await this.client.set(cacheKey, value, ttl ?? undefined)
    return value
  }
}

export const useAdapter = (
  client: cacheManager.Cache,
  asFallback?: boolean,
  options?: CacheManagerOptions,
): SQLiteAdapter => {
  const adapter = new SQLiteAdapter(client)

  if (asFallback) {
    cacheableManager.default.setFallbackClient(adapter)
  } else {
    cacheableManager.default.setClient(adapter)
  }

  if (options) {
    cacheableManager.default.setOptions(options)
  }

  return adapter
}
