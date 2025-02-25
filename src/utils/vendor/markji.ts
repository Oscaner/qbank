import {CacheRequestConfig} from 'axios-cache-interceptor'
import {dataUriToBuffer} from 'data-uri-to-buffer'
import FormData from 'form-data'
import lodash from 'lodash'
import md5 from 'md5'
import {natsort} from 'natsort-esm'
import sleep from 'sleep-promise'
import * as streamifier from 'streamifier'

import {Bank} from '../../@types/bank.js'
import {Category} from '../../@types/category.js'
import {AssetString, ParseOptions, QBankParams} from '../../@types/common.js'
import {Sheet} from '../../@types/sheet.js'
import {BulkUploadOptions, Chapter, Deck, Folder, MarkjiParams} from '../../@types/vendor/markji.js'
import memory from '../../cache/memory.manager.js'
import axios from '../../components/axios/index.js'
import {CACHE_KEY_QUESTION_ITEM} from '../../components/cache-pattern.js'
import {Output} from '../../components/output/common.js'
import Markji from '../../components/vendor/_/markji.js'
import {HashKeyScope, Vendor} from '../../components/vendor/common.js'
import VendorManager from '../../components/vendor/index.js'
import {emitter} from '../event.js'
import html from '../html.js'
import {find, safeName, throwError} from '../index.js'

const ensureContact = async (markji: {deck: Deck; folder: Folder; vendor: Markji}, config: CacheRequestConfig) => {
  const get = async (clean: boolean = false): Promise<[Chapter[], Chapter]> => {
    if (clean) {
      await markji.vendor.invalidate(HashKeyScope.SHEETS, markji)
    }

    const chapters = await markji.vendor.chapters(markji)
    const chapter = lodash.find(chapters, {name: '默认章节'}) as Chapter

    return [chapters, chapter]
  }

  let [, defaultChapter] = await get()

  if (!defaultChapter) [, defaultChapter] = await get(true)

  const cardId = defaultChapter.meta.cardIds?.[0]

  const content = [
    '',
    '[P#H1,center#[T#!36b59d#感谢大家的使用]]',
    '如果有任何问题，请评论留下你的联系方式，我会尽快回复。',
    '',
  ].join('\n')

  if (!cardId) {
    await axios.post(
      `https://www.markji.com/api/v1/decks/${markji.deck.id}/chapters/${defaultChapter.id}/cards`,
      {card: {content, grammar_version: 3}, order: 0},
      config,
    )

    return
  }

  const card = await axios.get(
    `https://www.markji.com/api/v1/decks/${markji.deck.id}/cards/${cardId}`,
    lodash.merge({id: `markji:card:${cardId}`}, config),
  )

  if (card.data.data.card.content === content) return

  await axios.post(
    `https://www.markji.com/api/v1/decks/${markji.deck.id}/cards/${cardId}`,
    {card: {content, grammar_version: 3}, order: 0},
    lodash.merge({cache: {update: {[`markji:card:${cardId}`]: 'delete'}}}, config),
  )
}

/**
 * _folder.
 */
const _folder = async (
  markji: {vendor: Markji},
  qbank: {vendor: Vendor},
  config: CacheRequestConfig,
): Promise<Folder> => {
  const vendorMeta = (qbank.vendor.constructor as typeof Vendor).META

  const get = async (clean: boolean = false): Promise<[Folder[], Folder]> => {
    if (clean) {
      await markji.vendor.invalidate(HashKeyScope.BANKS)
    }

    const folders = await markji.vendor.folders()
    const folder = lodash.find(folders, {name: vendorMeta.name}) as Folder

    return [folders, folder]
  }

  let [folders, folder] = await get()

  if (!folder) {
    // invalidate.
    ;[folders, folder] = await get(true)
  }

  // create.
  if (!folder) {
    await axios.post(
      'https://www.markji.com/api/v1/decks/folders',
      {name: vendorMeta.name, order: folders.length},
      lodash.merge({}, config, {cache: false}),
    )

    // invalidate.
    ;[folders, folder] = await get(true)
  }

  return folder
}

