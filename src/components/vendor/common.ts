import type {CacheRequestConfig} from 'axios-cache-interceptor'

import {CacheClear, CacheKeyBuilder, Cacheable} from '@type-cacheable/core'
import lodash from 'lodash'

import {Bank} from '../../types/bank.js'
import {Category} from '../../types/category.js'
import {FetchOptions} from '../../types/common.js'
import {Sheet} from '../../types/sheet.js'
import {CACHE_KEY_ORIGIN_QUESTION_ITEM, CACHE_KEY_PREFIX, HashKeyScope} from '../cache-pattern.js'
import {Component} from '../common.js'
import {OutputClass} from '../output/common.js'

/**
 * Hash key builder
 * @param scope
 * @param builder
 * @returns
 */
const hashKeyBuilder = (scope: HashKeyScope, builder?: CacheKeyBuilder): CacheKeyBuilder => {
  return (args, context): string => {
    const tempArgs: Record<string, string> = {scope}

    if (context instanceof Vendor) {
      tempArgs.vendorKey = (context.constructor as typeof Vendor).META.key
    } else if (args.length > 0 && args[0] instanceof Vendor) {
      tempArgs.vendorKey = (args[0].constructor as typeof Vendor).META.key
    }

    const hashKeyPrefix = lodash.template(CACHE_KEY_PREFIX)(tempArgs)

    return builder ? `${hashKeyPrefix}:${builder(args, context)}` : hashKeyPrefix
  }
}

/**
 * Vendor class
 */
abstract class Vendor extends Component {
  /**
   * Banks.
   */
  public async banks(fromCache?: true): Promise<Bank[]> {
    return fromCache ? this._banks() : this.fetchBanks()
  }

  /**
   * Categories.
   */
  public async categories(bank: Bank, fromCache?: true): Promise<Category[]> {
    const categories = await (fromCache ? this._categories(bank) : this.fetchCategories(bank))

    for (const category of categories) {
      const cacheKeyParams = {
        bankId: bank.id,
        categoryId: category.id,
        sheetId: '*',
        vendorKey: (this.constructor as typeof Vendor).META.key,
      }

      const originQuestionItemCacheKey = lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)(cacheKeyParams)

      const originQuestionCount = (await this.getCacheClient().keys(originQuestionItemCacheKey + ':*')).length

      category.fetch = originQuestionCount >= category.count
    }

    return categories
  }

  /**
   * Invalidate cache.
   */
  public async invalidate(scope: HashKeyScope, bank?: Bank, category?: Category): Promise<void> {
    switch (scope) {
      case HashKeyScope.BANKS: {
        return this._banksInvalidate()
      }

      case HashKeyScope.CATEGORIES: {
        return bank ? this._categoriesInvalidate(bank) : Promise.resolve()
      }

      case HashKeyScope.SHEETS: {
        return bank && category ? this._sheetsInvalidate(bank, category) : Promise.resolve()
      }

      case HashKeyScope.LOGIN: {
        return this._loginInvalidate()
      }

      default: {
        throw new Error('Invalid scope')
      }
    }
  }

  /**
   * Login.
   */
  public async login(password?: string): Promise<CacheRequestConfig> {
    return password === undefined ? this._login() : this.toLogin(password)
  }

  /**
   * Sheets.
   */
  public async sheets(bank: Bank, category: Category, fromCache?: true): Promise<Sheet[]> {
    return fromCache ? this._sheets(bank, category) : this.fetchSheet(bank, category)
  }

  /**
   * Banks.
   */
  @Cacheable({cacheKey: () => '', hashKey: hashKeyBuilder(HashKeyScope.BANKS)})
  protected async _banks(): Promise<Bank[]> {
    const vendorKey = (this.constructor as typeof Vendor).META.key
    throw new Error(`Please run 'bank list -v ${vendorKey} -u ${this.getUsername()}' command to get banks first.`)
  }

  @CacheClear({cacheKey: () => '', hashKey: hashKeyBuilder(HashKeyScope.BANKS)})
  protected async _banksInvalidate(): Promise<void> {}

  /**
   * Categories.
   */
  @Cacheable({cacheKey: (args) => args[0].id, hashKey: hashKeyBuilder(HashKeyScope.CATEGORIES)})
  protected async _categories(bank: Bank): Promise<Category[]> {
    const vendorKey = (this.constructor as typeof Vendor).META.key
    const command = `category list -v ${vendorKey} -u ${this.getUsername()} -b ${bank.id}`
    throw new Error(`Please run '${command}' command to get categories first.`)
  }

  @CacheClear({cacheKey: (args) => args[0].id, hashKey: hashKeyBuilder(HashKeyScope.CATEGORIES)})
  protected async _categoriesInvalidate(_bank: Bank): Promise<void> {}

  /**
   * Login.
   */
  @Cacheable({cacheKey: (_, context) => context.getUsername(), hashKey: hashKeyBuilder(HashKeyScope.LOGIN)})
  protected async _login(): Promise<CacheRequestConfig> {
    const vendorKey = (this.constructor as typeof Vendor).META.key
    throw new Error(`Please run 'vendor login -v ${vendorKey} -u ${this.getUsername()}' command to login first.`)
  }

  @CacheClear({cacheKey: (_, context) => context.getUsername(), hashKey: hashKeyBuilder(HashKeyScope.LOGIN)})
  protected async _loginInvalidate(): Promise<void> {}

  /**
   * Sheets.
   */
  @Cacheable({cacheKey: (args) => `${args[0].id}:${args[1].id}`, hashKey: hashKeyBuilder(HashKeyScope.SHEETS)})
  protected async _sheets(bank: Bank, category: Category): Promise<Sheet[]> {
    const vendorKey = (this.constructor as typeof Vendor).META.key
    const command = `sheet list -v ${vendorKey} -u ${this.getUsername()} -b ${bank.name} -c ${category.name}`
    throw new Error(`Please run '${command}' command to get sheets first.`)
  }

  @CacheClear({cacheKey: (args) => `${args[0].id}:${args[1].id}`, hashKey: hashKeyBuilder(HashKeyScope.SHEETS)})
  protected async _sheetsInvalidate(_bank: Bank, _category: Category): Promise<void> {}

  //
  // abstract
  //
  public abstract get allowedOutputs(): Record<string, OutputClass>

  protected abstract fetchBanks(): Promise<Bank[]>

  protected abstract fetchCategories(bank: Bank): Promise<Category[]>

  public abstract fetchQuestions(bank: Bank, category: Category, sheet: Sheet, options?: FetchOptions): Promise<void>

  protected abstract fetchSheet(bank: Bank, category: Category): Promise<Sheet[]>

  protected abstract toLogin(password: string): Promise<CacheRequestConfig>
}

// Vendor class type
type VendorClass = new (username: string) => Vendor

// Export
export {Vendor, VendorClass, hashKeyBuilder}

export {HashKeyScope} from '../cache-pattern.js'