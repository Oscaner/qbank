import lodash from 'lodash'

import {AssetString, QBankParams} from '../../../@types/common.js'
import html from '../../../utils/html.js'
import {throwError} from '../../../utils/index.js'
import parser from '../../../utils/parser.js'
import fenbi from '../../../utils/vendor/fenbi.js'
import markji from '../../../utils/vendor/markji.js'
import MarkjiBase from '../markji.js'

// export enum QuestionType {
//   TypeInvalid = 0,
//   TypeSingleChoice = 1,
//   TypeMultiChoice = 2,
//   TypeUncertainChoice = 3,
//   TypeCloze = 4,
//   TypeTrueOrFlase = 5,
//   TypeReadingComprehension5In7 = 6,
//   TypeProof = 11,
//   TypeEssay = 12,
//   TypeCaculation = 13,
//   TypeReadingComprehension = 14,
//   TypeAnalysis = 15,
//   TypeCorrection = 16,
//   TypeOther = 50,
//   TypeBlankFilling = 61,
//   TypeAccountingEntry = 62,
//   TypeYufa = 64,
//   TypeOfficeWord = 106,
//   TypeOfficeExcel = 107,
//   TypeOfficePPT = 108,
//   TypeOfficeSUB = 5,
//   TypeOnlineCorrect = 21,
//   ESSAY_ANALYSIS = 22,
//   ESSAY_STRATEGY = 23,
//   ESSAY_OFFICIAL = 24,
//   ESSAY_WRITING = 25,
//   ESSAY_VIEW = 26,
//   PIAN_DUAN = 104,
// }

// switch (t) {
//   case r.e.TypeSingleChoice: {
//     return '\u5355\u9009\u9898'
//   }

//   case r.e.TypeMultiChoice: {
//     return '\u591A\u9009\u9898'
//   }

//   case r.e.TypeTrueOrFlase: {
//     return '\u5224\u65AD\u9898'
//   }

//   case r.e.TypeUncertainChoice: {
//     return '\u4E0D\u5B9A\u9879'
//   }

//   case r.e.TypeBlankFilling: {
//     return '\u586B\u7A7A\u9898'
//   }

//   case r.e.TypeEssay: {
//     return '\u8BBA\u8FF0\u9898'
//   }

//   case r.e.TypeAnalysis: {
//     return '\u5206\u6790\u9898'
//   }

//   case r.e.TypeOther: {
//     return '\u5176\u4ED6\uFF08\u9AD8\u8003\u586B\u7A7A\uFF09'
//   }

//   case r.e.TypeProof: {
//     return '\u8BC1\u660E\u9898'
//   }

//   case r.e.TypeYufa: {
//     return '\u8BED\u6CD5\u586B\u7A7A'
//   }

//   case r.e.TypeCaculation: {
//     return '\u8BA1\u7B97\u9898'
//   }

//   case r.e.TypeCorrection: {
//     return '\u6539\u9519'
//   }

//   case r.e.TypeCloze: {
//     return '\u5B8C\u5F62\u586B\u7A7A'
//   }

//   case r.e.TypeReadingComprehension5In7: {
//     return '\u9605\u8BFB\u7406\u89E37\u90095'
//   }

//   case r.e.TypeReadingComprehension: {
//     return '\u9605\u8BFB\u7406\u89E3'
//   }

//   default: {
//     return '\u5176\u4ED6'
//   }
// }