/**
 * _deck.
 */
const _deck = async (
  markji: {folder: Folder; vendor: Markji},
  qbank: {bank: Bank; vendor: Vendor},
  config: CacheRequestConfig,
): Promise<Deck> => {
  const vendorMeta = (qbank.vendor.constructor as typeof Vendor).META

  const get = async (clean: boolean = false): Promise<[Deck[], Deck]> => {
    if (clean) {
      await markji.vendor.invalidate(HashKeyScope.CATEGORIES, markji)
    }

    const decks = await markji.vendor.decks({folder: markji.folder})
    const deck = lodash.find(decks, {
      // meta: {description: vendorMeta.key},
      name: qbank.bank.name,
    }) as Deck

    return [decks, deck]
  }

  let [decks, deck] = await get()

  if (!deck) {
    // invalidate.
    ;[decks, deck] = await get(true)
  }

  // create.
  if (!deck) {
    await axios.post(
      'https://www.markji.com/api/v1/decks',
      {
        description: markji.folder.name,
        folder_id: markji.folder.id,
        is_private: false,
        name: qbank.bank.name,
        order: decks.length,
      },
      lodash.merge({}, config, {cache: false}),
    )

    // invalidate.
    ;[decks, deck] = await get(true)
  }

  // update description.
  if (deck.meta?.description !== vendorMeta.key) {
    await axios.post(
      `https://www.markji.com/api/v1/decks/${deck.id}`,
      {description: vendorMeta.key, is_private: deck.meta?.is_private, name: deck.name},
      config,
    )

    // invalidate.
    ;[decks, deck] = await get(true)
  }

  // sort.
  if (deck.order !== qbank.bank.order) {
    ;[decks, deck] = await get(true)
  }

  if (deck.order !== qbank.bank.order) {
    markji.folder = lodash.find(await markji.vendor.folders(), {id: markji.folder.id}) as Folder

    const _occupier = lodash.find(decks, {order: qbank.bank.order})

    if (_occupier) {
      _occupier.order = deck.order
    }

    deck.order = qbank.bank.order

    await axios.post(
      `https://www.markji.com/api/v1/decks/folders/${markji.folder.id}/sort`,
      {
        items: lodash
          .chain(decks)
          .filter((deck) => deck.id !== '*')
          .sortBy(['order', 'name'], ['asc', 'asc'])
          .map((deck) => ({object_class: 'DECK', object_id: deck.id}))
          .value(),
        updated_time: markji.folder.meta?.updated_time,
      },
      lodash.merge({}, config, {cache: false}),
    )

    // invalidate.
    ;[decks, deck] = await get(true)
  }

  return deck
}

/**
 * _chapter.
 */
const _chapterName = async (qbank: {category: Category; sheet: Sheet}): Promise<string> => {
  if (qbank.sheet.id === '0') return safeName(qbank.category.name)
  if (qbank.sheet.id === md5('0')) return safeName(qbank.category.name)
  return safeName(`${qbank.category.name} / ${qbank.sheet.name}`)
}

