import {Cacheable} from '@type-cacheable/core'
import {CacheRequestConfig} from 'axios-cache-interceptor'

import {Bank} from '../../types/bank.js'
import {Category} from '../../types/category.js'
import {Params} from '../../types/common.js'
import BiguoReal from './biguo-real.js'
import {HashKeyScope, cacheKeyBuilder} from './common.js'

export default class BiguoFree extends BiguoReal {
  public static META = {key: 'biguo-free', name: '笔果免费'}

  /**
   * Categories.
   */
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.CATEGORIES)})
  protected async fetchCategories(params: {bank: Bank}): Promise<Category[]> {
    return [{children: [], count: params.bank.count || 0, id: '0', name: '默认'}]
  }

  /**
   * Login.
   */
  public async login(password?: string): Promise<CacheRequestConfig> {
    return new BiguoReal(this.getUsername()).login(password)
  }

  /**
   * _biguoQuestionBankParam.
   */
  protected _biguoQuestionBankParam(params?: Params): Record<string, any> {
    const [provinceId, schoolId, professionId, , courseCode] = params
      ? params.bank.id.split('|')
      : [undefined, undefined, undefined]

    return {
      code: courseCode,
      mainType: 1,
      professions_id: professionId,
      province_id: provinceId,
      public_key:
        'LS0tLS1CRUdJTiBSU0EgUFVCTElDIEtFWS0' +
        'tLS0tCk1JR0pBb0dCQUxjNmR2MkFVaWRTR3' +
        'NNTlFmS0VtSVpQZVRqeWRxdzJmZ2ErcGJXa' +
        '3B3NGdrc09GR1gyWVRUOUQKOFp6K3FhWDJr' +
        'eWFsYi9xU1FsN3VvMVBsZTd6UVBHbU01RXo' +
        'yL2ErSU9TZVZYSTIxajBTZXV1SzJGZXpEcV' +
        'NtTwpRdEQzTDNJUWFhSURmYUx6NTg3MFNVc' +
        'CswRVBlZ2JkNTB3dEpqc2pnZzVZenU4WURP' +
        'ZXg1QWdNQkFBRT0KLS0tLS1FTkQgUlNBIFB' +
        'VQkxJQyBLRVktLS0tLQ==',
      school_id: schoolId,
    }
  }
}
