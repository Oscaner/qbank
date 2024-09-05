import lodash from 'lodash'

import {AssetString, Params} from '../../../types/common.js'
import html from '../../../utils/html.js'
import {throwError} from '../../../utils/index.js'
import markji from '../../../utils/vendor/markji.js'
import MarkjiBase from '../markji.js'

export default class Markji extends MarkjiBase {
  /**
   * _output.
   */
  protected async _output(question: any, params: Params): Promise<AssetString> {
    const _questionType = question.topic_type

    let output = {} as AssetString

    // ====================
    switch (_questionType) {
      // 1. 单选题
      // 2. 多选题
      // 3. 判断题
      case 1:
      case 2:
      case 3: {
        output = await this._processChoice(question, params)
        break
      }

      // 4. 问答题
      // 8. 名词解释
      // 9. 单词练习
      // 10. 简答题
      // 12. 论述题
      // 13. 案例分析题
      // 21. 英译汉
      // 22. 汉译英
      case 4:
      case 8:
      case 9:
      case 10:
      case 12:
      case 13:
      case 21:
      case 22: {
        output = await this._processTranslate(question, params)
        break
      }

      // 5. 填空题
      case 5: {
        output = await this._processBlankFilling(question, params)
        break
      }

      default: {
        throwError('Unsupported question type', question)
      }
    }

    return output
  }

  /**
   * _processBlankFilling
   */
  protected async _processBlankFilling(question: any, params: Params): Promise<AssetString> {
    const _meta = {
      content: {assets: [] as never, text: ''} as AssetString,
      explain: {assets: [] as never, text: ''} as AssetString,
    }

    // ====================
    // _content.
    _meta.content = await markji.parseHtml(question.questionAsk)

    // ====================
    // _blanks.
    let _blanks = [] as string[]

    const _inputs = lodash.filter(Object.keys(_meta.content.assets), (assertKey) => assertKey.includes('[input#'))
    const correctOption = question.correctOption as string

    // 1. 单个
    if (_inputs.length === 1) {
      _blanks = [correctOption]
    }
    // 2. ；分隔
    else if (correctOption.includes('；') || correctOption.includes(';')) {
      _blanks = correctOption.split(/[;；]/)
    }
    // 3. 和分隔
    else if (correctOption.includes('和')) {
      _blanks = correctOption.split('和')
    }
    // 4. 、分隔
    else if (correctOption.includes('、')) {
      _blanks = correctOption.split('、')
    }
    // 5. 连续空格分割
    else if (correctOption.includes('  ')) {
      _blanks = correctOption.split(/\s{2,}/)
    }

    // unknown to process.
    if (_inputs.length === 0 || _blanks.length === 0 || _inputs.length !== _blanks.length) {
      return this._processTranslate(question, params)
    }

    for (const [idx, assertKey] of _inputs.entries()) {
      if (!assertKey.includes('[input#')) continue
      _meta.content.assets[assertKey] = `[F#${idx + 1}#${_blanks[idx]}]`
      _meta.content.text = _meta.content.text.replaceAll(assertKey, _meta.content.assets[assertKey])
    }

    // ====================
    // _explain.
    _meta.explain = await markji.parseHtml(question.explanation)

    // ====================
    // _points.
    const _points = [
      '[P#L#[T#B#来源]]',
      `${params.bank.name} - ${params.category.name} - ${question.sheet.name}`,
      '[P#L#[T#B#题型]]',
      question.topic_type_name,
      '[P#L#[T#B#解析]]',
      lodash.trim(_meta.explain.text),
    ]

    // ===========================
    // _output.
    const _output = await html.toText(
      lodash
        .filter([`[${question.topic_type_name}]`, lodash.trim(_meta.content.text), '---', ..._points])
        .join('\n')
        .trim()
        .replaceAll('\n', '<br>'),
    )

    _output.assets = lodash.merge({}, _meta.content.assets, _meta.explain.assets)

    return _output
  }

