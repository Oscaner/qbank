import {AxiosInstance, AxiosRequestConfig} from 'axios'
import {HttpCookieAgent, HttpsCookieAgent} from 'http-cookie-agent/http'
import lodash from 'lodash'
import puppeteer from 'puppeteer'
import {Cookie, CookieJar} from 'tough-cookie'

const jar = new CookieJar()

const config: AxiosRequestConfig = {
  httpAgent: new HttpCookieAgent({cookies: {jar}}),
  httpsAgent: new HttpsCookieAgent({cookies: {jar}}),
  maxRedirects: 0,
}

const setup = (axios: AxiosInstance): AxiosInstance => {
  axios.defaults = lodash.merge({}, axios.defaults, config) as never

  axios.interceptors.request.use(async (config) => {
    for (const c of config.headers['set-cookie'] ?? []) {
      const _cookie = Cookie.parse(c) as Cookie

      const _url = new URL(config.url!)
      _cookie.domain = _cookie.domain || _url.hostname
      _cookie.path = _cookie.path || _url.pathname || '/'

      jar.setCookieSync(_cookie, `https://${_cookie.domain}${_cookie.path}`)
    }

    delete config.headers['set-cookie']

    config.headers.Cookie = config.headers.Cookie
      ? `${config.headers.Cookie}; ${jar.getCookieStringSync(config.url!)}`
      : jar.getCookieStringSync(config.url!)

    return config
  })

  axios.interceptors.response.use(
    async (response) => {
      // store cookies to jar.
      for (const c of response.headers['set-cookie'] ?? []) {
        const _cookie = Cookie.parse(c) as Cookie

        if (lodash.has(response, 'headers.location')) {
          const _url = new URL(response.headers.location)
          _cookie.domain = _cookie.domain || _url.hostname
          _cookie.path = _cookie.path || _url.pathname || '/'
        } else {
          _cookie.domain = _cookie.domain || response.request?.host
          _cookie.path = _cookie.path || response.request?.path || '/'
        }

        jar.setCookieSync(_cookie, `https://${_cookie.domain}${_cookie.path}`)
      }

      return response
    },
    async (error) => {
      if (error.status === 302) {
        const {response} = error

        // store cookies to jar.
        for (const c of response.headers['set-cookie'] ?? []) {
          const _cookie = Cookie.parse(c) as Cookie

          const _url = new URL(response.headers.location)
          _cookie.domain = _cookie.domain || _url.hostname
          _cookie.path = _cookie.path || _url.pathname || '/'

          jar.setCookieSync(_cookie, `https://${_cookie.domain}${_cookie.path}`)
        }

        const _nextConfig = lodash.merge({}, error.config, {
          headers: {Cookie: jar.getCookieStringSync(error.config.url!)},
          url: response.headers.location,
        })

        const resp = await axios.request(_nextConfig)

        return resp
      }

      throw error
    },
  )

  return axios
}

const toString = (cookie: Cookie | puppeteer.Cookie): string => {
  const _ck = []

  if (cookie instanceof Cookie) {
    _ck.push(`${cookie.key}=${cookie.value}`)

    if (cookie.domain) _ck.push(`Domain=${cookie.domain}`)
    if (cookie.path) _ck.push(`Path=${cookie.path}`)
    if (cookie.expires) _ck.push(`Expires=${cookie.expires}`)
    if (cookie.httpOnly) _ck.push(`HttpOnly`)
    if (cookie.secure) _ck.push(`Secure`)
    if (cookie.sameSite) _ck.push(`SameSite=${cookie.sameSite}`)
    if (cookie.maxAge) _ck.push(`Max-Age=${cookie.maxAge}`)
    if (cookie.extensions) _ck.push(...cookie.extensions)
  } else {
    _ck.push(`${cookie.name}=${cookie.value}`)

    if (cookie.domain) _ck.push(`Domain=${cookie.domain}`)
    if (cookie.path) _ck.push(`Path=${cookie.path}`)
    if (cookie.expires) _ck.push(`Expires=${cookie.expires}`)
    if (cookie.httpOnly) _ck.push(`HttpOnly`)
    if (cookie.secure) _ck.push(`Secure`)
    if (cookie.sameSite) _ck.push(`SameSite=${cookie.sameSite}`)
    if (cookie.size > 0) _ck.push(`Size=${cookie.size}`)
    if (cookie.session) _ck.push(`Session`)
    if (cookie.priority) _ck.push(`Priority=${cookie.priority}`)
  }

  return _ck.join('; ')
}

const toPuppeteer = (cookie: Cookie): puppeteer.Cookie => {
  const _ck = {} as puppeteer.Cookie

  _ck.domain = cookie.domain || ''
  _ck.domain = _ck.domain.split('.').length === 2 ? `.${_ck.domain}` : _ck.domain

  if (cookie.expires === 'Infinity') {
    _ck.expires = -1
  } else if (cookie.expires) {
    _ck.expires = cookie.expires.getTime() / 1000
  } else {
    _ck.expires = -1
  }

  _ck.httpOnly = cookie.httpOnly
  _ck.name = cookie.key
  _ck.path = cookie.path || '/'
  _ck.sameSite = cookie.sameSite as puppeteer.CookieSameSite
  _ck.secure = cookie.secure
  _ck.session = Boolean(cookie.extensions?.includes('Session'))

  const size = lodash.find(cookie.extensions, (v: string) => v.startsWith('Size'))
  _ck.size = Number(size?.split('=')?.[1] ?? encodeURIComponent(cookie.value).length)

  _ck.value = cookie.value

  return _ck
}

export default {jar, setup, toPuppeteer, toString}
