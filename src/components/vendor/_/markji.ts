import path from 'node:path'

import {Cacheable} from '@type-cacheable/core'
import {CacheRequestConfig} from 'axios-cache-interceptor'
import lodash from 'lodash'
import md5 from 'md5'

import {Chapter, Deck, Folder} from '../../../@types/vendor/markji.js'
import cacheManager from '../../../cache/cache.manager.js'
import axios from '../../axios/index.js'
import {Output, OutputClass} from '../../output/common.js'
import {cacheKeyBuilder, HashKeyScope, Vendor} from '../common.js'

/**
 * Markji vendor.
 */
export default class Markji extends Vendor {
  public static META = {key: path.parse(import.meta.url).name, name: 'Markji'}

  public get allowedOutputs(): Record<string, OutputClass> {
    return {}
  }

  public async chapters(params: {deck: Deck; folder: Folder}, options?: {excludeTtl?: true}): Promise<Chapter[]> {
    const _ = await this.sheets({bank: params.folder, category: params.deck}, options)
    return _ as Chapter[]
  }

  public async decks(params: {folder: Folder}, options?: {excludeTtl?: true}): Promise<Deck[]> {
    const _ = await this.categories({bank: params.folder}, options)
    return _ as Deck[]
  }

  public async fetchQuestions(): Promise<void> {
    throw new Error('Method not implemented.')
  }

  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.SHEETS)})
  public async fetchSheet(params: {bank: Folder; category: Deck}): Promise<Chapter[]> {
    const config = await this.login()

    const response = await axios.get(
      `https://www.markji.com/api/v1/decks/${params.category.id}/chapters`,
      lodash.merge({}, config, {cache: false}),
    )

    if (response.data.success === false) {
      throw new Error(response.data.errors)
    }

    return lodash.map(
      response.data.data.chapters,
      (item, idx): Chapter => ({
        count: item.card_ids.length,
        id: item.id,
        meta: {
          cardIds: item.card_ids,
          revision: item.revision,
          setRevision: response.data.data.chapterset.revision,
        },
        name: item.name,
        order: Number(idx),
      }),
    )
  }

  public async folders(options?: {excludeTtl?: true}): Promise<Folder[]> {
    const _ = await this.banks(options)
    return _ as Folder[]
  }

  public async invalidate(
    scope: HashKeyScope,
    params?: {chapter?: Chapter; deck?: Deck; folder?: Folder; output?: Output; questionId?: string},
  ): Promise<void> {
    await super.invalidate(
      scope,
      lodash.merge({bank: params?.folder, category: params?.deck, sheet: params?.chapter}, params),
    )
  }

  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.BANKS)})
  protected async fetchBanks(): Promise<Folder[]> {
    const config = await this.login()

    const response = await axios.get(
      'https://www.markji.com/api/v1/decks/folders',
      lodash.merge({}, config, {cache: false}),
    )

    if (response.data.success === false) {
      throw new Error(response.data.errors)
    }

    return lodash
      .chain(response.data.data.folders)
      .filter((item) => item.name !== 'root')
      .map(
        (item): Folder => ({
          id: item.id,
          meta: {
            items: item.items,
            updated_time: item.updated_time,
          },
          name: item.name,
        }),
      )
      .value()
  }

  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.CATEGORIES)})
  protected async fetchCategories(params: {bank: Folder}): Promise<Deck[]> {
    const config = await this.login()

    const response = await axios.get(
      'https://www.markji.com/api/v1/decks',
      lodash.merge({}, config, {
        cache: false,
        params: {
          folder_id: params.bank.id,
          limit: 3000,
          offset: 0,
        },
      }),
    )

    // the deck order stored in the folder is not the same as the order in the response
    const _hash = md5(JSON.stringify(params.bank))

    const _realBank = lodash.find(await this.fetchBanks(), {id: params.bank.id}) as Folder
    const _realHash = md5(JSON.stringify(_realBank))

    if (_hash !== _realHash) {
      await this.invalidate(HashKeyScope.BANKS)
      params.bank = lodash.find(await this.folders({excludeTtl: true}), {id: params.bank.id}) as Folder
    }

    return lodash.map(params.bank.meta.items, (item, idx): Deck => {
      const deck = lodash.find(response.data.data.decks, {id: item.object_id})

      return {
        children: [],
        count: deck.card_count,
        id: deck.id,
        meta: deck,
        name: deck.name,
        order: Number(idx),
      }
    })
  }

  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.LOGIN), client: cacheManager.CommonClient})
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
        token: response.data.data.token,
        'User-Agent': userAgent,
      },
    }
  }
}
