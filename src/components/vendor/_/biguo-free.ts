import {Cacheable} from '@type-cacheable/core'
import {CacheRequestConfig} from 'axios-cache-interceptor'
import path from 'node:path'

import {Bank} from '../../../types/bank.js'
import {Category} from '../../../types/category.js'
import {Params} from '../../../types/common.js'
import {Sheet} from '../../../types/sheet.js'
import {HashKeyScope, cacheKeyBuilder} from '../common.js'
import BiguoReal from './biguo-real.js'

export default class BiguoFree extends BiguoReal {
  public static META = {key: path.parse(import.meta.url).name, name: '笔果免费'}

  /**
   * Sheet.
   */
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.SHEETS)})
  protected async fetchSheet(params: {bank: Bank; category: Category}): Promise<Sheet[]> {
    return [{count: params.category.count, id: '0', name: '默认'}]
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
    const [provinceId, schoolId, professionId] = params ? params.bank.id.split('|') : [undefined, undefined, undefined]
    const [, courseCode] = params ? params.category.id.split('|') : [undefined, undefined]

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
