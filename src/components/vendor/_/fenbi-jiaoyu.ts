import path from 'node:path'

import type {CacheRequestConfig} from 'axios-cache-interceptor'
import lodash from 'lodash'

import {LoginOptions} from '../../../@types/common.js'
import {ApiDelegate} from '../../../@types/vendor/fenbi.js'
import FenbiKaoyan from './fenbi-kaoyan.js'
import Fenbi from './fenbi.js'

/**
 * Fenbi Jiaoyu.
 */
export default class FenbiJiaoyu extends Fenbi {
  public static META = {key: path.parse(import.meta.url).name, name: '粉笔教育'}

  protected get apiDelegate(): ApiDelegate {
    return {
      ApiParams: {filter: 'keypoint'},
      CreateExerciseApi: 'https://tiku.fenbi.com/api/{{bankPrefix}}/exercises',
      dataPath: 'data.data.favoriteQuizVO',
      EmptyMessage: '请前往 <粉笔> App 加入题库: 练习 > 右上角+号',
      GetCategoriesApi: 'https://tiku.fenbi.com/api/{{bankPrefix}}/categories',
      GetEtRuleApi: 'https://tiku.fenbi.com/api/{{bankPrefix}}/etRuleQuestion/categories',
      GetEtRuleQuestionsApi:
        'https://tiku.fenbi.com/api/{{bankPrefix}}/etRuleQuestion/question-list' +
        '?questionType={{sheetId}}&toPage={{page}}',
      GetExerciseApi: 'https://tiku.fenbi.com/api/{{bankPrefix}}/exercises/{{exerciseId}}',
      GetExerciseUnfinishedApi: 'https://tiku.fenbi.com/api/{{bankPrefix}}/category-exercises-unfinished',
      GetFavoriteQuizListApi: 'https://tiku.fenbi.com/activity/userquiz/getFavoriteQuizList',
      GetGiantPageSolutionApi: 'https://tiku.fenbi.com/combine/keypoint/giant/getPageSolution',
      GetGiantsApi: 'https://tiku.fenbi.com/api/{{bankPrefix}}/giants',
      GetHomeCategoriesApi: 'https://tiku.fenbi.com/api/{{bankPrefix}}/categories/home',
      GetPaperListApi: 'https://tiku.fenbi.com/api/{{bankPrefix}}/papers',
      GetPdpgApi: 'https://tiku.fenbi.com/api/{{bankPrefix}}/pdpg/categories',
      GetQuestionsApi: 'https://tiku.fenbi.com/api/{{bankPrefix}}/universal/questions',
      GetSolutionsApi: 'https://tiku.fenbi.com/api/{{bankPrefix}}/pure/solutions',
      GetUniversalAuthQuestionsApi: 'https://tiku.fenbi.com/api/{{bankPrefix}}/universal/auth/questions',
      GetUniversalAuthSolutionsApi: 'https://tiku.fenbi.com/api/{{bankPrefix}}/universal/auth/solutions',
      PostIncrEndpoint: 'https://tiku.fenbi.com/api/{{bankPrefix}}/async/exercises/{{exerciseId}}/incr',
      PostSubmitApi: 'https://tiku.fenbi.com/api/{{bankPrefix}}/async/exercises/{{exerciseId}}/submit',
      UpdateQuizApi: 'https://tiku.fenbi.com/iphone/{{bankPrefix}}/users/quizChange/{{quizId}}',
    }
  }

  public async login(options?: LoginOptions): Promise<CacheRequestConfig> {
    const config = await new FenbiKaoyan(this.getUsername()).login(options)

    config.params = lodash.merge({}, config.params, {
      app: 'gwy',
    })

    return config
  }
}
