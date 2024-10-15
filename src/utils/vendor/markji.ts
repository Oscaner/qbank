import {CacheRequestConfig} from 'axios-cache-interceptor'
import {dataUriToBuffer} from 'data-uri-to-buffer'
import FormData from 'form-data'
import lodash from 'lodash'
import sleep from 'sleep-promise'
import * as streamifier from 'streamifier'

import {CACHE_KEY_QUESTION_ITEM} from '../../components/cache-pattern.js'
import {Output} from '../../components/output/common.js'
import {HashKeyScope, Vendor} from '../../components/vendor/common.js'
import VendorManager from '../../components/vendor/index.js'
import {Bank, MarkjiFolder} from '../../types/bank.js'
import {Category} from '../../types/category.js'
import {AssetString, Params, ParseOptions} from '../../types/common.js'
import {MarkjiChapter, Sheet} from '../../types/sheet.js'
import {BulkUploadOptions, MarkjiInfo} from '../../types/vendor/markji.js'
import axios from '../axios.js'
import {emitter} from '../event.js'
import html from '../html.js'
import {find, safeName, throwError} from '../index.js'

const ensureContact = async (
  params: {deck: Category; folder: Bank; markji: Vendor},
  requestConfig: CacheRequestConfig,
) => {
  await params.markji.invalidate(HashKeyScope.SHEETS, {bank: params.folder, category: params.deck})
  const chapters = (await params.markji.sheets({bank: params.folder, category: params.deck})) as MarkjiChapter[]
  const defaultChapter = find<MarkjiChapter>(chapters, '默认章节') as MarkjiChapter
  const cardId = defaultChapter.cardIds[0]

  // if (cardId) {
  //   bulkDelete({...params, chapter: defaultChapter, requestConfig}, [cardId])
  // }

  // const content = `
  // [P#H1,center#[T#!36b59d#感谢大家的使用]]
  // 由于 app 没有回复反馈的功能，关于牌组的使用问题，可以添加我的微信，请备注来自 Markji。
  // 同时，如果希望[T#!36b59d,!!#添加新牌组]，请[T#!36b59d,!!#提供一下题库信息]，我也会评估工作量再决定是否添加。

  // [P#L#[T#B#微信：]oscaner1997]
  // [P#L#[T#B#新题库信息：]]
  // 1. 题库来源（尽可能详细）
  // 2. 如果是 vip 题库，请提供一个 vip 账号。（不强求，自行考虑）
  // `

  const content = `
[P#H1,center#[T#!36b59d#感谢大家的使用]]
由于 app 没有回复反馈的功能，关于牌组的使用问题，可以添加我的微信，请备注来自 Markji。

[P#L#[T#B#微信：]oscaner1997]
`

  await (cardId
    ? axios.post(
        `https://www.markji.com/api/v1/decks/${params.deck.id}/cards/${cardId}`,
        {card: {content, grammar_version: 3}, order: 0},
        requestConfig,
      )
    : axios.post(
        `https://www.markji.com/api/v1/decks/${params.deck.id}/chapters/${defaultChapter.id}/cards`,
        {card: {content, grammar_version: 3}, order: 0},
        requestConfig,
      ))
}

/**
 * _folder.
 */
const _folder = async (
  markji: Vendor,
  params: {vendor: Vendor},
  requestConfig: CacheRequestConfig,
): Promise<MarkjiFolder> => {
  await markji.invalidate(HashKeyScope.BANKS)

  const vendorMeta = (params.vendor.constructor as typeof Vendor).META

  let folders = await markji.banks()
  let folder = find<MarkjiFolder>(folders, vendorMeta.name)

  // create.
  if (!folder) {
    await axios.post(
      'https://www.markji.com/api/v1/decks/folders',
      {name: vendorMeta.name, order: folders.length},
      lodash.merge({}, requestConfig, {cache: false}),
    )

    await markji.invalidate(HashKeyScope.BANKS)
    folders = await markji.banks()
    folder = find<MarkjiFolder>(folders, vendorMeta.name) as Bank
  }

  return folder
}

/**
 * _deck.
 */