export default class Markji extends MarkjiBase {
  protected async __makeMaterials(qbank: QBankParams, question: any, meta: any): Promise<any> {
    if (lodash.isEmpty(question.materials)) return meta

    for (const material of question.materials) {
      const _material = await parser.input(material.content, {showIndex: true})

      for (const [key, value] of Object.entries(_material.assets)) {
        _material.text = _material.text.replaceAll(key, value)
      }

      // 材料配件
      if (!lodash.isEmpty(material.accessories)) {
        // 181+transcript
        const _transcript = lodash.find(material.accessories, {label: 'transcript', type: 181})
        if (_transcript) lodash.remove(material.accessories, _transcript)
        if (_transcript?.content) {
          meta.points['[P#L#[T#B#材料转录]]'] = await html.toImage(await fenbi.parseDoc(_transcript?.content), {
            srcHandler: fenbi.srcHandler,
            style: this.HTML_STYLE,
          })
        }

        // 151: 材料翻译
        const _materialTrans = lodash.find(material.accessories, {type: 151})
        if (_materialTrans) lodash.remove(material.accessories, _materialTrans)
        if (_materialTrans?.translation) {
          meta.points['[P#L#[T#B#材料翻译]]'] = await markji.parseHtml(
            await fenbi.parseDoc(_materialTrans?.translation),
            {skipInput: true, srcHandler: fenbi.srcHandler, style: this.HTML_STYLE},
          )
        }

        // 181+materialExplain: 材料解析
        const _materialExplain = lodash.find(material.accessories, {label: 'materialExplain', type: 181})
        if (_materialExplain) lodash.remove(material.accessories, _materialExplain)
        if (_materialExplain?.content) {
          meta.points['[P#L#[T#B#材料解析]]'] = await html.toImage(await fenbi.parseDoc(_materialExplain?.content), {
            srcHandler: fenbi.srcHandler,
            style: this.HTML_STYLE,
          })
        }

        // 181+zdch: 重点词汇
        const _zdch = lodash.find(material.accessories, {label: 'zdch', type: 181})
        if (_zdch) lodash.remove(material.accessories, _zdch)
        if (_zdch?.content) {
          meta.points['[P#L#[T#B#材料词汇]]'] = await html.toImage(await fenbi.parseDoc(_zdch?.content), {
            srcHandler: fenbi.srcHandler,
            style: this.HTML_STYLE,
          })
        }

        // 181+clyw: 材料译文
        const _clyw = lodash.find(material.accessories, {label: 'clyw', type: 181})
        if (_clyw) lodash.remove(material.accessories, _clyw)
        if (_clyw?.content) {
          meta.points['[P#L#[T#B#材料译文]]'] = await html.toImage(await fenbi.parseDoc(_clyw?.content), {
            srcHandler: fenbi.srcHandler,
            style: this.HTML_STYLE,
          })
        }

        // 181+cltg: 材料题干
        const _cltg = lodash.find(material.accessories, {label: 'cltg', type: 181})
        if (_cltg) lodash.remove(material.accessories, _cltg)
        if (_cltg?.content) {
          const _cltgAssets = await html.toImage(await fenbi.parseDoc(_cltg?.content), {
            srcHandler: fenbi.srcHandler,
            style: this.HTML_STYLE,
          })
          _material.text = `${_material.text}\n${_cltgAssets.text}`
          _material.assets = lodash.merge({}, _material.assets, _cltgAssets.assets)
        }

        // 185: 音频
        const _audio = lodash.find(material.accessories, {type: 185})
        if (_audio) lodash.remove(material.accessories, _audio)
        if (_audio?.url) {
          meta.materials.push(await parser.audio(_audio?.url))
        }

        // 1003: lrc
        const _lrc = lodash.find(material.accessories, {type: 1003})
        if (_lrc) lodash.remove(material.accessories, _lrc)
        if (_lrc?.lrcMetas) {
          meta.materials.push({assets: {}, text: '[LRC 暂不支持]'})
        }

        // 1005: 关键词
        lodash.remove(material.accessories, {type: 1005})

        // throw
        if (!lodash.isEmpty(material.accessories)) {
          throwError('Unsupported material accessories.', {material, qbank, question})
        }
      }

      _material.text = await fenbi.parseDoc(_material?.text)

      if (_material.text && _material.text !== '<p> </p>') {
        const _assetsMaterial = await html.toImage(_material.text, {
          srcHandler: fenbi.srcHandler,
          style: this.HTML_STYLE,
        })

        _assetsMaterial.assets = lodash.merge({}, _assetsMaterial.assets, _material.assets)

        meta.materials.push(_assetsMaterial)
      }
    }

    return meta
  }

