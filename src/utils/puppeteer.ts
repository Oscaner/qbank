import {AxiosRequestConfig} from 'axios'
import md5 from 'md5'
import {Browser, Page} from 'puppeteer'
import _puppeteer from 'puppeteer-extra'
import RecaptchaPlugin from 'puppeteer-extra-plugin-recaptcha'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import {Cookie} from 'tough-cookie'

import memory from '../cache/memory.manager.js'
import cookie from '../components/axios/plugin/cookie.js'
import {TWOCAPTCHA_API_KEY} from '../env.js'

const puppeteer = _puppeteer.default

puppeteer.use(StealthPlugin())

// @see https://github.com/berstend/puppeteer-extra/issues/916
puppeteer.use(
  RecaptchaPlugin.default({
    provider: {
      id: '2captcha',
      token: TWOCAPTCHA_API_KEY,
    },
    visualFeedback: true,
  }),
)

/**
 * Browser.
 */
const browser = async (create: boolean = true) => {
  const cacheKey = 'puppeteer:browser'

  let _browser = await memory.cache.get<Browser>(cacheKey)

  if ((!_browser || !_browser.connected) && create) {
    _browser = await puppeteer.launch({
      // HttpsUpgrades
      args: ['--disable-features=HttpsUpgrades'],
      // devtools: true,
      headless: false,
      protocolTimeout: 10 * 60 * 1000,
    })
    await memory.cache.set(cacheKey, _browser)
  }

  return _browser
}

/**
 * Page.
 */
const page = async (name: string, url: string, config?: AxiosRequestConfig) => {
  const pageCacheKey = `puppeteer:page:${md5(url)}`

  let _page = await memory.cache.get<Page>(pageCacheKey)

  if (!_page || _page.isClosed()) {
    const _browser = (await browser()) as Browser

    _page = await _browser.newPage()

    await _page!.setUserAgent(config?.headers?.['user-agent'] ?? (await _page.browser().userAgent()))

    await _page!.setExtraHTTPHeaders({
      'Accept-Language': config?.headers?.['accept-language'] ?? 'zh-CN,zh;q=0.9',
    })

    // cookies.
    for (const c of config?.headers?.['set-cookie'] ?? []) {
      const _ck = Cookie.parse(c) as Cookie
      cookie.jar.setCookieSync(_ck, `https://${_ck.domain}${_ck.path}`)
    }

    const cookies = await cookie.jar.store.getAllCookies()

    await _page!.browser().setCookie(...cookies.map((_ck) => cookie.toPuppeteer(_ck)))

    // params.
    const _url = URL.parse(url)!

    for (const [key, value] of Object.entries(config?.params ?? {})) {
      _url.searchParams.set(key, value as string)
    }

    await _page!.goto(_url.toString(), {timeout: 0, waitUntil: 'load'})

    await memory.cache.set(pageCacheKey, _page)
  }

  if (!_page) {
    throw new Error('Page not found')
  }

  return _page
}

const close = async () => {
  const _browser = await browser(false)
  await _browser?.close()

  const cacheKeys = [] as string[]

  for (const key of memory.store.keys) {
    if (String(key).startsWith('puppeteer:')) cacheKeys.push(key)
  }

  await memory.cache.mdel(cacheKeys)
}

export default {browser, close, page}
