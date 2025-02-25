/* eslint-disable max-depth */

import {Cacheable} from '@type-cacheable/core'
import type {CacheRequestConfig} from 'axios-cache-interceptor'
import lodash from 'lodash'
import md5 from 'md5'
import random from 'random-number'
import sleep from 'sleep-promise'
import UserAgent from 'user-agents'

import {Bank} from '../../../@types/bank.js'
import {Category} from '../../../@types/category.js'
import {FetchOptions} from '../../../@types/common.js'
import {Sheet} from '../../../@types/sheet.js'
import {ApiDelegate} from '../../../@types/vendor/fenbi.js'
import cacheManager from '../../../cache/cache.manager.js'
import memory from '../../../cache/memory.manager.js'
import {emitter} from '../../../utils/event.js'
import {safeName, throwError} from '../../../utils/index.js'
import fenbi from '../../../utils/vendor/fenbi.js'
import axios from '../../axios/index.js'
import {CACHE_KEY_ORIGIN_QUESTION_ITEM, CACHE_KEY_ORIGIN_QUESTION_PROCESSING} from '../../cache-pattern.js'
import {OutputClass} from '../../output/common.js'
import Markji from '../../output/fenbi/markji.js'
import Skip from '../../output/skip.js'
import {cacheKeyBuilder, HashKeyScope, Vendor} from '../common.js'

const INTERVAL_EXERCISE = 20_000

/**
 * Fenbi base.
 */
export default class Fenbi extends Vendor {
  public get allowedOutputs(): Record<string, OutputClass> {
    return {
      [Markji.META.key]: Markji,
      [Skip.META.key]: Skip,
    }
  }

  protected get apiDelegate(): ApiDelegate {
    throw new Error('API delegate not implemented.')
  }

  public async fetchQuestions(
    qbank: {bank: Bank; category: Category; sheet: Sheet},
    options?: FetchOptions,
  ): Promise<void> {
    lodash.set(qbank, 'vendor', this)

    if (qbank.sheet.id === '*') throw new Error('Sheet ID is required.')

    // prepare.
    const cacheClient = this.getCacheClient()
    const config = await this.login()
    const bankPrefix = qbank.bank.meta?.bankPrefix

    if (bankPrefix === 'gwyms') {
      // TODO: gwyms
      emitter.closeListener('questions.fetch.count')
      return
    }

    // cache key.
    const cacheKeyParams = {
      bankId: qbank.bank.id,
      categoryId: qbank.category.id,
      sheetId: qbank.sheet.id,
      vendorKey: (this.constructor as typeof Vendor).META.key,
    }

    const exerciseCacheKeyParams = {...cacheKeyParams, processScope: 'exercise'}

    // check.
    const [exerciseKeys, questionKeys] = await Promise.all([
      cacheClient.keys(
        lodash.template(CACHE_KEY_ORIGIN_QUESTION_PROCESSING)({...exerciseCacheKeyParams, processId: '*'}),
      ),
      cacheClient.keys(lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)({...cacheKeyParams, questionId: '*'})),
    ])

    const exerIds = lodash.map(exerciseKeys, (key) => key.split(':').pop() as string)

    const doneQIds = lodash.map(questionKeys, (key) => key.split(':').pop() as string)

