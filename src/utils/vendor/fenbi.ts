import lodash from 'lodash'

import {handleImageSrc, isJSON, throwError} from '../index.js'
import puppeteer from '../puppeteer.js'

const PUBLIC_KEY =
  'ANKi9PWuvDOsagwIVvrPx77mXNV0APmjySsYjB1' +
  '/GtUTY6cyKNRl2RCTt608m9nYk5VeCG2EAZRQmQ' +
  'NQTyfZkw0Uo+MytAkjj17BXOpY4o6+BToi7rRKf' +
  'TGl6J60/XBZcGSzN1XVZ80ElSjaGE8Ocg8wbPN18tbmsy761zN5SuIl'

const encrypt = async (data1: any | null, data2: any | null): Promise<null | string> => {
  const page = await puppeteer.page('fenbi', 'https://www.fenbi.com')

  await page.waitForFunction(
    () => {
      // eslint-disable-next-line no-undef
      return (window as any).encrypt
    },
    {timeout: 0},
  )

  const encrypt = await page.evaluate(
    (data) => {
      // eslint-disable-next-line no-undef
      return (window as any).encrypt(data.data1, data.data2)
    },
    {data1, data2},
  )

  return encrypt as string
}

const srcHandler = (src: string): string | string[] => {
  const srcs = []

  if (src.startsWith('/api/planet/accessories')) {
    srcs.push('https://fb.fenbike.cn' + src, 'https://fb.fbstatic.cn' + src)
  } else if (src.startsWith('//')) {
    srcs.push('https:' + src)
  } else {
    srcs.push(src)
  }

  return srcs
}

const parseDoc = async (str: string | undefined): Promise<string> => {
  if (lodash.isUndefined(str)) return ''

  if (!isJSON(str)) return str

  const data = JSON.parse(str)

  const elements = []

  switch (data.name) {
    case 'b':
    case 'i':
    case 'p':
    case 'phrase':
    case 'u':
    case 'ud': {
      elements.push(`<${data.name}>`)

      if (!lodash.isEmpty(data.value)) {
        elements.push(data.value)
      }

      if (!lodash.isEmpty(data.children)) {
        const children = await Promise.all(lodash.map(data.children, async (child) => parseDoc(JSON.stringify(child))))
        elements.push(...children)
      }

      elements.push(`</${data.name}>`)

      break
    }

    case 'br': {
      elements.push('<br />')

      break
    }

    case 'color': {
      elements.push(`<span style="color: ${data.value}">`)

      if (!lodash.isEmpty(data.children)) {
        const children = await Promise.all(lodash.map(data.children, async (child) => parseDoc(JSON.stringify(child))))
        elements.push(...children)
      }

      elements.push('</span>')

      break
    }

    case 'doc': {
      if (!lodash.isEmpty(data.value)) {
        throwError('Not implemented yet', data)
      }

      if (!lodash.isEmpty(data.children)) {
        const children = await Promise.all(lodash.map(data.children, async (child) => parseDoc(JSON.stringify(child))))
        elements.push(...children)
      }

      break
    }

    case 'img': {
      elements.push(`<img src="https://fb.fenbike.cn/api/tarzan/images/${data.value}" />`)

      break
    }

    case 'input': {
      const _attrs = lodash
        .chain(data.value)
        .split(',')
        .map((dv) => {
          const _dv = dv.split(':')
          return `${_dv[0]}="${_dv[1]}"`
        })
        .join(' ')
        .value()

      elements.push(`<input ${_attrs} />`)

      break
    }

    case 'tex': {
      const src = await handleImageSrc(`/api/planet/accessories/formulas?latex=${data.value}`, srcHandler)

      elements.push(`<img src="${src}" />`)

      break
    }

    case 'txt': {
      elements.push(data.value)

      break
    }

    default: {
      throwError(`Not implemented yet of data name (${data.name})`, data)
    }
  }

  return elements.join('')
}

export default {encrypt, parseDoc, PUBLIC_KEY, srcHandler}
