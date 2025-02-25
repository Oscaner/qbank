import path from 'node:path'

import {Cacheable} from '@type-cacheable/core'
import type {CacheRequestConfig} from 'axios-cache-interceptor'
import lodash from 'lodash'
import md5 from 'md5'
import {parse} from 'node-html-parser'

import {Bank} from '../../../@types/bank.js'
import {Category} from '../../../@types/category.js'
import {FetchOptions} from '../../../@types/common.js'
import {Sheet} from '../../../@types/sheet.js'
import cacheManager from '../../../cache/cache.manager.js'
import {safeName} from '../../../utils/index.js'
import puppeteer from '../../../utils/puppeteer.js'
import axios from '../../axios/index.js'
import cookie from '../../axios/plugin/cookie.js'
import {OutputClass} from '../../output/common.js'
import {cacheKeyBuilder, HashKeyScope, Vendor} from '../common.js'

export default class ChaoXing extends Vendor {
  public static META = {key: path.parse(import.meta.url).name, name: '超星'}

  public get allowedOutputs(): Record<string, OutputClass> {
    return {}
  }

  public async fetchQuestions(
    _params: {bank: Bank; category: Category; sheet: Sheet},
    _options?: FetchOptions,
  ): Promise<void> {
    throw new Error('Method not implemented.')
  }

  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.BANKS)})
  protected async fetchBanks(): Promise<Bank[]> {
    // @see api.py::getCourse

    const config = await this.login()

    const resp = await axios.get(
      'https://mooc2-ans.chaoxing.com/mooc2-ans/visit/courses/list',
      lodash.merge({}, config, {
        params: {
          catalogId: 0,
          size: 500,
          start: 0,
          superstarClass: 0,
          v: Date.now(),
        },
      }),
    )

    const courses = await Promise.all(
      lodash.map(parse(resp.data).querySelectorAll('li.course'), async (li) => {
        const clazzId = li.querySelector('div.course-cover > input.clazzId')?.getAttribute('value')
        const clazzName = li.querySelector('div.course-info > p.overHidden1')?.textContent.replace('班级：', '').trim()

        const courseId = li.querySelector('div.course-cover > input.courseId')?.getAttribute('value')
        const courseName = li.querySelector('div.course-info > h3 span.course-name')?.textContent.trim()

        const courseUrl = li.querySelector('div.course-info > h3 > a')?.getAttribute('href')

        const courseTeacher = li.querySelector('div.course-info > p.line2.color3')?.textContent.trim()

        const courseView = courseUrl
          ? await axios.get(
              courseUrl,
              lodash.merge({}, config, {
                params: {
                  // catalogId: 0,
                  // size: 500,
                  // start: 0,
                  // superstarClass: 0,
                  // v: Date.now(),
                },
              }),
            )
          : {data: ''}

        const root = parse(courseView.data)

        const cpi = root.querySelector('input#cpi')?.getAttribute('value')
        const openc = root.querySelector('input#openc')?.getAttribute('value')
        const workEnc = root.querySelector('input#workEnc')?.getAttribute('value')
        const examEnc = root.querySelector('input#examEnc')?.getAttribute('value')

        return {
          clazzId,
          clazzName,
          courseId,
          courseName,
          courseTeacher,
          courseUrl,
          cpi,
          examEnc,
          openc,
          workEnc,
        }
      }),
    )

    const banks = [] as Bank[]

    for (const course of courses) {
      if (!course) continue

      banks.push({
        id: md5(JSON.stringify([course.clazzId, course.courseId])),
        meta: course,
        name: await safeName(lodash.filter([course.clazzName, course.courseName]).join(' > ')),
      })
    }

    return banks
  }

  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.CATEGORIES)})
  protected async fetchCategories(_params: {bank: Bank}): Promise<Category[]> {
    throw new Error('Method not implemented.')
  }

  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.SHEETS)})
  protected async fetchSheet(_params: {bank: Bank; category: Category}, _options?: FetchOptions): Promise<Sheet[]> {
    throw new Error('Method not implemented.')
  }

  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.LOGIN), client: cacheManager.CommonClient})
  protected async toLogin(password: string): Promise<CacheRequestConfig> {
    const page = await puppeteer.page('chaoxing', 'https://passport2.chaoxing.com/login')

    await page.type('input[id="phone"]', this.getUsername())
    await page.type('input[id="pwd"]', password)
    await Promise.all([page.waitForNavigation(), page.click('button[class="btn-big-blue margin-btm24"]')])

    const cookies = await page.browser().cookies()

    const headers = {
      'set-cookie': cookies.map((_ck) => cookie.toString(_ck)),
      'User-Agent':
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) ' +
        'AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 ' +
        '(schild:b86a8e29f117868cc8ab418362ef8800) (device:iPhone13,2) ' +
        'Language/zh-Hans com.ssreader.ChaoXingStudy/ChaoXingStudy_3_6.3.2_ios_phone_202409020930_249 ' +
        '(@Kalimdor)_12169545303473290717',
    }

    return {
      headers,
      params: {
        userid: lodash.find(cookies, {name: 'UID'})?.value,
      },
    }
  }
}