const _deck = async (
  markji: Vendor,
  info: {folder: MarkjiFolder},
  params: {bank: Bank},
  requestConfig: CacheRequestConfig,
): Promise<Category> => {
  await markji.invalidate(HashKeyScope.CATEGORIES, {bank: info.folder})

  let decks = await markji.categories({bank: info.folder})
  let deck = find<Category>(decks, params.bank.name)

  // create.
  if (!deck) {
    await axios.post(
      'https://www.markji.com/api/v1/decks',
      {folder_id: info.folder.id, is_private: false, name: params.bank.name, order: decks.length},
      lodash.merge({}, requestConfig, {cache: false}),
    )

    await markji.invalidate(HashKeyScope.CATEGORIES, {bank: info.folder})
    decks = await markji.categories({bank: info.folder})
    deck = find<Category>(decks, params.bank.name) as Category
  }

  // sort.
  if (deck.order !== params.bank.order) {
    info.folder = lodash.find(await markji.banks(), {id: info.folder.id}) as MarkjiFolder

    const _occupier = lodash.find(decks, {order: params.bank.order})

    if (_occupier) {
      _occupier.order = deck.order
    }

    deck.order = params.bank.order

    await axios.post(
      `https://www.markji.com/api/v1/decks/folders/${info.folder.id}/sort`,
      {
        items: lodash
          .chain(decks)
          .filter((deck) => deck.id !== '*')
          .sortBy(['order', 'name'], ['asc', 'asc'])
          .map((deck) => ({object_class: 'DECK', object_id: deck.id}))
          .value(),
        updated_time: info.folder.updated_time,
      },
      lodash.merge({}, requestConfig, {cache: false}),
    )

    await markji.invalidate(HashKeyScope.CATEGORIES, {bank: info.folder})
    decks = await markji.categories({bank: info.folder})
    deck = find<Category>(decks, params.bank.name) as Category
  }

  return deck
}

/**
 * _chapter.
 */
const _chapter = async (
  markji: Vendor,
  info: {deck: Category; folder: MarkjiFolder},
  params: {bank: Bank; category: Category; sheet: Sheet; vendor: Vendor},
  requestConfig: CacheRequestConfig,
): Promise<MarkjiChapter> => {
  await markji.invalidate(HashKeyScope.SHEETS, {bank: info.folder, category: info.deck})

  const chapterName = await safeName(
    params.sheet.id === '0' ? params.category.name : `${params.category.name} / ${params.sheet.name}`,
  )

  let chapters = (await markji.sheets({bank: info.folder, category: info.deck})) as MarkjiChapter[]
  let chapter = find<MarkjiChapter>(chapters, chapterName)

  // create.
  if (!chapter) {
    await axios.post(
      `https://www.markji.com/api/v1/decks/${info.deck.id}/chapters`,
      {name: chapterName, order: chapters.length},
      lodash.merge({}, requestConfig, {cache: false}),
    )

    await markji.invalidate(HashKeyScope.SHEETS, {bank: info.folder, category: info.deck})
    chapters = (await markji.sheets({bank: info.folder, category: info.deck})) as MarkjiChapter[]
    chapter = find<MarkjiChapter>(chapters, chapterName) as MarkjiChapter
  }

  // sort.
  let _paramSheetOrder = 1

  for (const _category of await params.vendor.categories(params, {excludeTtl: true})) {
    if (_category.id === params.category.id) {
      _paramSheetOrder += params.sheet.order || 0
      break
    }

    const _sheets = await params.vendor.sheets({bank: params.bank, category: _category}, {excludeTtl: true})
    _paramSheetOrder += _sheets.length
  }

  if (chapter.order !== _paramSheetOrder) {
    const _occupier = lodash.find(chapters, {order: _paramSheetOrder})

    if (_occupier) {
      _occupier.order = chapter.order
    }

    chapter.order = _paramSheetOrder

    await axios.post(
      `https://www.markji.com/api/v1/decks/${info.deck.id}/chapters/sort`,
      {
        chapter_ids: lodash
          .chain(chapters)
          .filter((chapter) => chapter.id !== '*')
          .sortBy(['order', 'name'], ['asc', 'asc'])
          .map('id')
          .value(),
        revision: chapter.setRevision,
      },
      lodash.merge({}, requestConfig, {cache: false}),
    )

    await markji.invalidate(HashKeyScope.SHEETS, {bank: info.folder, category: info.deck})
    chapters = (await markji.sheets({bank: info.folder, category: info.deck})) as MarkjiChapter[]
    chapter = find<MarkjiChapter>(chapters, chapterName) as MarkjiChapter
  }

  return chapter
}

/**
 * Markji Info.
 * | -------------- | --------------- | --------------- |
 * | Markji Folders | markji.bank     | params.vendor   |
 * | Markji Decks   | markji.category | params.bank     |
 * | Markji Chapters| markji.sheet    | params.category |
 */
const getInfo = async (params: Params, username: string): Promise<MarkjiInfo> => {
  const markji = new (VendorManager.getClass('markji'))(username)
  const requestConfig = await markji.login()

  // markji folders.
  const folder = await _folder(markji, {vendor: params.vendor}, requestConfig)

  // ==========================
  // markji decks.
  const deck = await _deck(markji, {folder}, {bank: params.bank}, requestConfig)

  // ==========================
  // markji chapters.
  const chapter = await _chapter(
    markji,
    {deck, folder},
    {bank: params.bank, category: params.category, sheet: params.sheet, vendor: params.vendor},
    requestConfig,
  )

  // ==========================
  // default card.
  await ensureContact({deck, folder, markji}, requestConfig)

  return {chapter, deck, folder}
}