  protected async __makeQuestionAccessories(qbank: QBankParams, question: any, meta: any): Promise<any> {
    meta.points['[P#L#[T#B#题目类别]]'] = {assets: {}, text: `${qbank.category.name} / ${qbank.sheet.name}`}

    // 112: 连线
    const _link = lodash.find(question.accessories, {type: 112})
    if (_link) lodash.remove(question.accessories, _link)
    if (_link?.leftElements) {
      meta.points['[P#L#[T#B#题目连线]]'] = {assets: {}, text: '暂不支持'}
    }

    // 186+module+category
    const _cat = lodash.find(question.accessories, {type: 186})
    if (_cat) lodash.remove(question.accessories, _cat)
    if (_cat?.module) {
      question.typeName = lodash.chain([_cat?.module, question.typeName]).filter().uniq().join(' / ').value()
    }

    // 103: 问题类型
    const _qType = lodash.find(question.accessories, {type: 103})
    if (_qType) lodash.remove(question.accessories, _qType)
    if (_qType?.name) {
      meta.points['[P#L#[T#B#问题类型]]'] = {assets: {}, text: _qType.name}
    }

    // 151: 题目翻译
    const _questionTrans = lodash.find(question.accessories, {type: 151})
    if (_questionTrans) lodash.remove(question.accessories, _questionTrans)
    if (_questionTrans?.translation) {
      meta.points['[P#L#[T#B#题目翻译]]'] = await html.toImage(await fenbi.parseDoc(_questionTrans?.translation), {
        skipInput: true,
        srcHandler: fenbi.srcHandler,
        style: this.HTML_STYLE,
      })
    }

    // 181+null: 不知道
    // TODO
    lodash.remove(
      question.accessories,
      (accessory: any) => accessory.type === 181 && (accessory.label === 'null' || lodash.isNull(accessory.label)),
    )

    // 181+questionDesc: 题目描述
    const _questionDesc = lodash.find(question.accessories, {label: 'questionDesc', type: 181})
    if (_questionDesc) lodash.remove(question.accessories, _questionDesc)
    if (_questionDesc?.content) {
      const questionDesc = await markji.parseHtml(await fenbi.parseDoc(_questionDesc?.content), {
        srcHandler: fenbi.srcHandler,
        style: this.HTML_STYLE,
      })
      meta.content.text = `${questionDesc.text}\n${meta.content.text}`
      meta.content.assets = lodash.merge({}, questionDesc.assets, meta.content.assets)
    }

    // 181+source: 题目来源
    const _source = lodash.find(question.accessories, {label: 'source', type: 181})
    if (_source) lodash.remove(question.accessories, _source)
    const _sourceText = question.solution.source || _source?.content || ''
    if (_sourceText) {
      meta.points['[P#L#[T#B#题目来源]]'] = await markji.parseHtml(await fenbi.parseDoc(_sourceText), {
        skipInput: true,
        srcHandler: fenbi.srcHandler,
        style: this.HTML_STYLE,
      })
    }

    // 181+customTheme: 自定义主题
    // TODO
    lodash.remove(question.accessories, {label: 'customTheme', type: 181})

    // 181+listenQuestionStem: 听力题干
    const _listenQuestionStem = lodash.find(question.accessories, {label: 'listenQuestionStem', type: 181})
    if (_listenQuestionStem) lodash.remove(question.accessories, _listenQuestionStem)
    if (_listenQuestionStem?.content) {
      meta.points['[P#L#[T#B#听力题干]]'] = await markji.parseHtml(await fenbi.parseDoc(_listenQuestionStem?.content), {
        skipInput: true,
        srcHandler: fenbi.srcHandler,
        style: this.HTML_STYLE,
      })
    }

    // 181+stfx: 审题分析
    const _stfx = lodash.find(question.accessories, {label: 'stfx', type: 181})
    if (_stfx) lodash.remove(question.accessories, _stfx)
    if (_stfx?.content) {
      meta.points['[P#L#[T#B#审题分析]]'] = await html.toImage(await fenbi.parseDoc(_stfx.content), {
        skipInput: true,
        srcHandler: fenbi.srcHandler,
        style: this.HTML_STYLE,
      })
    }

    // 181+xztg: 写作提纲
    const _xztg = lodash.find(question.accessories, {label: 'xztg', type: 181})
    if (_xztg) lodash.remove(question.accessories, _xztg)
    if (_xztg?.content) {
      meta.points['[P#L#[T#B#写作提纲]]'] = await html.toImage(await fenbi.parseDoc(_xztg.content), {
        skipInput: true,
        srcHandler: fenbi.srcHandler,
        style: this.HTML_STYLE,
      })
    }

    // 181+relatedMaterialId: 关联材料ID
    lodash.remove(question.accessories, {label: 'relatedMaterialId', type: 181})

    // 181+qwfx: 全文分析
    const _qwfx = lodash.find(question.accessories, {label: 'qwfx', type: 181})
    if (_qwfx) lodash.remove(question.accessories, _qwfx)
    if (_qwfx?.content) {
      meta.points['[P#L#[T#B#全文分析]]'] = await html.toImage(await fenbi.parseDoc(_qwfx.content), {
        skipInput: true,
        srcHandler: fenbi.srcHandler,
        style: this.HTML_STYLE,
      })
    }

    // 181+zdch: 重点词汇
    const _zdch = lodash.find(question.accessories, {label: 'zdch', type: 181})
    if (_zdch) lodash.remove(question.accessories, _zdch)
    if (_zdch?.content) {
      meta.points['[P#L#[T#B#重点词汇]]'] = await html.toImage(await fenbi.parseDoc(_zdch?.content), {
        skipInput: true,
        srcHandler: fenbi.srcHandler,
        style: this.HTML_STYLE,
      })
    }

    // 182: 材料标题
    // TODO
    lodash.remove(question.accessories, {type: 182})

    // 185: 音频
    const _audio = lodash.find(question.accessories, {type: 185})
    if (_audio) lodash.remove(question.accessories, _audio)
    if (_audio?.url) {
      meta.points['[P#L#[T#B#音频]]'] = await parser.audio(_audio.url)
    }

    // 1001: 选项翻译
    const _optionsTrans = lodash.find(question.accessories, {type: 1001})
    if (_optionsTrans) lodash.remove(question.accessories, _optionsTrans)
    if (!lodash.isEmpty(_optionsTrans?.choiceTranslations)) {
      const choiceTrans = lodash.map(_optionsTrans?.choiceTranslations, (translation) => {
        const trans = lodash.map(translation, (t) => {
          if (t.translation === 'null') t.translation = ''
          return t.translation || t.label
        })
        return trans.join('；')
      })

      meta.points['[P#L#[T#B#选项翻译]]'] = {
        assets: {},
        text: lodash
          .chain(meta.options)
          .map('text')
          .zipObject(choiceTrans)
          .map((value, key) => `${key}: ${value}`)
          .value()
          .join('\n'),
      }
    }

    // 1004. 单词释义
    const _wordAnalysis = lodash.find(question.accessories, {type: 1004})
    if (_wordAnalysis) lodash.remove(question.accessories, _wordAnalysis)
    if (_wordAnalysis) {
      const _word = [
        `单词: ${_wordAnalysis?.word || ''}`,
        `音标: ${_wordAnalysis?.phonetic || ''}`,
        `释义: ${_wordAnalysis?.paraphrases || ''}`,
        `发音: <audio src="${_wordAnalysis.audio}"></audio>`,
      ].join('\n')
      meta.points['[P#L#[T#B#单词释义]]'] = await html.toText(_word.trim(), {
        skipInput: true,
        srcHandler: fenbi.srcHandler,
        style: this.HTML_STYLE,
      })
    }

    // 1006: module，不知道是啥玩意儿
    // TODO
    lodash.remove(question.accessories, {type: 1006})

    // others.
    if (!lodash.isEmpty(question.accessories)) {
      throwError('Unsupported accessories.', {qbank, question})
    }

    return meta
  }

