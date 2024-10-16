import cacheManager from '@type-cacheable/core'

import {ComponentMeta} from '../types/common.js'

abstract class Component {
  public static META: ComponentMeta

  public getCacheClient = () => {
    if (!cacheManager.default.client) {
      throw new Error('Cache client not found')
    }

    return cacheManager.default.client
  }

  public getUsername = () => this.username

  private username: string

  constructor(username: string) {
    this.username = username
  }
}

export {Component}