/**
 * Parse HTML.
 */
const parseHtml = async (text: string, options?: ParseOptions): Promise<AssetString> => {
  let content = await html.toText(text, options)

  if (
    // large content.
    content.text.length > 800 ||
    // has image.
    find(Object.values(content.assets), 'data:', {fuzzy: true}) ||
    // has underline.
    text.includes('<u>') ||
    // has span.
    text.includes('<span') ||
    // 上标
    text.includes('<sup>') ||
    // 下标
    text.includes('<sub>') ||
    // 加粗
    text.includes('<b>')
  ) {
    content = await html.toImage(text, options)
  }

  return content
}

/**
 * Bulk Delete.
 */
const bulkDelete = async (info: MarkjiInfo, cardIds: string[]): Promise<void> => {
  for (const cardId of cardIds) {
    await axios.delete(
      `https://www.markji.com/api/v1/decks/${info.deck.id}/chapters/${info.chapter.id}/cards/${cardId}`,
      info.requestConfig,
    )
  }
}

/**
 * Bulk Upload.
 */
const bulkUpload = async (options: BulkUploadOptions): Promise<void> => {
  // default options.
  options.uploadOptions = options.uploadOptions || {}

  // prepare.
  const {cacheClient, markjiInfo, params, uploadOptions} = options

  // check questions.
  const allQuestionKeys = lodash
    .chain(
      await cacheClient.keys(
        lodash.template(CACHE_KEY_QUESTION_ITEM)({
          bankId: params.bank.id,
          categoryId: params.category.id,
          outputKey: (params.output?.constructor as typeof Output).META.key,
          questionId: '*',
          sheetId: params.sheet.id,
          vendorKey: (params.vendor.constructor as typeof Vendor).META.key,
        }),
      ),
    )
    .sort((a, b) => Number(a) - Number(b)) // asc.
    .value()

  if (markjiInfo.chapter.count < allQuestionKeys.length) {
    uploadOptions.reupload = true
  }

  const doneQuestionCount = uploadOptions?.reupload ? 0 : markjiInfo.chapter.count || 0
  const doneQuestionIdx = doneQuestionCount - 1

  // delete
  if (markjiInfo.chapter.cardIds.length > 0 && allQuestionKeys.length === 0) {
    throwError('Dangerous', {params})
  }

  await bulkDelete(markjiInfo, markjiInfo.chapter.cardIds.slice(allQuestionKeys.length))

  // upload.
  if (uploadOptions?.totalEmit) uploadOptions?.totalEmit(allQuestionKeys.length)

  emitter.emit('output.upload.count', doneQuestionCount || 0)

  if (allQuestionKeys.length > doneQuestionCount) {
    // upload.
    for (const [_questionIdx, _questionKey] of allQuestionKeys.entries()) {
      // skip.
      if (_questionIdx <= doneQuestionIdx) {
        emitter.emit('output.upload.count', _questionIdx + 1)
        continue
      }

      const _question: AssetString = await cacheClient.get(_questionKey)

      await upload(markjiInfo, _questionIdx, _question)

      // emit.
      emitter.emit('output.upload.count', _questionIdx + 1)
      await sleep(500)
    }
  }

  emitter.emit('output.upload.count', allQuestionKeys.length)

  await sleep(500)

  emitter.closeListener('output.upload.count')
}

/**
 * Upload.
 */
const upload = async (info: MarkjiInfo, index: number, question: AssetString): Promise<void> => {
  if (lodash.isEmpty(question)) return

  for (const [key, value] of Object.entries(question.assets)) {
    if (value.startsWith('data:')) {
      const parsed = dataUriToBuffer(value)
      const filename = key + '.' + parsed.type.split('/')[1]

      const form = new FormData()

      form.append('file', streamifier.createReadStream(Buffer.from(parsed.buffer)), {
        contentType: parsed.type,
        filename,
      })

      const response = await axios.post('https://www.markji.com/api/v1/files', form, info.requestConfig)

      question.assets[key] = `[Pic#ID/${response.data.data.file.id}#]`
    }

    question.text = question.text.replaceAll(key, question.assets[key])
  }

  const cardId = info.chapter.cardIds[index]

  try {
    await (cardId
      ? axios.post(
          `https://www.markji.com/api/v1/decks/${info.deck.id}/cards/${cardId}`,
          {card: {content: question.text, grammar_version: 3}, order: index},
          info.requestConfig,
        )
      : axios.post(
          `https://www.markji.com/api/v1/decks/${info.deck.id}/chapters/${info.chapter.id}/cards`,
          {card: {content: question.text, grammar_version: 3}, order: index},
          info.requestConfig,
        ))
  } catch (error) {
    throwError('Upload failed.', {error, question})
  }
}

export default {bulkDelete, bulkUpload, ensureContact, getInfo, parseHtml, upload}