  /**
   * _processChoice.
   */
  protected async _processChoice(question: any, params: Params): Promise<AssetString> {
    const htmlStyle = [
      '<style type="text/css">',
      'html { font-size: 42px; }',
      `img { min-height: 42px; }`,
      '</style>',
    ].join(' ')

    const _meta = {
      answers: [] as AssetString[],
      content: {assets: [] as never, text: ''} as AssetString,
      explain: {assets: [] as never, text: ''} as AssetString,
      options: [] as AssetString[],
      optionsAttr: question.topic_type === 2 ? 'fixed,multi' : 'fixed',
    }

    // ====================
    // _content.
    _meta.content = await markji.parseHtml(question.questionAsk)

    // ====================
    // _options.
    const _options = lodash
      .chain(question)
      .pickBy((_value, key) => key.match(/^[A-Z]$/))
      .map((value, key) => (value ? `${key}. ${value}` : ''))
      .filter()
      .value()

    // 富文本选项
    if (_options.join('').length > 800) {
      const _htmlStyle = ['<style type="text/css">', 'p { display: inline-block; }', '</style>'].join(' ')

      const _optionsContent = await html.toImage(`${htmlStyle}\n${_htmlStyle}\n${_options.join('<br>')}`)

      _meta.content.text += `\n${_optionsContent.text}`
      _meta.content.assets = lodash.merge({}, _meta.content.assets, _optionsContent.assets)
    }
    // 普通选项
    else {
      _meta.options = await Promise.all(lodash.map(_options, (option) => markji.parseHtml(option)))
    }

    // ====================
    // _answers.
    _meta.answers = lodash.filter(_meta.options, (option) => {
      const correctOptions = lodash.split(question.correctOption, '')
      return correctOptions.includes(option.text[0])
    })

    _meta.options = lodash.map(_meta.options, (option) => ({
      assets: option.assets,
      text: `${_meta.answers.includes(option) ? '*' : '-'} ${option.text}`,
    }))

    // ====================
    // _explain.
    _meta.explain = await markji.parseHtml(question.explanation)

    // ====================
    // _points.
    const _points = [
      '[P#L#[T#B#来源]]',
      `${params.bank.name} - ${params.category.name} - ${question.sheet.name}`,
      '[P#L#[T#B#题型]]',
      question.topic_type_name,
      '[P#L#[T#B#解析]]',
      lodash.trim(_meta.explain.text),
    ]

    // ===========================
    // _output.
    const _output = await html.toText(
      lodash
        .filter([
          `[${question.topic_type_name}]`,
          lodash.trim(_meta.content.text),
          `[Choice#${_meta.optionsAttr}#\n${lodash.trim(lodash.map(_meta.options, 'text').join('\n'))}\n]\n`,
          '---\n',
          ..._points,
        ])
        .join('\n')
        .trim()
        .replaceAll('\n', '<br>'),
    )

    _output.assets = lodash.merge(
      {},
      _meta.content.assets,
      ...lodash.map(_meta.options, 'assets'),
      _meta.explain.assets,
      ...lodash.map(_meta.answers, 'assets'),
    )

    return _output
  }

  /**
   * _processTranslate
   */
  protected async _processTranslate(question: any, params: Params): Promise<AssetString> {
    const _meta = {
      content: {assets: [] as never, text: ''} as AssetString,
      explain: {assets: [] as never, text: ''} as AssetString,
      translation: {assets: [] as never, text: ''} as AssetString,
    }

    // ===========================
    // _content.
    _meta.content = await markji.parseHtml(question.questionAsk || '')

    // ===========================
    // _translation.
    _meta.translation = await markji.parseHtml(question.correctOption || '')

    // ===========================
    // _explain.
    _meta.explain = await markji.parseHtml(question.explanation || '')

    // ===========================
    // _points.
    const _points = [
      '[P#L#[T#B#来源]]',
      `${params.bank.name} - ${params.category.name} - ${question.sheet.name}`,
      '[P#L#[T#B#题型]]',
      question.topic_type_name,
      `[P#L#[T#B#解析]]`,
      lodash.trim(_meta.explain.text),
    ]

    // _output.
    const _output = await html.toText(
      lodash
        .filter([
          `[${question.topic_type_name}]`,
          lodash.trim(_meta.content.text),
          '---',
          _meta.translation.text,
          '---',
          ..._points,
        ])
        .join('\n')
        .trim()
        .replaceAll('\n', '<br>'),
    )

    _output.assets = lodash.merge({}, _meta.content.assets, _meta.translation.assets, _meta.explain.assets)

    return _output
  }
}