  protected async __makeSolutionAccessories(qbank: QBankParams, question: any, meta: any): Promise<any> {
    // 181+transcript
    const _transcript = lodash.find(question.solution.solutionAccessories, {label: 'transcript', type: 181})
    if (_transcript) lodash.remove(question.solution.solutionAccessories, _transcript)
    if (_transcript?.content) {
      meta.points['[P#L#[T#B#解析转录]]'] = await html.toImage(await fenbi.parseDoc(_transcript?.content), {
        skipInput: true,
        srcHandler: fenbi.srcHandler,
        style: this.HTML_STYLE,
      })
    }

    // 181+translate: 翻译
    const _translate = lodash.find(question.solution.solutionAccessories, {label: 'translate', type: 181})
    if (_translate) lodash.remove(question.solution.solutionAccessories, _translate)
    if (_translate?.content) {
      meta.points['[P#L#[T#B#解析翻译]]'] = await html.toImage(await fenbi.parseDoc(_translate?.content), {
        skipInput: true,
        srcHandler: fenbi.srcHandler,
        style: this.HTML_STYLE,
      })
    }

    // 181+tyzd: 题意指导
    const _tyzd = lodash.find(question.solution.solutionAccessories, {label: 'tyzd', type: 181})
    if (_tyzd) lodash.remove(question.solution.solutionAccessories, _tyzd)
    if (_tyzd?.content) {
      meta.points['[P#L#[T#B#题意指导]]'] = await html.toImage(await fenbi.parseDoc(_tyzd?.content), {
        skipInput: true,
        srcHandler: fenbi.srcHandler,
        style: this.HTML_STYLE,
      })
    }

    // 181+interferenceAnalysis: 干扰项分析
    const _interferenceAnalysis = lodash.find(question.solution.solutionAccessories, {
      label: 'interferenceAnalysis',
      type: 181,
    })
    if (_interferenceAnalysis) lodash.remove(question.solution.solutionAccessories, _interferenceAnalysis)
    if (_interferenceAnalysis?.content) {
      meta.points['[P#L#[T#B#干扰项分析]]'] = await html.toImage(await fenbi.parseDoc(_interferenceAnalysis?.content), {
        skipInput: true,
        srcHandler: fenbi.srcHandler,
        style: this.HTML_STYLE,
      })
    }

    // solution
    // 181+explain: 解析
    // 1007: 解析详情
    const _explainAssember = []

    const _solution = question.solution.solution
    if (_solution) _explainAssember.push(await fenbi.parseDoc(_solution))

    const _explain = lodash.find(question.solution.solutionAccessories, {label: 'explain', type: 181})
    if (_explain) lodash.remove(question.solution.solutionAccessories, _explain)
    if (_explain?.content) _explainAssember.push('', await fenbi.parseDoc(_explain?.content))

    const _solutionDetails = lodash.find(question.solution.solutionAccessories, {type: 1007})
    if (_solutionDetails) lodash.remove(question.solution.solutionAccessories, _solutionDetails)
    if (lodash.isArray(_solutionDetails?.solutionDetails)) {
      for (const detail of _solutionDetails.solutionDetails) {
        _explainAssember.push(
          '',
          (await fenbi.parseDoc(detail?.solutionEnglish)) + ` <audio src="${detail?.url}"></audio>`,
          await fenbi.parseDoc(detail?.solutionChinese),
        )
      }
    }

    if (!lodash.isEmpty(_explainAssember)) {
      meta.points['[P#L#[T#B#题目解析]]'] = await markji.parseHtml(_explainAssember.join('\n'), {
        skipInput: true,
        srcHandler: fenbi.srcHandler,
        style: this.HTML_STYLE,
      })
    }

    // 181+expand: 拓展
    const _expand = lodash.find(question.solution.solutionAccessories, {label: 'expand', type: 181})
    if (_expand) lodash.remove(question.solution.solutionAccessories, _expand)
    if (_expand?.content) {
      meta.points['[P#L#[T#B#解析拓展]]'] = await html.toImage(await fenbi.parseDoc(_expand.content), {
        skipInput: true,
        srcHandler: fenbi.srcHandler,
        style: this.HTML_STYLE,
      })
    }

    // 181+jcjs: 解题技巧
    const _jcjs = lodash.find(question.solution.solutionAccessories, {label: 'jcjs', type: 181})
    if (_jcjs) lodash.remove(question.solution.solutionAccessories, _jcjs)
    if (_jcjs?.content) {
      meta.points['[P#L#[T#B#解题技巧]]'] = await html.toImage(await fenbi.parseDoc(_jcjs.content), {
        skipInput: true,
        srcHandler: fenbi.srcHandler,
        style: this.HTML_STYLE,
      })
    }

    // 181+fwfy: 仿写翻译
    const _fwfy = lodash.find(question.solution.solutionAccessories, {label: 'fwfy', type: 181})
    if (_fwfy) lodash.remove(question.solution.solutionAccessories, _fwfy)
    if (_fwfy?.content) {
      meta.points['[P#L#[T#B#仿写翻译]]'] = await html.toImage(await fenbi.parseDoc(_fwfy.content), {
        skipInput: true,
        srcHandler: fenbi.srcHandler,
        style: this.HTML_STYLE,
      })
    }

    // 181+ldch: 亮点词汇
    const _ldch = lodash.find(question.solution.solutionAccessories, {label: 'ldch', type: 181})
    if (_ldch) lodash.remove(question.solution.solutionAccessories, _ldch)
    if (_ldch?.content) {
      meta.points['[P#L#[T#B#亮点词汇]]'] = await html.toImage(await fenbi.parseDoc(_ldch.content), {
        skipInput: true,
        srcHandler: fenbi.srcHandler,
        style: this.HTML_STYLE,
      })
    }

    // 181+demonstrate: 维度分析
    const _demonstrate = lodash.find(question.solution.solutionAccessories, {label: 'demonstrate', type: 181})
    if (_demonstrate) lodash.remove(question.solution.solutionAccessories, _demonstrate)
    if (_demonstrate?.content) {
      meta.points['[P#L#[T#B#维度分析]]'] = await html.toImage(await fenbi.parseDoc(_demonstrate.content), {
        skipInput: true,
        srcHandler: fenbi.srcHandler,
        style: this.HTML_STYLE,
      })
    }

    // 181+stzd: 试题指导
    const _stzd = lodash.find(question.solution.solutionAccessories, {label: 'stzd', type: 181})
    if (_stzd) lodash.remove(question.solution.solutionAccessories, _stzd)
    if (_stzd?.content) {
      meta.points['[P#L#[T#B#试题指导]]'] = await html.toImage(await fenbi.parseDoc(_stzd.content), {
        skipInput: true,
        srcHandler: fenbi.srcHandler,
        style: this.HTML_STYLE,
      })
    }

    // 181+swdt: 思维导图
    const _swdt = lodash.find(question.solution.solutionAccessories, {label: 'swdt', type: 181})
    if (_swdt) lodash.remove(question.solution.solutionAccessories, _swdt)
    if (_swdt?.content) {
      meta.points['[P#L#[T#B#思维导图]]'] = await html.toImage(await fenbi.parseDoc(_swdt.content), {
        skipInput: true,
        srcHandler: fenbi.srcHandler,
        style: this.HTML_STYLE,
      })
    }

    // 181+sfdt: todo
    lodash.remove(question.solution.solutionAccessories, {label: 'sfdt', type: 181})

    // 181+wjlj
    const _wjlj = lodash.find(question.solution.solutionAccessories, {label: 'wjlj', type: 181})
    if (_wjlj) lodash.remove(question.solution.solutionAccessories, _wjlj)
    if (_wjlj?.content) {
      meta.points['[P#L#[T#B#wjlj]]'] = await html.toImage(await fenbi.parseDoc(_wjlj.content), {
        skipInput: true,
        srcHandler: fenbi.srcHandler,
        style: this.HTML_STYLE,
      })
    }

    // 181+write_template: 写作模板
    const _writeTemplate = lodash.find(question.solution.solutionAccessories, {label: 'write_template', type: 181})
    if (_writeTemplate) lodash.remove(question.solution.solutionAccessories, _writeTemplate)
    if (_writeTemplate?.content) {
      meta.points['[P#L#[T#B#写作模板]]'] = await html.toImage(await fenbi.parseDoc(_writeTemplate.content), {
        skipInput: true,
        srcHandler: fenbi.srcHandler,
        style: this.HTML_STYLE,
      })
    }

    // 181+gfbd: 观点表达
    const _gfbd = lodash.find(question.solution.solutionAccessories, {label: 'gfbd', type: 181})
    if (_gfbd) lodash.remove(question.solution.solutionAccessories, _gfbd)
    if (_gfbd?.content) {
      meta.points['[P#L#[T#B#观点表达]]'] = await html.toImage(await fenbi.parseDoc(_gfbd.content), {
        skipInput: true,
        srcHandler: fenbi.srcHandler,
        style: this.HTML_STYLE,
      })
    }

    // 190: cat 分类
    lodash.remove(question.solution.solutionAccessories, {label: 'cat', type: 190})

    if (!lodash.isEmpty(question.solution.solutionAccessories)) {
      throwError('Unsupported solution accessories.', {qbank, question})
    }

    return meta
  }

