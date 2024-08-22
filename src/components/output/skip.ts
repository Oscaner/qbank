import sleep from 'sleep-promise'

import {ConvertOptions, UploadOptions} from '../../types/common.js'
import {emitter} from '../../utils/event.js'
import {Output, Params} from './common.js'

export default class Skip extends Output {
  public static META = {key: 'skip', name: '跳过'}

  public async convert(params: Params, _options: ConvertOptions): Promise<void> {
    emitter.emit('output.convert.count', params.sheet.count)
    await sleep(1000)
    emitter.closeListener('output.convert.count')
  }

  public async upload(params: Params, _options: UploadOptions): Promise<void> {
    emitter.emit('output.upload.count', params.sheet.count)
    await sleep(1000)
    emitter.closeListener('output.upload.count')
  }
}