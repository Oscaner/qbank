import {Cacheable} from '@type-cacheable/core'
import {CacheRequestConfig} from 'axios-cache-interceptor'
import lodash from 'lodash'
import path from 'node:path'

import sqliteCache from '../../../cache/sqlite.manager.js'
import {Bank, MarkjiFolder} from '../../../types/bank.js'
import {Category} from '../../../types/category.js'
import {MarkjiChapter} from '../../../types/sheet.js'
import axios from '../../../utils/axios.js'
import {OutputClass} from '../../output/common.js'
import {HashKeyScope, Vendor, cacheKeyBuilder} from '../common.js'

export default class Markji extends Vendor {
  public static META = {key: path.parse(import.meta.url).name, name: 'Markji'}

  public get allowedOutputs(): Record<string, OutputClass> {
    return {}
  }

  /**
   * Banks = Markji Folders.
   */
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.BANKS)})
  protected async fetchBanks(): Promise<MarkjiFolder[]> {
    const requestConfig = await this.login()

    const response = await axios.get(
      'https://www.markji.com/api/v1/decks/folders',
      lodash.merge({}, requestConfig, {cache: false}),
    )

    if (response.data.success === false) {
      throw new Error(response.data.errors)
    }

    return lodash
      .chain(response.data.data.folders)
      .filter((item) => item.name !== 'root')
      .map((item) => ({
        id: item.id,
        items: item.items,
        key: item.id,
        name: item.name,
        updated_time: item.updated_time,
      }))
      .value()
  }

  /**
   * Categories = Markji Decks.
   */
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.CATEGORIES)})
  protected async fetchCategories(params: {bank: MarkjiFolder}): Promise<Category[]> {
    const requestConfig = await this.login()

    const response = await axios.get(
      'https://www.markji.com/api/v1/decks',
      lodash.merge({}, requestConfig, {
        cache: false,
        params: {
          folder_id: params.bank.id,
          limit: 3000,
          offset: 0,
        },
      }),
    )

    // the deck order stored in the folder is not the same as the order in the response
    await this.invalidate(HashKeyScope.BANKS)
    params.bank = lodash.find(await this.banks({excludeTtl: true}), {id: params.bank.id}) as MarkjiFolder

    return lodash.map(params.bank.items, (item, idx) => {
      const deck = lodash.find(response.data.data.decks, {id: item.object_id})

      return {
        children: [],
        count: deck.card_count,
        id: deck.id,
        name: deck.name,
        order: Number(idx),
      }
    })
  }

  public async fetchQuestions(): Promise<void> {
    throw new Error('Method not implemented.')
  }

  /**
   * Sheet = Markji Chapters.
   */
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.SHEETS)})
  public async fetchSheet(params: {bank: Bank; category: Category}): Promise<MarkjiChapter[]> {
    const requestConfig = await this.login()

    const response = await axios.get(
      `https://www.markji.com/api/v1/decks/${params.category.id}/chapters`,
      lodash.merge({}, requestConfig, {cache: false}),
    )

    if (response.data.success === false) {
      throw new Error(response.data.errors)
    }

    return lodash.map(response.data.data.chapters, (item, idx) => ({
      cardIds: item.card_ids,
      count: item.card_ids.length,
      id: item.id,
      name: item.name,
      order: Number(idx),
      revision: item.revision,
      setRevision: response.data.data.chapterset.revision,
    }))
  }

  /**
   * Login.
   */
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.LOGIN), client: sqliteCache.CommonClient})
  protected async toLogin(password: string): Promise<CacheRequestConfig> {
    const userAgent =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0'

    const response = await axios.post(
      'https://www.markji.com/api/v1/users/login',
      {
        identity: this.getUsername(),
        nuencrypt_fields: ['password'],
        password,
      },
      {
        cache: false,
        headers: {
          'User-Agent': userAgent,
        },
      },
    )

    if (response.data.success === false) {
      throw new Error(response.data.errors)
    }

    return {
      headers: {
        'User-Agent': userAgent,
        token: response.data.data.token,
      },
    }
  }
}