  protected async __meta2Output(question: any, meta: any): Promise<AssetString> {
    const textAssembler = []
    const assetsAssembler = {}

    if (question?.typeName) {
      textAssembler.push(`[${question.typeName}]`)
    }

    if (meta?.materials) {
      textAssembler.push(...lodash.map(meta.materials, 'text'))
      lodash.merge(assetsAssembler, ...lodash.map(meta.materials, 'assets'))
    }

    if (meta?.content?.text) {
      textAssembler.push(lodash.trim(meta.content.text))
      lodash.merge(assetsAssembler, meta.content.assets)
    }

    if (meta?.options) {
      textAssembler.push(
        `[Choice#${meta.optionsAttr}#\n${lodash.trim(lodash.map(meta.options, 'text').join('\n'))}\n]\n`,
      )
      lodash.merge(assetsAssembler, ...lodash.map(meta.options, 'assets'))
    }

    textAssembler.push('---\n')

    if (meta?.translation) {
      textAssembler.push(meta.translation.text, '---\n')
      lodash.merge(assetsAssembler, meta.translation.assets)
    }

    if (meta?.points) {
      textAssembler.push(
        ...lodash
          .chain(meta.points)
          .toPairs()
          .sortBy(0)
          .fromPairs()
          .map((point, key) => `${key}\n${point.text}`)
          .value(),
      )
      lodash.merge(assetsAssembler, ...lodash.map(meta.points, 'assets'))
    }

    if (meta?.answers) {
      lodash.merge(assetsAssembler, ...lodash.map(meta.answers, 'assets'))
    }

    // to
    const output = await html.toText(lodash.filter(textAssembler).join('\n').trim().replaceAll('\n', '<br>'))

    output.assets = lodash.merge({}, assetsAssembler)

    return output
  }

