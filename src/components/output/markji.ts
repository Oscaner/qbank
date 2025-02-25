import lodash from 'lodash'
import {natsort} from 'natsort-esm'
import sleep from 'sleep-promise'

import {AssetString, ConvertOptions, QBankParams, UploadOptions} from '../../@types/common.js'
import {emitter} from '../../utils/event.js'
import {reverseTemplate, throwError} from '../../utils/index.js'
import markji from '../../utils/vendor/markji.js'
import {CACHE_KEY_ORIGIN_QUESTION_ITEM, CACHE_KEY_QUESTION_ITEM, HashKeyScope} from '../cache-pattern.js'
import {Vendor} from '../vendor/common.js'
import {Output} from './common.js'

export default class Markji extends Output {
  public static META = {key: 'markji', name: 'Markji'}

  HTML_STYLE = [
    '<style type="text/css">',
    'html { font-size: 42px; }',
    `img { min-height: 42px; max-width: 90% }`,
    '</style>',
  ].join(' ')

  public async convert(qbank: QBankParams, options?: ConvertOptions): Promise<void> {
    // prepare.
    const cacheClient = this.getCacheClient()
    qbank.output = this

    // cache key.
    const cacheKeyParams = {
      bankId: qbank.bank.id,
      categoryId: qbank.category.id,
      outputKey: (this.constructor as typeof Output).META.key,
      sheetId: qbank.sheet.id,
      vendorKey: (qbank.vendor.constructor as typeof Vendor).META.key,
    }

    // check origin questions.
    const allQuestionParams = lodash.map(
      await cacheClient.keys(lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)({...cacheKeyParams, questionId: '*'})),
      (key) => reverseTemplate(CACHE_KEY_ORIGIN_QUESTION_ITEM, key),
    )

    // check questions.
    if (options?.reconvert) {
      await qbank.vendor.invalidate(HashKeyScope.QUESTIONS, {...qbank, output: this, questionId: '*'})
    }

    const doneQuestionParams = lodash.map(
      await cacheClient.keys(lodash.template(CACHE_KEY_QUESTION_ITEM)({...cacheKeyParams, questionId: '*'})),
      (key) => reverseTemplate(CACHE_KEY_QUESTION_ITEM, key),
    )

    const undoQuestionParams = lodash
      .differenceWith(
        allQuestionParams,
        doneQuestionParams,
        (a, b) =>
          a.bankId === b.bankId &&
          a.categoryId === b.categoryId &&
          a.sheetId === b.sheetId &&
          a.questionId === b.questionId,
      )
      .sort(natsort({insensitive: true}))

    // convert.
    emitter.emit('output.convert.count', doneQuestionParams.length)

    for (const _questionParam of undoQuestionParams) {
      // emit.
      emitter.emit('output.convert.count', doneQuestionParams.length)

      // _questionParam.
      _questionParam.outputKey = (this.constructor as typeof Output).META.key

      // _originQuestion.
      const _originQuestion = await cacheClient.get(lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)(_questionParam))

      // _output.
      const output = await this.toMarkjiOutput(_originQuestion, qbank)

      if (output.text.length > 2500) {
        throwError('Output text is too long.', {output: output.text, qbank, question: _originQuestion})
      }

      // ===========================
      await cacheClient.set(lodash.template(CACHE_KEY_QUESTION_ITEM)(_questionParam), output)

      doneQuestionParams.push(_questionParam)

      await sleep(500)
    }

    emitter.emit('output.convert.count', doneQuestionParams.length)

    await sleep(500)

    emitter.closeListener('output.convert.count')
  }

  public async upload(qbank: QBankParams, options?: UploadOptions): Promise<void> {
    qbank.output = this

    const markjiParams = await markji.getMarkjiParams(qbank, this.getOutputUsername())

    await markji.bulkUpload({
      cacheClient: this.getCacheClient(),
      markji: markjiParams,
      qbank,
      uploadOptions: options,
    })
  }

  protected async toMarkjiOutput(question: any, qbank: QBankParams): Promise<AssetString> {
    throwError('Not implemented.', {qbank, question})
  }
}
