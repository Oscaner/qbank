import {Cacheable} from '@type-cacheable/core'
import {CacheRequestConfig} from 'axios-cache-interceptor'
import fs from 'fs-extra'
import lodash from 'lodash'
import path from 'node:path'
import sleep from 'sleep-promise'

import sqliteCache from '../../../cache/sqlite.manager.js'
import {PKG_ROOT_DIR} from '../../../env.js'
import {Bank} from '../../../types/bank.js'
import {Category} from '../../../types/category.js'
import {FetchOptions} from '../../../types/common.js'
import {Sheet} from '../../../types/sheet.js'
import {emitter} from '../../../utils/event.js'
import {safeName} from '../../../utils/index.js'
import {CACHE_KEY_ORIGIN_QUESTION_ITEM, HashKeyScope} from '../../cache-pattern.js'
import {OutputClass} from '../../output/common.js'
import Markji from '../../output/json/markji.js'
import {Vendor, cacheKeyBuilder} from '../common.js'

export default class JsonFile extends Vendor {
  public static META = {key: path.parse(import.meta.url).name, name: 'JSON 文件'}

  public get allowedOutputs(): Record<string, OutputClass> {
    return {
      [Markji.META.key]: Markji,
    }
  }

  /**
   * Fetch banks.
   */
  protected async fetchBanks(): Promise<Bank[]> {
    return [
      {
        id: 'assets/心理咨询原理与技术(课程代码 07049).json',
        name: '自考 > 心理咨询原理与技术 (07049)',
      },
    ]
  }

  /**
   * Fetch categories.
   */
  protected async fetchCategories(params: {bank: Bank}): Promise<Category[]> {
    const data = await this.getData(params.bank)

    const categories = [] as Category[]

    for (const category of data.categories) {
      categories.push({
        children: [],
        count: lodash.filter(data.questions, {category}).length,
        id: category,
        name: await safeName(category),
      })
    }

    return categories
  }

  /**
   * Questions.
   */
  public async fetchQuestions(
    params: {bank: Bank; category: Category; sheet: Sheet},
    options?: FetchOptions | undefined,
  ): Promise<void> {
    const cacheClient = this.getCacheClient()

    // cache key.
    const cacheKeyParams = {
      bankId: params.bank.id,
      categoryId: params.category.id,
      sheetId: params.sheet.id,
      vendorKey: (this.constructor as typeof Vendor).META.key,
    }

    const originQuestionKeys = await cacheClient.keys(
      lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)({...cacheKeyParams, questionId: '*'}),
    )

    // refetch.
    if (options?.refetch) {
      await cacheClient.delHash(lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)({...cacheKeyParams, questionId: '*'}))
      originQuestionKeys.length = 0
    }

    const data = await this.getData(params.bank)
    const questions = lodash.filter(data.questions, {category: params.category.id})
    const answers = lodash.filter(data.answers, {category: params.category.id})
    const explains = lodash.filter(data.explains, {category: params.category.id})

    emitter.emit('questions.fetch.count', originQuestionKeys.length)

    for (const _question of questions) {
      const _questionId = String(_question.id)

      const _questionCacheKey = lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)({
        ...cacheKeyParams,
        questionId: _questionId,
      })

      if (originQuestionKeys.includes(_questionCacheKey)) continue

      _question.answer = lodash.find(answers, (answer) => String(answer.id) === _questionId)?.content
      _question.explain = lodash.find(explains, (explain) => String(explain.id) === _questionId)?.content

      await cacheClient.set(_questionCacheKey, _question)
      originQuestionKeys.push(_questionCacheKey)
      emitter.emit('questions.fetch.count', originQuestionKeys.length)
    }

    emitter.emit('questions.fetch.count', originQuestionKeys.length)
    await sleep(500)
    emitter.closeListener('questions.fetch.count')
  }

  /**
   * Fetch sheet.
   */
  protected async fetchSheet(params: {bank: Bank; category: Category}): Promise<Sheet[]> {
    return [{count: params.category.count, id: '0', name: '默认'}]
  }

  /**
   * Get data.
   */
  protected async getData(bank: Bank): Promise<any> {
    if (!bank.id.endsWith('.json')) throw new Error(`Invalid bank ID: ${bank.id}`)

    const path = `${PKG_ROOT_DIR}/src/${bank.id}`

    const data = await fs.readJSON(path)

    data.questions = lodash.filter(
      data.questions,
      (question) => !lodash.isEmpty(question.category) && !lodash.isEmpty(question.type) && /^\d+$/.test(question.id),
    )

    return data
  }

  /**
   * Login.
   */
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.LOGIN), client: sqliteCache.CommonClient})
  protected async toLogin(_password: string): Promise<CacheRequestConfig<any, any>> {
    return {}
  }
}