  protected async _processBlankFilling(question: any, qbank: QBankParams): Promise<AssetString> {
    const _meta = {
      content: {assets: [] as never, text: ''} as AssetString,
      materials: [] as AssetString[],
      options: [] as AssetString[],
      points: {} as Record<string, AssetString>,
    }

    // ===========================
    // _content.
    _meta.content = await markji.parseHtml(await fenbi.parseDoc(question.content), {
      srcHandler: fenbi.srcHandler,
      style: this.HTML_STYLE,
    })

    // ===========================
    // _materials.
    lodash.merge(_meta, await this.__makeMaterials(qbank, question, _meta))

    // ===========================
    // _options.
    const _optionAccessory = lodash.find(question.accessories, {type: 101})

    if (!lodash.isEmpty(_optionAccessory)) {
      _meta.content.text +=
        '\n\n' +
        lodash
          .map(_optionAccessory.options, (option, idx) => {
            return `${String.fromCodePoint(65 + Number(idx))}. ${option}`
          })
          .join('\n')
    }

    // ===========================
    // _blanks.
    if (question.correctAnswer.type === 202) {
      for (const [index, assertKey] of Object.keys(_meta.content.assets).entries()) {
        if (!assertKey.includes('input#')) continue
        _meta.content.assets[assertKey] = `[F#${index + 1}#${question.correctAnswer.blanks[index]}]`
        _meta.content.text = _meta.content.text.replaceAll(assertKey, _meta.content.assets[assertKey])
      }
    }
    // unknown.
    else {
      throwError('Unsupported correct answer type.', {qbank, question})
    }

    // ===========================
    // question.accessories
    lodash.merge(_meta, await this.__makeQuestionAccessories(qbank, question, _meta))

    // ===========================
    // question.solution.solutionAccessories
    const _ref = lodash.find(question.solution.solutionAccessories, {label: 'reference', type: 181})
    if (_ref) lodash.remove(question.solution.solutionAccessories, _ref)
    if (_ref?.content) {
      _meta.points['[P#L#[T#B#参考答案]]'] = await markji.parseHtml(await fenbi.parseDoc(_ref?.content), {
        srcHandler: fenbi.srcHandler,
        style: this.HTML_STYLE,
      })
    }

    lodash.merge(_meta, await this.__makeSolutionAccessories(qbank, question, _meta))

    // ===========================
    // _output.
    return this.__meta2Output(question, _meta)
  }

