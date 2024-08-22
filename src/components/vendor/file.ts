import {CacheRequestConfig} from 'axios-cache-interceptor'
import fs from 'fs-extra'
import lodash from 'lodash'
import {packageDirectory} from 'pkg-dir'
import sleep from 'sleep-promise'

import {Bank} from '../../types/bank.js'
import {Category} from '../../types/category.js'
import {FetchOptions} from '../../types/common.js'
import {Sheet} from '../../types/sheet.js'
import {emitter} from '../../utils/event.js'
import {CACHE_KEY_ORIGIN_QUESTION_ITEM} from '../cache-pattern.js'
import {OutputClass} from '../output/common.js'
import Markji from '../output/file/markji.js'
import {Vendor} from './common.js'

export default class File extends Vendor {
  public static META = {key: 'file', name: 'File'}

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
        key: 'assets/心理咨询原理与技术(课程代码 07049).json',
        name: '自考 > 心理咨询原理与技术 (07049)',
      },
    ]
  }

  /**
   * Fetch categories.
   */
  protected async fetchCategories(bank: Bank): Promise<Category[]> {
    const data = await this._getData(bank)
    return lodash.map(data.categories, (category) => ({
      children: [],
      count: lodash.filter(data.questions, {category}).length,
      id: category,
      name: category,
    }))
  }

  /**
   * Fetch questions.
   */
  public async fetchQuestions(
    bank: Bank,
    category: Category,
    sheet: Sheet,
    options?: FetchOptions | undefined,
  ): Promise<void> {
    const cacheClient = this.getCacheClient()

    // cache key.
    const cacheKeyParams = {
      bankId: bank.id,
      categoryId: category.id,
      sheetId: sheet.id,
      vendorKey: (this.constructor as typeof Vendor).META.key,
    }

    const originQuestionItemCacheKey = lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)(cacheKeyParams)

    const questionIds = lodash.map(
      await cacheClient.keys(originQuestionItemCacheKey + ':*'),
      (key) => key.split(':').pop() as string,
    )

    if (options?.refetch) {
      await cacheClient.del(originQuestionItemCacheKey + ':*')
      questionIds.length = 0
    }

    const data = await this._getData(bank)
    const questions = lodash.filter(data.questions, {category: category.id})
    const answers = lodash.filter(data.answers, {category: category.id})
    const explains = lodash.filter(data.explains, {category: category.id})

    emitter.emit('questions.fetch.count', questionIds.length)

    for (const _question of questions) {
      if (questionIds.includes(_question.id)) continue

      _question.answer = lodash.find(answers, {id: _question.id})?.content
      _question.explain = lodash.find(explains, {id: _question.id})?.content

      await cacheClient.set(originQuestionItemCacheKey + ':' + _question.id, _question)
      if (!questionIds.includes(_question.id)) questionIds.push(_question.id)
      emitter.emit('questions.fetch.count', questionIds.length)
    }

    emitter.emit('questions.fetch.count', questionIds.length)
    await sleep(1000)
    emitter.closeListener('questions.fetch.count')
  }

  /**
   * Fetch sheet.
   */
  protected async fetchSheet(_bank: Bank, category: Category): Promise<Sheet[]> {
    return [{count: category.count, id: '0', name: '默认'}]
  }

  /**
   * To login.
   */
  protected async toLogin(_password: string): Promise<CacheRequestConfig<any, any>> {
    return {}
  }

  /**
   * Get data.
   */
  protected async _getData(bank: Bank): Promise<any> {
    const root = await packageDirectory()

    if (!bank.id.endsWith('.json')) throw new Error(`Invalid bank ID: ${bank.id}`)

    const path = `${root}/src/${bank.id}`
    return fs.readJson(path)
  }
}
