import {Cacheable, CacheKeyBuilder} from '@type-cacheable/core'
import type {CacheRequestConfig} from 'axios-cache-interceptor'
import lodash from 'lodash'
import sleep from 'sleep-promise'

import {Bank} from '../../@types/bank.js'
import {Category} from '../../@types/category.js'
import {FetchOptions, LoginOptions} from '../../@types/common.js'
import {Sheet} from '../../@types/sheet.js'
import cacheManager from '../../cache/cache.manager.js'
import {
  CACHE_KEY_BANKS,
  CACHE_KEY_CATEGORIES,
  CACHE_KEY_LOGIN,
  CACHE_KEY_QUESTION_ITEM,
  CACHE_KEY_SHEETS,
  HashKeyScope,
} from '../cache-pattern.js'
import {Component} from '../common.js'
import {Output, OutputClass} from '../output/common.js'

type Options = {
  excludeTtl?: true
}

/**
 * Hash key builder
 */
const cacheKeyBuilder = (scope: HashKeyScope): CacheKeyBuilder => {
  return (args: any[], context: Vendor): string => {
    const cacheKeyParams: Record<string, any> = {
      scope,
      username: context.getUsername(),
      vendorKey: (context.constructor as typeof Vendor).META.key,
    }

    const params = args[0] || {}

    if (params.bank) {
      cacheKeyParams.bankId = params.bank.id
    }

    if (params.category) {
      cacheKeyParams.categoryId = params.category.id
    }

    if (params.sheet) {
      cacheKeyParams.sheetId = params.sheet.id
    }

    if (params.questionId) {
      cacheKeyParams.questionId = params.questionId
    }

    if (params.output) {
      cacheKeyParams.outputKey = (params.output.constructor as typeof Output).META.key
    }

    if (scope === HashKeyScope.BANKS) {
      return lodash.template(CACHE_KEY_BANKS)(cacheKeyParams)
    }

    if (scope === HashKeyScope.CATEGORIES) {
      return lodash.template(CACHE_KEY_CATEGORIES)(cacheKeyParams)
    }

    if (scope === HashKeyScope.SHEETS) {
      return lodash.template(CACHE_KEY_SHEETS)(cacheKeyParams)
    }

    if (scope === HashKeyScope.QUESTIONS) {
      return lodash.template(CACHE_KEY_QUESTION_ITEM)(cacheKeyParams)
    }

    if (scope === HashKeyScope.LOGIN) {
      return lodash.template(CACHE_KEY_LOGIN)(cacheKeyParams)
    }

    throw new Error('Invalid scope')
  }
}

/**
 * Vendor class
 */
abstract class Vendor extends Component {
  /**
   * Banks.
   */
  public async banks(options?: Options): Promise<Bank[]> {
    const banks = await this.fetchBanks()

    if (!options?.excludeTtl) {
      banks.unshift({count: lodash.sumBy(banks, 'count'), id: '*', name: '全部', order: -999})
    }

    return lodash
      .chain(banks)
      .sortBy(['order', 'name', 'id'], ['asc', 'asc', 'asc'])
      .map((_bank, idx) => ({
        ..._bank,
        order: options?.excludeTtl ? idx : idx - 1,
      }))
      .groupBy('name')
      .map((_banks, _name) => {
        if (_banks.length <= 1) return _banks
        return _banks.map((_bank) => {
          const _shortId = _bank.id.slice(0, 8)
          if (_bank.name.includes(_shortId)) return _bank
          return {..._bank, name: `${_name} (${_shortId})`, orgName: _name}
        })
      })
      .flatten()
      .sortBy(['order', 'name', 'id'], ['asc', 'asc', 'asc'])
      .value()
  }

