type ApiDelegate = {
  ApiParams: Record<string, any>
  CreateExerciseApi: string
  CreatePaperExerciseApi?: string
  dataPath: string
  EmptyMessage: string
  GetCategoriesApi: string
  GetCategoryMetaApi?: string
  GetEtRuleApi?: string
  GetEtRuleQuestionsApi?: string
  GetExerciseApi: string
  GetExerciseUnfinishedApi: string
  GetFavoriteQuizListApi: string
  GetGiantPageSolutionApi?: string
  GetGiantsApi?: string
  GetHomeCategoriesApi?: string
  GetLabelsApi?: string
  GetMaterialsApi?: string
  GetPaperListApi: string
  GetPdpgApi?: string
  GetQuestionsApi: string
  GetSolutionsApi: string
  GetUniversalAuthQuestionsApi?: string
  GetUniversalAuthSolutionsApi?: string
  PostIncrEndpoint: string
  PostSubmitApi: string
  QuestionListApi?: string
  UpdateQuizApi: string
}

export {ApiDelegate}