const _chapter = async (
  markji: {deck: Deck; folder: Folder; vendor: Markji},
  qbank: {bank: Bank; category: Category; sheet: Sheet; vendor: Vendor},
  config: CacheRequestConfig,
): Promise<Chapter> => {
  const get = async (clean: boolean = false): Promise<[string, Chapter[], Chapter]> => {
    if (clean) {
      await markji.vendor.invalidate(HashKeyScope.SHEETS, markji)
    }

    const chapters = await markji.vendor.chapters(markji)
    const chapterName = await _chapterName(qbank)
    const chapter = lodash.find(chapters, {name: chapterName}) as Chapter

    return [chapterName, chapters, chapter]
  }

  let [chapterName, chapters, chapter] = await get()

  if (!chapter) {
    // invalidate.
    ;[chapterName, chapters, chapter] = await get(true)
  }

  // create.
  if (!chapter) {
    await axios.post(
      `https://www.markji.com/api/v1/decks/${markji.deck.id}/chapters`,
      {name: chapterName, order: chapters.length},
      lodash.merge({}, config, {cache: false}),
    )

    // invalidate.
    ;[chapterName, chapters, chapter] = await get(true)
  }

  // sort.
  let _paramSheetOrder = 1

  for (const _category of await qbank.vendor.categories(qbank, {excludeTtl: true})) {
    if (_category.id === qbank.category.id) {
      _paramSheetOrder += qbank.sheet.order || 0
      break
    }

    const _sheets = await qbank.vendor.sheets({bank: qbank.bank, category: _category}, {excludeTtl: true})
    _paramSheetOrder += _sheets.length
  }

  if (chapter.order !== _paramSheetOrder) {
    ;[chapterName, chapters, chapter] = await get(true)
  }

  if (chapter.order !== _paramSheetOrder) {
    const _occupier = lodash.find(chapters, {order: _paramSheetOrder})

    if (_occupier) {
      _occupier.order = chapter.order
    }

    chapter.order = _paramSheetOrder

    await axios.post(
      `https://www.markji.com/api/v1/decks/${markji.deck.id}/chapters/sort`,
      {
        chapter_ids: lodash
          .chain(chapters)
          .filter((chapter) => chapter.id !== '*')
          .sortBy(['order', 'name'], ['asc', 'asc'])
          .map('id')
          .value(),
        revision: chapter.meta.setRevision,
      },
      lodash.merge({}, config, {cache: false}),
    )

    // invalidate.
    ;[chapterName, chapters, chapter] = await get(true)
  }

  return chapter
}

/**
 * Markji Info.
 * | -------------- | --------------- | --------------- |
 * | Markji Folders | markji.bank     | qbank.vendor   |
 * | Markji Decks   | markji.category | qbank.bank     |
 * | Markji Chapters| markji.sheet    | qbank.category |
 */
