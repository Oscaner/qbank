import path from 'node:path'

import {Cacheable} from '@type-cacheable/core'
import type {CacheRequestConfig} from 'axios-cache-interceptor'

import {Bank} from '../../../@types/bank.js'
import {Category} from '../../../@types/category.js'
import {FetchOptions} from '../../../@types/common.js'
import {Sheet} from '../../../@types/sheet.js'
import cache from '../../../cache/cache.manager.js'
import {OutputClass} from '../../output/common.js'
import File from '../../output/file.js'
import {cacheKeyBuilder, HashKeyScope, Vendor} from '../common.js'

/**
 * https://www.examtopics.cn/#
 */
export default class MsExamtopics extends Vendor {
  public static META = {key: path.parse(import.meta.url).name, name: 'MS Azure'}

  public get allowedOutputs(): Record<string, OutputClass> {
    return {
      [File.META.key]: File,
    }
  }

  public async fetchQuestions(
    _params: {bank: Bank; category: Category; sheet: Sheet},
    _options?: FetchOptions,
  ): Promise<void> {
    throw new Error('Method not implemented.')
  }

  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.SHEETS)})
  public async fetchSheet(params: {bank: Bank; category: Category}, _options?: FetchOptions): Promise<Sheet[]> {
    return [{count: params.category.count, id: '0', name: '默认'}]
  }

  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.BANKS)})
  protected async fetchBanks(): Promise<Bank[]> {
    throw new Error('Method not implemented.')
  }

  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.CATEGORIES)})
  protected async fetchCategories(_params: {bank: Bank}): Promise<Category[]> {
    throw new Error('Method not implemented.')
  }

  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.LOGIN), client: cache.CommonClient})
  protected async toLogin(password: string): Promise<CacheRequestConfig> {
    return {
      headers: {password},
      params: {username: this.getUsername()},
    }
  }
}