  protected async _processChoice(question: any, qbank: QBankParams): Promise<AssetString> {
    const _meta = {
      answers: [] as AssetString[],
      content: {assets: [] as never, text: ''} as AssetString,
      materials: [] as AssetString[],
      options: [] as AssetString[],
      optionsAttr: question.optionsAttr || ([2, 3].includes(question.type) ? 'fixed,multi' : 'fixed'),
      points: {} as Record<string, AssetString>,
    }

    // ===========================
    // _materials.
    lodash.merge(_meta, await this.__makeMaterials(qbank, question, _meta))

    // ===========================
    // _content.
    _meta.content = {assets: {} as Record<string, string>, text: question.content} as AssetString

    // 完型填空题目中的题号
    if (/<p>(\d+)<\/p>/.test(_meta.content.text)) {
      _meta.content.text = _meta.content.text.replaceAll(/<p>(\d+)<\/p>/g, '第 $1 题')
    }

    _meta.content = await markji.parseHtml(await fenbi.parseDoc(_meta.content.text), {
      srcHandler: fenbi.srcHandler,
      style: this.HTML_STYLE,
    })

    // ===========================
    // accessories.
    for (const _accessory of question.accessories) {
      // 选项过长，转换为富文本选项
      if (_accessory.type === 101 && _accessory.options.join('').length > 800) {
        _accessory.type = 102
      }
    }

    // 101: 选项
    const _options = lodash.find(question.accessories, {type: 101})

    if (_options) lodash.remove(question.accessories, _options)

    if (!lodash.isEmpty(_options?.options)) {
      _meta.options.push(...lodash.map(_options?.options, (option) => ({assets: [] as never, text: option})))
    }

    // 102: 富文本选项
    const _optionsHtml = lodash.find(question.accessories, {type: 102})

    if (_optionsHtml) lodash.remove(question.accessories, _optionsHtml)

    if (!lodash.isEmpty(_optionsHtml?.options)) {
      const _htmlStyle = ['<style type="text/css">', 'p { display: inline-block; }', '</style>'].join(' ')

      // add A/B/C/D/... prefix for options
      const _options: string[] = []

      for (const _op of _optionsHtml.options) {
        const point = String.fromCodePoint(65 + _options.length)
        _options.push(`${point}. ${await fenbi.parseDoc(_op)}`)
        _meta.options.push({assets: [] as never, text: point})
      }

      const _optionsContent = await html.toImage(_options.join('<br>'), {
        srcHandler: fenbi.srcHandler,
        style: `${this.HTML_STYLE}${_htmlStyle}`,
      })

      _meta.content.text += `\n${_optionsContent.text}`
      _meta.content.assets = lodash.merge({}, _meta.content.assets, _optionsContent.assets)
    }

    // ===========================
    // _answers.
    // 201: Choice
    if (question.correctAnswer.type === 201) {
      for (const choice of question.correctAnswer.choice.split(',')) {
        _meta.answers.push(_meta.options[Number(choice)])
      }

      _meta.options = lodash.map(_meta.options, (option) => ({
        assets: option.assets,
        text: `${_meta.answers.includes(option) ? '*' : '-'} ${option.text}`,
      }))
    } else {
      throwError('Unsupported correct answer type.', {qbank, question})
    }

    // ===========================
    // question.accessories
    lodash.merge(_meta, await this.__makeQuestionAccessories(qbank, question, _meta))

    // ===========================
    // question.solution.solutionAccessories
    lodash.merge(_meta, await this.__makeSolutionAccessories(qbank, question, _meta))

    // ===========================
    // _output.
    return this.__meta2Output(question, _meta)
  }

  protected async _processTranslate(question: any, qbank: QBankParams): Promise<AssetString> {
    const _meta = {
      content: {assets: [] as never, text: ''} as AssetString,
      materials: [] as AssetString[],
      points: {} as Record<string, AssetString>,
      translation: {assets: [] as never, text: ''} as AssetString,
    }

    // ===========================
    // _materials.
    lodash.merge(_meta, await this.__makeMaterials(qbank, question, _meta))

    // ===========================
    // _content.
    _meta.content = await markji.parseHtml(await fenbi.parseDoc(question.content || ''), {
      srcHandler: fenbi.srcHandler,
      style: this.HTML_STYLE,
    })

    // ===========================
    // _translation.
    let _ref = lodash.find(question.solution.solutionAccessories, {label: 'reference', type: 181})

    if (question?.correctAnswer?.type === 203 && !_ref) {
      _ref = question?.correctAnswer
      _ref.content = _ref.answer
    }

    if (_ref) lodash.remove(question.solution.solutionAccessories, _ref)

    _meta.translation = await markji.parseHtml(await fenbi.parseDoc(_ref?.content || ''), {
      skipInput: true,
      srcHandler: fenbi.srcHandler,
      style: this.HTML_STYLE,
    })

    // ===========================
    // question.accessories
    const _optionAccessory = lodash.find(question.accessories, {type: 101})
    if (_optionAccessory) lodash.remove(question.accessories, _optionAccessory)
    if (_optionAccessory?.options) {
      _meta.points['[P#L#[T#B#选项]]'] = {assets: {}, text: _optionAccessory.options.join('\n')}
    }

    lodash.merge(_meta, await this.__makeQuestionAccessories(qbank, question, _meta))

    // ===========================
    // question.solution.solutionAccessories
    lodash.merge(_meta, await this.__makeSolutionAccessories(qbank, question, _meta))

    // ===========================
    // _output.
    return this.__meta2Output(question, _meta)
  }