    // refetch.
    if (options?.refetch) {
      await cacheClient.delHash(lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)({...cacheKeyParams, questionId: '*'}))
      doneQIds.length = 0
    }

    // ###########################################
    // customize exercises.
    //
    if (doneQIds.length < qbank.sheet.count && qbank.sheet.meta?.giantOnly) {
      // sleep to avoid frequent creation.
      const latestCreateTime = await memory.cache.get<number>('exercise:latest:createTime')

      if (latestCreateTime) {
        const diff = Date.now() - latestCreateTime
        if (diff < INTERVAL_EXERCISE) await sleep(INTERVAL_EXERCISE - diff)
      }

      const exerResp = await axios.get(
        lodash.template(this.apiDelegate.GetGiantsApi)({bankPrefix}),
        lodash.merge({}, config, {
          params: {keypointId: qbank.sheet.meta?.id || qbank.category.meta?.id},
        }),
      )

      await memory.cache.set('exercise:latest:createTime', Date.now())

      for (const [_idx, _questionsIds] of lodash.chunk(exerResp.data, 100).entries()) {
        const _exerciseId = `_${_idx}`

        await cacheClient.set(
          lodash.template(CACHE_KEY_ORIGIN_QUESTION_PROCESSING)({...exerciseCacheKeyParams, processId: _exerciseId}),
          _questionsIds,
        )

        exerIds.push(_exerciseId)
      }

      doneQIds.length = 0
    }
    //
    // ###########################################

    // fetch.
    let _prevCount = doneQIds.length
    let _times = 0

    emitter.emit('questions.fetch.count', doneQIds.length)

    while ((doneQIds.length < qbank.sheet.count || exerIds.length > 0) && _times < 5) {
      // emit count.
      emitter.emit('questions.fetch.count', doneQIds.length)

      // =======================================
      // exercise processing.
      let _exerId: string
      let _qIds: string[]

      // existing exercise.
      if (exerIds.length > 0) {
        _exerId = exerIds.shift() as string
        _qIds = await cacheClient.get(
          lodash.template(CACHE_KEY_ORIGIN_QUESTION_PROCESSING)({...exerciseCacheKeyParams, processId: _exerId}),
        )
      }
      // 历年真题: fenbi-yy46j.
      else if (this.getVendorKey() === 'fenbi-yy46j' && qbank.bank.meta?.category?.id === md5('历年真题')) {
        // sleep to avoid frequent creation.
        const latestCreateTime = await memory.cache.get<number>('exercise:latest:createTime')

        if (latestCreateTime) {
          const diff = Date.now() - latestCreateTime
          if (diff < INTERVAL_EXERCISE) await sleep(INTERVAL_EXERCISE - diff)
        }

        const exerResp = await axios.post(
          lodash.template(this.apiDelegate.CreatePaperExerciseApi)({bankPrefix}),
          undefined,
          lodash.merge({}, config, {params: {paperId: qbank.sheet.meta?.id, type: 1}}),
        )

        await memory.cache.set('exercise:latest:createTime', Date.now())

        _exerId = String(exerResp.data.id)
        _qIds = lodash.get(exerResp.data, 'sheet.questionIds', [])
      }
      // 历年真题: common.
      else if (qbank.category.id === md5('历年真题')) {
        // qids.
        const qs = await axios.get(
          lodash.template(this.apiDelegate.GetQuestionsApi)({bankPrefix}),
          lodash.merge({}, config, {params: {format: 'json', paperId: qbank.sheet.meta?.id}}),
        )

        _qIds = lodash.get(qs.data, 'questions', []).map((question: any) => String(question.id))

        // exercises.
        const papers = await axios.get(
          lodash.template(this.apiDelegate.GetPaperListApi)({bankPrefix}),
          lodash.merge({}, config, {params: {pageSize: 1000, quizId: qbank.bank.meta?.quizId, toPage: 0}}),
        )

        const paper = lodash.find(papers.data.list, {id: qbank.sheet.meta?.id})

        if (!paper) {
          throwError('Paper not found.', {list: papers.data.list, paperId: qbank.sheet.meta?.id, qbank})
        }

        if (lodash.isNil(paper.exercise?.id)) {
          // sleep to avoid frequent creation.
          const latestCreateTime = await memory.cache.get<number>('exercise:latest:createTime')

          if (latestCreateTime) {
            const diff = Date.now() - latestCreateTime
            if (diff < INTERVAL_EXERCISE) await sleep(INTERVAL_EXERCISE - diff)
          }

          const exerResp = await axios.post(
            lodash.template(this.apiDelegate.CreateExerciseApi)({bankPrefix}),
            undefined,
            lodash.merge({}, config, {params: {paperId: paper.id, type: 1}}),
          )

          await memory.cache.set('exercise:latest:createTime', Date.now())

          paper.exercise = exerResp.data
        }

        _exerId = String(paper.exercise.id)
      }
      // zhyynl.
      else if (bankPrefix === 'zhyynl') {
        const zhyynls: any = (await memory.cache.get('zhyynls')) || qbank.sheet.meta?.zhyynl || []

        if (zhyynls.length === 0) {
          _times = 5
          continue
        }

        do {
          const zhyynl = zhyynls.shift()

          if (zhyynl.exerciseId) {
            _exerId = String(zhyynl.exerciseId)
            _qIds = [String(zhyynl.questionId)]
          } else if (zhyynl.sheetId) {
            try {
              // sleep to avoid frequent creation.
              const latestCreateTime = await memory.cache.get<number>('exercise:latest:createTime')

              if (latestCreateTime) {
                const diff = Date.now() - latestCreateTime
                if (diff < INTERVAL_EXERCISE) await sleep(INTERVAL_EXERCISE - diff)
              }

              const exerResp = await axios.post(
                lodash.template(this.apiDelegate.CreateExerciseApi)({bankPrefix}),
                undefined,
                lodash.merge({}, config, {params: {sheetId: zhyynl.sheetId, type: 26}}),
              )

              await memory.cache.set('exercise:latest:createTime', Date.now())

              _exerId = lodash.get(exerResp.data, 'id', 0)
              _qIds = lodash.get(exerResp.data, 'sheet.questionIds', [])
            } catch {
              _exerId = '_0'
              _qIds = [String(zhyynl.questionId)]
            }
          } else if (zhyynl.questionId) {
            _exerId = '_0'
            _qIds = [String(zhyynl.questionId)]
          } else {
            throwError('zhyynl error', {qbank, zhyynl})
          }

          if (lodash.without(_qIds, ...doneQIds).length > 0) break
        } while (true)

        await memory.cache.set('zhyynls', zhyynls)
      }
      // new exercise for default.
      else {
        const unfinished = await axios
          .get(lodash.template(this.apiDelegate.GetExerciseUnfinishedApi)({bankPrefix}), config)
          .catch(() => ({data: {}}))

        if (lodash.has(unfinished.data, 'exerciseId')) {
          _exerId = String(unfinished.data.exerciseId)
          _qIds = []
        } else {
          // sleep to avoid frequent creation.
          const latestCreateTime = await memory.cache.get<number>('exercise:latest:createTime')

          if (latestCreateTime) {
            const diff = Date.now() - latestCreateTime
            if (diff < INTERVAL_EXERCISE) await sleep(INTERVAL_EXERCISE - diff)
          }

          const postData: Record<string, any> = {}
          let exerIdPath = 'id'
          let qIdsPath = 'sheet.questionIds'

          if (this.getVendorKey() === 'fenbi-yy46j') {
            exerIdPath = 'data.exerciseId'
            qIdsPath = 'data.sheet.questionIds'
            postData.abilityId = 0
            postData.categoryId = qbank.sheet.meta?.id || qbank.category.meta?.id
            postData.count = 100
          } else {
            postData.keypointId = qbank.sheet.meta?.id || qbank.category.meta?.id
            postData.type = 151
            postData.limit = 100
          }

          const exerResp = await axios
            .post(
              lodash.template(this.apiDelegate.CreateExerciseApi)({bankPrefix}),
              postData,
              lodash.merge({}, config, {headers: {'Content-Type': 'application/x-www-form-urlencoded'}}),
            )
            .catch((error) => {
              if (error?.response?.data === "151can't create sheet with paperId=0") {
                return false
              }

              throw error
            })

          await memory.cache.set('exercise:latest:createTime', Date.now())

          if (lodash.isBoolean(exerResp)) {
            _times = 5
            continue
          }

          _exerId = lodash.get(exerResp.data, exerIdPath, 0)
          _qIds = lodash.get(exerResp.data, qIdsPath, [])

          if (!_exerId) {
            throwError('Exercise not found.', {exercise: exerResp.data, qbank})
          }
        }
      }

      // fix qids.
      if (_exerId && lodash.isEmpty(_qIds)) {
        const exercise = await axios.get(
          lodash.template(this.apiDelegate.GetExerciseApi)({bankPrefix, exerciseId: _exerId}),
          lodash.merge({}, config),
        )
        _qIds = lodash.get(exercise.data, 'sheet.questionIds', [])
      }

      await cacheClient.set(
        lodash.template(CACHE_KEY_ORIGIN_QUESTION_PROCESSING)({...exerciseCacheKeyParams, processId: _exerId}),
        _qIds,
      )

      // check.
      if (lodash.isUndefined(_qIds)) {
        throwError('Fetch questions failed.', {
          exerciseCacheKey: lodash.template(CACHE_KEY_ORIGIN_QUESTION_PROCESSING)({
            ...exerciseCacheKeyParams,
            processId: _exerId,
          }),
          qbank,
        })
      }

      // =======================================
      // questions processing.
      let _questions: Record<string, unknown>[] = []
      let _materials: Record<string, unknown>[] = []
      let _solutions: Record<string, unknown>[] = []

      // giant
      if (qbank.sheet.meta?.giantOnly) {
        const solutionsResponse = await axios.get(
          lodash.template(this.apiDelegate.GetUniversalAuthSolutionsApi)({
            bankPrefix,
          }),
          lodash.merge({}, config, {params: {questionIds: _qIds.join(','), type: 9}}),
        )

        _questions = lodash.chain(solutionsResponse).get('data.solutions', []).cloneDeep().value()
        _materials = lodash.chain(solutionsResponse).get('data.materials', []).cloneDeep().value()
        _solutions = lodash.chain(solutionsResponse).get('data.solutions', []).cloneDeep().value()
      }
      // default
      else {
        const questionsResponse = await axios.get(
          lodash.template(this.apiDelegate.GetQuestionsApi)({bankPrefix}),
          lodash.merge({}, config, {params: {questionIds: _qIds.join(',')}}),
        )

        const solutionsResponse = await axios.get(
          lodash.template(this.apiDelegate.GetSolutionsApi)({bankPrefix}),
          lodash.merge({}, config, {params: {format: 'json', ids: _qIds.join(',')}}),
        )

        _questions = lodash.get(questionsResponse.data, 'questions', [])
        _materials = lodash.get(questionsResponse.data, 'materials', [])
        _solutions = solutionsResponse.data
      }

      // =======================================
      // go, go, go...
      const answerData = []

      for (const [qIdx, q] of _questions.entries()) {
        const _qId = String(q.id)

        q.solution = lodash.find(_solutions, (solution) => String(solution.id) === _qId)
        q.materials = lodash.map(q.materialIndexes || [], (materialIndex) => _materials[materialIndex])

        if (lodash.some(q.accessories as any, {label: 'relatedMaterialId'})) {
          // throwError('Unknown materials.', {params, question: _q})
        }

        await cacheClient.set(lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)({...cacheKeyParams, questionId: _qId}), q)

        // answer.
        if (!String(_exerId).startsWith('_')) {
          const elapsedTime = random({integer: true, max: 100, min: 1})

          let {correctAnswer} = q

          if (!correctAnswer) {
            correctAnswer = {
              answer: lodash.get(
                lodash.find(lodash.get(q, 'solution.solutionAccessories', []) as never, {
                  label: 'reference',
                }),
                'content',
                '',
              ),
              elapsedTime,
              type: 204,
            }
          }

          answerData.push({
            answer: correctAnswer,
            flag: 0,
            questionId: _qId,
            questionIndex: qIdx,
            time: elapsedTime,
          })
        }

        // update.
        if (!doneQIds.includes(_qId)) doneQIds.push(_qId)
        emitter.emit('questions.fetch.count', doneQIds.length)

        // delay.
        await sleep(100)
      }

      // answer.
      if (!lodash.isEmpty(answerData) && qbank.category.id !== md5('历年真题')) {
        await axios
          .post(
            lodash.template(this.apiDelegate.PostIncrEndpoint)({bankPrefix, exerciseId: _exerId}),
            answerData,
            lodash.merge({}, config, {params: {forceUpdateAnswer: 1}}),
          )
          .catch(() => {})
      }

      // submit exercise.
      if (!String(_exerId).startsWith('_') && qbank.category.id !== md5('历年真题')) {
        await axios
          .post(
            lodash.template(this.apiDelegate.PostSubmitApi)({bankPrefix, exerciseId: _exerId}),
            {status: 1},
            lodash.merge({}, config, {
              headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            }),
          )
          .catch(() => {})
      }

      await cacheClient.del(
        lodash.template(CACHE_KEY_ORIGIN_QUESTION_PROCESSING)({...exerciseCacheKeyParams, processId: _exerId}),
      )

      // repeat fetch.
      _times = doneQIds.length === _prevCount ? _times + 1 : 0
      _prevCount = doneQIds.length
      emitter.emit('questions.fetch.times', _times)
    }

    emitter.emit('questions.fetch.count', doneQIds.length)

    await sleep(500)

    emitter.closeListener('questions.fetch.count')
  }

  protected async changeQuiz(params: {bank: Bank}): Promise<any> {
    if (!lodash.has(this.apiDelegate, 'UpdateQuizApi')) return {}

    // changed.
    const _obj = await memory.cache.get<{data: any; hash: string}>('fenbi:quiz:object')

    const _hash = md5(JSON.stringify(params))

    if (_hash === _obj?.hash) return _obj.data

    // wait complete.
    const config = await this.login()

    const resp = await axios.put(
      lodash.template(this.apiDelegate.UpdateQuizApi)({
        bankPrefix: params.bank.meta?.bankPrefix,
        quizId: params.bank.meta?.quizId,
      }),
      {
        quizId: params.bank.meta?.quizId,
      },
      lodash.merge({}, config, {headers: {'Content-Type': 'application/x-www-form-urlencoded'}}),
    )

    await memory.cache.set('fenbi:quiz:object', {data: resp.data, hash: _hash})

    return resp.data
  }

  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.BANKS)})
  protected async fetchBanks(): Promise<Bank[]> {
    const config = await this.login()

    const response = await axios.get(this.apiDelegate.GetFavoriteQuizListApi, config)

    if (lodash.isEmpty(lodash.get(response, this.apiDelegate.dataPath))) {
      throw new Error(this.apiDelegate.EmptyMessage)
    }

    const _banks = lodash.get(response, this.apiDelegate.dataPath, []) as any

    // quiz change.
    for (const _bank of structuredClone(_banks)) {
      const quizData = await this.changeQuiz({
        bank: {
          id: '',
          meta: {
            bankPrefix: lodash.findLast([
              lodash.get(_bank, 'courseSet.prefix', ''),
              lodash.get(_bank, 'course.prefix', ''),
              lodash.get(_bank, 'quiz.prefix', ''),
            ]),
            quizId: lodash.get(_bank, 'quiz.id', 0),
          },
          name: '',
        },
      })

      if (lodash.isEmpty(lodash.get(quizData, 'data.easyCourseVOS'))) continue

      lodash.remove(_banks, (_b) => lodash.isEqual(_b, _bank))

      const _courses = lodash.get(quizData, 'data.easyCourseVOS', [])

      for (const _course of _courses) {
        if (_course.prefix === _bank.courseSet.prefix) {
          _banks.push({..._bank})
        } else {
          _banks.push({..._bank, course: _course})
        }
      }

      await sleep(500)
    }

    const banks = [] as Bank[]

    // convert.
    for (const bank of _banks) {
      const _id = md5(
        JSON.stringify([
          lodash.get(bank, 'courseSet.id', ''),
          lodash.get(bank, 'course.id', ''),
          lodash.get(bank, 'quiz.id', ''),
        ]),
      )

      banks.push({
        id: _id,
        meta: {
          bankPrefix: lodash.findLast([
            lodash.get(bank, 'courseSet.prefix', ''),
            lodash.get(bank, 'course.prefix', ''),
            lodash.get(bank, 'quiz.prefix', ''),
          ]),
          courseId: lodash.get(bank, 'course.id', ''),
          coursePrefix: lodash.get(bank, 'course.prefix', ''),
          courseSetId: lodash.get(bank, 'courseSet.id', ''),
          courseSetPrefix: lodash.get(bank, 'courseSet.prefix', ''),
          quizId: lodash.get(bank, 'quiz.id', 0),
          quizPrefix: lodash.get(bank, 'quiz.prefix', ''),
        },
        name: await safeName(
          lodash
            .filter([
              lodash.get(bank, 'courseSet.name', ''),
              lodash.get(bank, 'course.name', ''),
              lodash.get(bank, 'quiz.name', ''),
            ])
            .join(' > '),
        ),
      })
    }

    return lodash
      .chain(banks)
      .sortBy(['meta.courseSetPrefix', 'meta.coursePrefix', 'meta.quizPrefix'], ['asc', 'asc', 'asc'])
      .map((bank, idx) => ({...bank, order: idx}))
      .value()
  }

  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.CATEGORIES)})
  protected async fetchCategories(qbank: {bank: Bank}): Promise<Category[]> {
    await this.changeQuiz({bank: qbank.bank})

    const config = await this.login()

    const bankPrefix = qbank.bank.meta?.bankPrefix

    const categories = [] as Category[]

    // ===============================
    // keypoint. 考点
    const catApiParams = this.apiDelegate.ApiParams

    let _endpoint = this.apiDelegate.GetCategoriesApi
    let dataPath = 'data'

    switch (bankPrefix) {
      // 公务员面试
      case 'gwyms': {
        _endpoint = this.apiDelegate.GetHomeCategoriesApi!
        catApiParams.filter = 'giant'
        catApiParams.cquiz = qbank.bank.meta?.quizId
        dataPath = 'data.data.baseKeypointVOS'
        break
      }

      // 申论
      case 'shenlun': {
        _endpoint = this.apiDelegate.GetPdpgApi!

        break
      }

      // 事业单位面试
      case 'sydwms': {
        catApiParams.filter = 'giant'
        break
      }

      case 'zhyynl': {
        _endpoint = this.apiDelegate.GetEtRuleApi!
        break
      }
    }

    const response = await axios.get(
      lodash.template(_endpoint)({bankPrefix}),
      lodash.merge({}, config, {cache: false, params: catApiParams}),
    )

    if (lodash.isArray(response.data?.datas)) {
      dataPath = 'data.datas'
    }

    const _convert = async (index: number, category: Record<string, any>): Promise<Category> => {
      const children = [] as Category[]

      for (const child of category.children ?? []) {
        children.push(await _convert(children.length, child))
      }

      return {
        children,
        count: Number(category.count ?? category.questionCount ?? 0),
        id: md5(String(category.id)),
        meta: lodash.omit(category, ['children', 'count', 'questionCount', 'name']),
        name: await safeName(String(category.name)),
        order: index,
      }
    }

    for (const child of lodash.get(response, dataPath)) {
      categories.push(await _convert(categories.length, child))
    }

    // ================================
    // 历年真题
    categories.push({
      children: [] as Category[],
      count: 0,
      id: md5('历年真题'),
      name: '历年真题',
      order: categories.length,
    })

    return categories
  }

  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.SHEETS)})
  protected async fetchSheet(qbank: {bank: Bank; category: Category}): Promise<Sheet[]> {
    await this.changeQuiz({bank: qbank.bank})

    const config = await this.login()
    const bankPrefix = qbank.bank.meta?.bankPrefix

    const sheets = [] as Sheet[]

    // 历年真题
    if (qbank.category.id === md5('历年真题')) {
      const papers = await axios.get(
        lodash.template(this.apiDelegate.GetPaperListApi)({bankPrefix}),
        lodash.merge({}, config, {params: {pageSize: 1000, quizId: qbank.bank.meta?.quizId, toPage: 0}}),
      )

      for (const paper of papers.data?.list || []) {
        const qs = await axios.get(
          lodash.template(this.apiDelegate.GetQuestionsApi)({bankPrefix}),
          lodash.merge({}, await this.login(), {params: {format: 'json', paperId: paper.id}}),
        )

        sheets.push({
          count: qs.data?.questions?.length || 0,
          id: md5(String(paper.id)),
          meta: {
            id: paper.id,
          },
          name: await safeName(paper.name),
          order: sheets.length,
        })
      }
    }
    // 无分类
    else if (lodash.isEmpty(qbank.category.children)) {
      sheets.push({
        count: qbank.category.count,
        id: md5('0'),
        name: '默认',
      })
    }
    // 有分类
    else {
      for (const child of qbank.category.children) {
        const _meta = child.meta || {}

        if (bankPrefix === 'zhyynl') {
          _meta.zhyynl = []

          let _page = 0

          do {
            const _etResp = await axios.get(
              lodash.template(this.apiDelegate.GetEtRuleQuestionsApi)({
                bankPrefix,
                page: _page,
                sheetId: child.id,
              }),
              lodash.merge({}, config),
            )

            for (const _etq of lodash.get(_etResp.data, 'list', [])) {
              _meta.zhyynl.push({
                exerciseId: lodash.get(_etq, 'exerciseId', 0),
                questionId: lodash.get(_etq, 'questionId', 0),
                sheetId: lodash.get(_etq, 'sheetId', 0),
              })
            }

            const _pageInfo = lodash.get(_etResp.data, 'pageInfo', {})

            if (_pageInfo.currentPage === _pageInfo.totalPage - 1) break

            _page++
          } while (true)
        }

        sheets.push({
          count: child.count,
          id: md5(String(child.id)),
          meta: _meta,
          name: await safeName(child.name),
          order: child.order,
        })
      }
    }

    return sheets
  }

  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.LOGIN), client: cacheManager.CommonClient})
  protected async toLogin(password: string): Promise<CacheRequestConfig> {
    const userAgent = new UserAgent({
      deviceCategory: 'mobile',
      platform: 'iPhone',
    }).toString()

    const params = {
      // apcid: 1,
      app: 'kaoyan',
      av: 104,
      // av: 114,
      // client_context_id: 'fd811ca1317b90ab736ecc80429d4f95',
      // cquiz: 0,
      device_ua: userAgent,
      hav: 108,
      inhouse: 0,
      kav: 100,
      // kav: 102,
      // nt: 'WIFI',
      system: '18.3',
      // system: '18.0.1',
      // ua: 'iPhone13,2',
      version: '6.4.13',

      // version: '6.17.43',
    }

    const response = await axios.post(
      'https://login.fenbi.com/iphone/users/loginV2',
      {
        app: 'web',
        password: await fenbi.encrypt(fenbi.PUBLIC_KEY, password),
        persistent: 1,
        phone: this.getUsername(),
      },
      {
        cache: false,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': userAgent,
        },
        params,
      },
    )

    // Check if login is successful
    if (response.data.code !== 1) {
      throw new Error(response.data.msg)
    }

    return {
      headers: {
        'Content-Type': 'application/json',
        'set-cookie': response.headers['set-cookie'] ?? [],
        'User-Agent': userAgent,
      },
      params,
    }
  }
}
