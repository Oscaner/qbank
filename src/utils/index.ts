import {input} from '@inquirer/prompts'
import fs from 'fs-extra'
import lodash from 'lodash'

import sqliteCache from '../cache/sqlite.manager.js'
import {Vendor} from '../components/vendor/common.js'

export type FindOptions<T = object> = {
  excludeKey?: ('meta' | keyof T)[]
  fuzzy?: boolean
}

export function find<T>(items: T[], substring: string, options: FindOptions<T> = {}): T | undefined {
  options.excludeKey = [...(options.excludeKey ?? []), 'meta']

  return lodash.find(items, (item) => {
    if (lodash.isArray(item)) {
      return !lodash.isEmpty(find(item, substring, options))
    }

    if (lodash.isObject(item) && !lodash.isArray(item)) {
      const subItems: any[] = Object.values(options?.excludeKey ? lodash.omit(item, options.excludeKey) : item)
      return !lodash.isEmpty(find(subItems, substring, options))
    }

    if (lodash.isEmpty(substring)) return true

    return options?.fuzzy
      ? lodash.toString(item).includes(lodash.toString(substring))
      : lodash.isEqual(lodash.toString(item), lodash.toString(substring))
  })
}

export function fiind<T>(items: T[], substring: string, options?: FindOptions<T>): T | undefined {
  let item = find(items, substring, {...options, fuzzy: false})
  if (!item) item = find(items, substring, {...options, fuzzy: true})
  return item
}

export function findAll<T>(items: T[], substring: string, options: FindOptions<T> = {}): T[] {
  options.excludeKey = [...(options.excludeKey ?? []), 'meta']

  return lodash.filter(items, (item) => {
    if (lodash.isArray(item)) {
      return !lodash.isEmpty(findAll(item, substring, options))
    }

    if (lodash.isObject(item) && !lodash.isArray(item)) {
      const subItems: any[] = Object.values(options?.excludeKey ? lodash.omit(item, options.excludeKey) : item)
      return !lodash.isEmpty(findAll(subItems, substring, options))
    }

    if (lodash.isEmpty(substring)) return true

    return options?.fuzzy
      ? lodash.toString(item).includes(lodash.toString(substring))
      : lodash.isEqual(lodash.toString(item), lodash.toString(substring))
  })
}

export function fiindAll<T>(items: T[], substrings: string[], options?: FindOptions<T>): T[] {
  if (lodash.isEmpty(substrings)) return items

  return lodash
    .chain(substrings)
    .map((substring) => {
      let results = findAll(items, substring, {...options, fuzzy: false})
      if (lodash.isEmpty(results)) results = findAll(items, substring, {...options, fuzzy: true})
      return results
    })
    .flattenDeep()
    .value()
}

export function throwError(message: string | unknown, data: unknown): never {
  let errFile = 'tmp/error.json'

  if (lodash.has(data, 'params')) {
    const _params = data.params as Record<string, any>
    const _vendor = _params.vendor as Vendor
    errFile = `tmp/error-${(_vendor.constructor as typeof Vendor).META.key}.json`
  }

  fs.writeJsonSync(errFile, {data, message}, {spaces: 2})
  if (typeof message === 'string') throw new Error(message)
  throw message
}

export function reverseTemplate(template: string, result: string): Record<string, any> {
  const templateParts = template.split(':')
  const resultParts = result.split(':')

  const obj = {} as Record<string, any>

  for (const [index, part] of templateParts.entries()) {
    const match = /{{(.*?)}}/.exec(part)
    if (!match) continue
    obj[match[1].trim()] = resultParts[index] || null
  }

  return obj
}

export async function safeName(name: string): Promise<string> {
  if (name.length <= 48) return name

  const cacheClient = sqliteCache.CommonClient

  let _safeName = await cacheClient.get(`safe-name:${name}`)

  if (_safeName) return _safeName

  _safeName = name

  while (_safeName.length > 48) {
    _safeName = await input({
      default: _safeName,
      message: `Safe name (max 48 chars):\n`,
    })
  }

  await cacheClient.set(`safe-name:${name}`, _safeName)

  return _safeName
}

export function isJSON(str: string): boolean {
  try {
    JSON.parse(str)
    return true
  } catch {
    return false
  }
}

export function getMemoryUsage(): Record<string, string> {
  const memoryUsage = process.memoryUsage()
  return lodash.mapValues(memoryUsage, (value) => (value / 1024 / 1024).toFixed(2) + ' MB')
}