const getMarkjiParams = async (qbank: QBankParams, username: string): Promise<MarkjiParams> => {
  const markji = new (VendorManager.getClass('markji'))(username) as Markji
  const config = await markji.login()

  // markji folders.
  const folder = await _folder({vendor: markji}, {vendor: qbank.vendor}, config)

  // ==========================
  // markji decks.
  const deck = await _deck({folder, vendor: markji}, {bank: qbank.bank, vendor: qbank.vendor}, config)

  // ==========================
  // markji chapters.
  const chapter = await _chapter(
    {deck, folder, vendor: markji},
    {bank: qbank.bank, category: qbank.category, sheet: qbank.sheet, vendor: qbank.vendor},
    config,
  )

  // ==========================
  // default card.
  await ensureContact({deck, folder, vendor: markji}, config)

  // prune dirty.
  await pruneDirty({bank: qbank.bank, vendor: qbank.vendor}, {config, deck, folder, vendor: markji})

  return {chapter, config, deck, folder}
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
    find(Object.values(content.assets), 'data:image', {fuzzy: true}) ||
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
const bulkDelete = async (markji: MarkjiParams, cardIds: string[]): Promise<void> => {
  const chunks = lodash
    .chain(cardIds)
    .map((cardId) => [markji.chapter.id, cardId])
    .chunk(50)
    .value()

  for (const _chunk of chunks) {
    await axios.post(
      `https://www.markji.com/api/v1/decks/${markji.deck.id}/cards/remove`,
      {cards: _chunk},
      markji.config,
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
  const {cacheClient, markji, qbank, uploadOptions} = options

  // check questions.
  const allQuestionKeys = lodash
    .chain(
      await cacheClient.keys(
        lodash.template(CACHE_KEY_QUESTION_ITEM)({
          bankId: qbank.bank.id,
          categoryId: qbank.category.id,
          outputKey: (qbank.output?.constructor as typeof Output).META.key,
          questionId: '*',
          sheetId: qbank.sheet.id,
          vendorKey: (qbank.vendor.constructor as typeof Vendor).META.key,
        }),
      ),
    )
    .sort((a, b) => natsort({insensitive: true})(a.split(':').pop(), b.split(':').pop())) // asc.
    .value()

  if (markji.chapter.count < allQuestionKeys.length) {
    uploadOptions.reupload = true
  }

  const doneQuestionCount = uploadOptions?.reupload ? 0 : markji.chapter.count || 0
  const doneQuestionIdx = doneQuestionCount - 1

  // delete
  if (markji.chapter.meta.cardIds.length > 0 && allQuestionKeys.length === 0) {
    throwError('Dangerous', {qbank})
  }

  await bulkDelete(markji, markji.chapter.meta.cardIds.slice(allQuestionKeys.length))

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

      await upload(markji, _questionIdx, _question)

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
const upload = async (markji: MarkjiParams, index: number, question: AssetString): Promise<void> => {
  if (lodash.isEmpty(question)) return

  for (const [key, value] of Object.entries(question.assets)) {
    if (value.startsWith('data:')) {
      const parsed = dataUriToBuffer(value)

      // filename
      let filename = key + '.' + parsed.type.split('/')[1]

      if (parsed.type.startsWith('audio')) {
        filename = key + '.mp3'
      }

      // form.
      const form = new FormData()

      form.append('file', streamifier.createReadStream(Buffer.from(parsed.buffer)), {
        contentType: parsed.type,
        filename,
      })

      const latestUploadTime = await memory.cache.get<number>('markji:latestUploadTime')

      if (latestUploadTime) {
        const diff = Date.now() - latestUploadTime
        if (diff < 1500) await sleep(1500 - diff)
      }

      const response = await axios.post('https://www.markji.com/api/v1/files', form, markji.config)

      await memory.cache.set('markji:latestUploadTime', Date.now())

      if (response.data.data.file.mime.startsWith('image')) {
        question.assets[key] = `[Pic#ID/${response.data.data.file.id}#]`
      } else if (response.data.data.file.mime.startsWith('audio')) {
        question.assets[key] = `[Audio#ID/${response.data.data.file.id}#]`
      }
    }

    question.text = question.text.replaceAll(key, question.assets[key])
  }

  const cardId = markji.chapter.meta.cardIds[index]

  try {
    await (cardId
      ? axios.post(
          `https://www.markji.com/api/v1/decks/${markji.deck.id}/cards/${cardId}`,
          {card: {content: question.text, grammar_version: 3}, order: index},
          markji.config,
        )
      : axios.post(
          `https://www.markji.com/api/v1/decks/${markji.deck.id}/chapters/${markji.chapter.id}/cards`,
          {card: {content: question.text, grammar_version: 3}, order: index},
          markji.config,
        ))
  } catch (error) {
    throwError('Upload failed.', {error, question})
  }
}

/**
 * Prune dirty.
 */
const pruneDirty = async (
  qbank: {bank: Bank; vendor: Vendor},
  markji: {config: CacheRequestConfig; deck: Deck; folder: Folder; vendor: Markji},
): Promise<void> => {
  const status = await memory.cache.get<boolean>(`markji:pruneDirty:${qbank.bank.id}`)

  if (status) return

  const categories = await qbank.vendor.categories({bank: qbank.bank})

  const allChapterNames = new Set(
    (
      await Promise.all(
        lodash.map(categories, async (cat) => {
          const sheets = await qbank.vendor.sheets({bank: qbank.bank, category: cat})

          return Promise.all(lodash.map(sheets, (sheet) => _chapterName({category: cat, sheet})))
        }),
      )
    ).flat(),
  )

  const todoChapters = lodash.filter(
    (await markji.vendor.chapters(markji, {excludeTtl: true})) as Chapter[],
    (chapter) => {
      if (chapter.name === '默认章节') return false
      return !allChapterNames.has(chapter.name)
    },
  )

  for (const chapter of todoChapters) {
    await bulkDelete({...markji, chapter}, chapter.meta.cardIds)
    await axios.delete(`https://www.markji.com/api/v1/decks/${markji.deck.id}/chapters/${chapter.id}`, markji.config)
  }

  await memory.cache.set(`markji:pruneDirty:${qbank.bank.id}`, true)
}

export default {bulkDelete, bulkUpload, ensureContact, getMarkjiParams, parseHtml, pruneDirty, upload}