  /**
   * Categories.
   */
  public async categories(params: {bank: Bank}, options?: Options): Promise<Category[]> {
    const categories = await this.fetchCategories(params)

    // If there is no category, add a default category.
    if (lodash.isEmpty(categories)) {
      categories.push({
        children: [],
        count: 0,
        id: '0',
        name: '暂无',
        order: 0,
      })
    }

    if (!options?.excludeTtl) {
      categories.unshift({children: [], count: lodash.sumBy(categories, 'count'), id: '*', name: '全部', order: -999})
    }

    // Sort categories, and fix the same name.
    const _fix = (categories: Category[]): Category[] => {
      for (const category of categories) {
        if (category.children.length === 0) continue
        category.children = _fix(category.children)
      }

      return lodash
        .chain(categories)
        .sortBy(['order', 'name', 'id'], ['asc', 'asc', 'asc'])
        .map((_cate, idx) => ({..._cate, order: options?.excludeTtl ? idx : idx - 1}))
        .groupBy('name')
        .map((_cates, _name) => {
          if (_cates.length <= 1) return _cates
          return _cates.map((_category) => {
            const _shortId = _category.id.slice(0, 8)
            if (_category.name.includes(_shortId)) return _category
            return {..._category, name: `${_name} (${_shortId})`, orgName: _name}
          })
        })
        .flatten()
        .sortBy(['order', 'name', 'id'], ['asc', 'asc', 'asc'])
        .value()
    }

    return _fix(categories)
  }

  /**
   * Sheets.
   */
  public async sheets(params: {bank: Bank; category: Category}, options?: Options): Promise<Sheet[]> {
    const sheets = await this.fetchSheet(params)

    if (!options?.excludeTtl) {
      sheets.unshift({count: lodash.sumBy(sheets, 'count'), id: '*', name: '全部', order: -999})
    }

    return lodash
      .chain(sheets)
      .sortBy(['order', 'name', 'id'], ['asc', 'asc', 'asc'])
      .map((_sheet, idx) => ({..._sheet, order: options?.excludeTtl ? idx : idx - 1}))
      .groupBy('name')
      .map((_sheets, _name) => {
        if (_sheets.length <= 1) return _sheets
        return _sheets.map((_sheet) => {
          const _shortId = _sheet.id.slice(0, 8)
          if (_sheet.name.includes(_shortId)) return _sheet
          return {..._sheet, name: `${_name} (${_shortId})`, orgName: _name}
        })
      })
      .flatten()
      .sortBy(['order', 'name', 'id'], ['asc', 'asc', 'asc'])
      .value()
  }

  /**
   * Invalidate cache.
   */
  public async invalidate(
    scope: HashKeyScope,
    params?: {bank?: Bank; category?: Category; output?: Output; questionId?: string; sheet?: Sheet},
  ): Promise<void> {
    const cacheKey = cacheKeyBuilder(scope)([params], this)
    let cacheClient = this.getCacheClient()
    if (scope === HashKeyScope.LOGIN) cacheClient = cacheManager.CommonClient
    await cacheClient.delHash(cacheKey)
    await sleep(1000)
  }

  /**
   * Login.
   */
  public async login(options?: LoginOptions): Promise<CacheRequestConfig> {
    if (options?.clean) await this.invalidate(HashKeyScope.LOGIN)
    return lodash.isNil(options?.password) ? this._login() : this.toLogin(options.password)
  }

  /**
   * Login.
   */
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.LOGIN), client: cacheManager.CommonClient})
  protected async _login(): Promise<CacheRequestConfig> {
    const vendorKey = (this.constructor as typeof Vendor).META.key
    throw new Error(`Please run 'vendor login -v ${vendorKey} -u ${this.getUsername()}' command to login first.`)
  }

  //
  // abstract
  //
  public abstract get allowedOutputs(): Record<string, OutputClass>

  public abstract fetchQuestions(
    params: {bank: Bank; category: Category; sheet: Sheet},
    options?: FetchOptions,
  ): Promise<void>

  protected abstract fetchBanks(): Promise<Bank[]>

  protected abstract fetchCategories(params: {bank: Bank}): Promise<Category[]>

  protected abstract fetchSheet(params: {bank: Bank; category: Category}): Promise<Sheet[]>

  protected abstract toLogin(password: string): Promise<CacheRequestConfig>
}

// Vendor class type
type VendorClass = new (username: string) => Vendor

// Export
export {cacheKeyBuilder, Vendor, VendorClass}

export {HashKeyScope} from '../cache-pattern.js'