  protected async toMarkjiOutput(question: any, qbank: QBankParams): Promise<AssetString> {
    const _questionType = question.type

    let output = {} as AssetString

    // ===========================
    switch (_questionType) {
      // 1. TypeSingleChoice, 单选题
      case 1: {
        question.typeName = '单选题'
        question.optionsAttr = 'fixed'
        output = await this._processChoice(question, qbank)
        break
      }

      // 2. TypeMultiChoice, 多选题
      case 2:
      case 3: {
        question.typeName = '多选题'
        question.optionsAttr = 'fixed,multi'
        output = await this._processChoice(question, qbank)
        break
      }

      // 4. TypeCloze, 完型填空
      case 4: {
        question.typeName = '完型填空'
        output = await this._processChoice(question, qbank)
        break
      }

      // 5. TypeTrueOrFlase, 判断题
      case 5: {
        question.typeName = '判断题'

        if (!lodash.some(question.accessories, {type: 101})) {
          question.accessories.push({options: ['正确', '错误'], type: 101})
        }

        output = await this._processChoice(question, qbank)

        break
      }

      // 6. TypeReadingComprehension5In7, 阅读理解7选5
      case 6: {
        question.typeName = '阅读理解7选5'
        output = await this._processChoice(question, qbank)
        break
      }

      // 11. TypeProof, 证明题
      case 11: {
        question.typeName = '证明题'
        output = await this._processTranslate(question, qbank)
        break
      }

      // 12. TypeEssay, 论述题
      case 12: {
        question.typeName = '论述题'
        output = await this._processTranslate(question, qbank)
        break
      }

      // 13. TypeCaculation, 计算题
      case 13: {
        question.typeName = '计算题'
        output = await this._processTranslate(question, qbank)
        break
      }

      // 14. TypeReadingComprehension, 阅读理解
      case 14: {
        question.typeName = '阅读理解'
        output = await this._processTranslate(question, qbank)
        break
      }

      // 15. TypeAnalysis, 分析题
      case 15: {
        question.typeName = '分析题'
        output = await this._processTranslate(question, qbank)
        break
      }

      // 21: TypeOnlineCorrect, 在线批改
      case 21: {
        question.typeName = '在线批改'
        output = await this._processTranslate(question, qbank)
        break
      }

      // 22: TypeEssayAnalysis, 作文分析
      case 22: {
        question.typeName = '作文分析'
        output = await this._processTranslate(question, qbank)
        break
      }

      // 23: TypeEssayStrategy, 作文策略
      case 23: {
        question.typeName = '作文策略'
        output = await this._processTranslate(question, qbank)
        break
      }

      // 24: TypeEssayOfficial, 作文范文
      case 24: {
        question.typeName = '作文范文'
        output = await this._processTranslate(question, qbank)
        break
      }

      // 25: TypeEssayWriting, 作文写作
      case 25: {
        question.typeName = '作文写作'
        output = await this._processTranslate(question, qbank)
        break
      }

      // 26: TypeEssayView, 作文观点
      case 26: {
        question.typeName = '作文观点'
        output = await this._processTranslate(question, qbank)
        break
      }

      // 50. TypeOther, 其他
      case 50: {
        question.typeName = '其他'
        output = await this._processTranslate(question, qbank)
        break
      }

      // 61. BlankFilling, 填空题
      case 61: {
        question.typeName = '填空题'
        output = await this._processBlankFilling(question, qbank)
        break
      }

      // 84. 连线题
      case 84: {
        // TODO
        question.typeName = '连线题'
        output = {assets: {}, text: '[连线题]\n暂不支持'}
        break
      }

      // 101. 翻译
      case 101: {
        question.typeName = '翻译'
        output = await this._processTranslate(question, qbank)
        break
      }

      // 102. 大作文
      case 102: {
        question.typeName = '大作文'
        output = await this._processTranslate(question, qbank)
        break
      }

      // 103. 小作文
      case 103: {
        question.typeName = '小作文'
        output = await this._processTranslate(question, qbank)
        break
      }

      // 104.
      case 104: {
        question.typeName = '归纳概括'
        output = await this._processTranslate(question, qbank)
        break
      }

      // 2001. 写作翻译
      case 2001: {
        question.typeName = '写作翻译'
        output = await this._processTranslate(question, qbank)
        break
      }

      // 2002. 单词补全
      case 2002: {
        question.typeName = '单词补全'
        output = await this._processTranslate(question, qbank)
        break
      }

      // 2053. 选词填空
      case 2053: {
        // TODO
        question.typeName = '选词填空'
        output = {assets: {}, text: '[选词填空]\n暂不支持'}
        break
      }

      // 2055. BlankFilling, 选句填空
      case 2055: {
        question.typeName = '选句填空'
        output = await this._processBlankFilling(question, qbank)
        break
      }

      default: {
        throwError('Unsupported question type.', {qbank, question})
      }
    }

    return output
  }
}
