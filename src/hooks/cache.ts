import {Hook} from '@oclif/core'

import '../cache/index.js'

const hook: Hook<'init'> = async () => {
  // This hook is run before any command
}

export default hook
