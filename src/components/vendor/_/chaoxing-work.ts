import path from 'node:path'

import {Cacheable} from '@type-cacheable/core'
import {AxiosRequestConfig} from 'axios'
import {CacheRequestConfig} from 'axios-cache-interceptor'
import lodash from 'lodash'
import md5 from 'md5'
import {parse} from 'node-html-parser'
import sleep from 'sleep-promise'

import {Bank} from '../../../@types/bank.js'
import {Category} from '../../../@types/category.js'
import {FetchOptions, LoginOptions} from '../../../@types/common.js'
import {Sheet} from '../../../@types/sheet.js'
import {emitter} from '../../../utils/event.js'
import puppeteer from '../../../utils/puppeteer.js'
import axios from '../../axios/index.js'
import {CACHE_KEY_ORIGIN_QUESTION_ITEM} from '../../cache-pattern.js'
import {OutputClass} from '../../output/common.js'
import Skip from '../../output/skip.js'
import {cacheKeyBuilder, HashKeyScope, Vendor} from '../common.js'
import ChaoXing from './chaoxing.js'

/**
 * @see https://github.com/aglorice/new_xxt/blob/red/my_xxt/api.py
 */
export default class ChaoXingWork extends ChaoXing {
  public static META = {key: path.parse(import.meta.url).name, name: '超星作业'}

  public get allowedOutputs(): Record<string, OutputClass> {
    return {
      [Skip.META.key]: Skip,
    }
  }

  public async fetchQuestions(
    params: {bank: Bank; category: Category; sheet: Sheet},
    options?: FetchOptions,
  ): Promise<void> {
    const cacheClient = this.getCacheClient()

    // cache key.
    const cacheKeyParams = {
      bankId: params.bank.id,
      categoryId: params.category.id,
      sheetId: params.sheet.id,
      vendorKey: (this.constructor as typeof Vendor).META.key,
    }

    const orgQKeys = await cacheClient.keys(
      lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)({...cacheKeyParams, questionId: '*'}),
    )

    // refetch.
    if (options?.refetch) {
      await cacheClient.delHash(lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)({...cacheKeyParams, questionId: '*'}))
      orgQKeys.length = 0
    }

    emitter.emit('questions.fetch.count', orgQKeys.length)

    if (orgQKeys.length <= params.sheet.count) {
      for (const question of params.category.meta?.questions ?? []) {
        const qParser = parse(question)

        const _qId = qParser.querySelector('> div')!.getAttribute('data')

        const _qCacheKey = lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)({
          ...cacheKeyParams,
          questionId: _qId,
        })

        if (orgQKeys.includes(_qCacheKey)) continue

        await cacheClient.set(_qCacheKey, question)
        orgQKeys.push(_qCacheKey)
        emitter.emit('questions.fetch.count', orgQKeys.length)
      }
    }

    emitter.emit('questions.fetch.count', orgQKeys.length)
    await sleep(500)
    emitter.closeListener('questions.fetch.count')
  }

  public async login(options?: LoginOptions): Promise<CacheRequestConfig> {
    return new ChaoXing(this.getUsername()).login(options)
  }

  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.CATEGORIES)})
  protected async fetchCategories(params: {bank: Bank}): Promise<Category[]> {
    const config = await this.login()

    if (!params.bank.meta?.courseUrl) {
      return []
    }

    // to course page.
    const courseView = await axios.get(
      params.bank.meta.courseUrl,
      lodash.merge({}, config, {
        maxRedirects: 0,
        params: {
          catalogId: 0,
          size: 500,
          start: 0,
          superstarClass: 0,
          v: Date.now(),
        },
      } as AxiosRequestConfig),
    )

    const root = parse(courseView.data)

    const workEnc = root.querySelector('input#workEnc')?.getAttribute('value')

    // to work view.
    const page = await puppeteer.page(
      'chaoxing',
      'https://mooc1.chaoxing.com/mooc2/work/list?' +
        `classId=${params.bank.meta.clazzId}&courseId=${params.bank.meta.courseId}&enc=${workEnc}&ut=s`,
    )

    const lis = await page.$$('div.has-content ul > li')

    const categories = [] as Category[]

    for (const li of lis) {
      // attribute data
      const url = await li.evaluate((el) => el.getAttribute('data') as string)
      const name = await li.evaluate((el) => el.querySelector('div.right-content > p.overHidden2.fl')?.textContent)
      const status = await li.evaluate((el) => el.querySelector('div.right-content > p.status.fl')?.textContent)

      if (status === '未开始') continue

      const questions = await (
        await puppeteer.page('chaoxing', url, config)
      ).$$eval('div[id^="question"]', (divs) => divs.map((div) => div.outerHTML))

      const urlParams = new URLSearchParams(url)

      categories.push({
        children: [],
        count: Number(questions.length),
        id: md5(urlParams.get('workId') ?? ''),
        meta: {questions, url},
        name: name ?? '',
        order: categories.length,
      })
    }

    return categories
  }

  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.SHEETS)})
  protected async fetchSheet(params: {bank: Bank; category: Category}, _options?: FetchOptions): Promise<Sheet[]> {
    return [{count: params.category.count, id: md5('0'), name: '默认'}]
  }
}
