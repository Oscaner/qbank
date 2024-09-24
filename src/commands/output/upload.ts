import {Flags} from '@oclif/core'
import {Presets, SingleBar} from 'cli-progress'

import BaseCommand from '../../base.js'
import VendorManager from '../../components/vendor/index.js'
import {Bank} from '../../types/bank.js'
import {Category} from '../../types/category.js'
import {Sheet} from '../../types/sheet.js'
import {emitter} from '../../utils/event.js'
import {find} from '../../utils/index.js'

export default class Upload extends BaseCommand {
  static args = {}

  static description = '上传题目到接收方'

  static example = [
    `<%= config.bin %> <%= command.id %>
Upload questions (./src/commands/output/upload.ts)
`,
  ]

  static flags = {
    bank: Flags.string({char: 'b', default: '', description: '题库ID/名称/Key'}),
    category: Flags.string({char: 'c', default: '', description: '分类ID/名称'}),
    output: Flags.string({char: 'o', default: '', description: '接收方'}),
    output_username: Flags.string({default: '', description: '接收方用户名'}),
    sheet: Flags.string({char: 's', default: '', description: '试卷ID/名称'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Upload)

    await this.ensureFlags(flags)

    // vendor.
    const vendor = new (VendorManager.getClass(flags.vendor))(flags.username)

    // output.
    const output = new vendor.allowedOutputs[flags.output](flags.username, flags.output_username)

    // bank.
    const banks = await vendor.banks()
    const bank = find<Bank>(banks, flags.bank) as Bank

    // category.
    const categories = await vendor.categories({bank})
    const category = find<Category>(categories, flags.category, {excludeKey: ['children']}) as Category

    // sheet.
    const sheets = await vendor.sheets({bank, category})
    const sheet = find<Sheet>(sheets, flags.sheet) as Sheet

    if (sheet.id !== '*') {
      // upload.
      output.upload({bank, category, sheet, vendor}, {reupload: flags.clean})

      // processing.
      const bar = new SingleBar({}, Presets.rect)

      bar.start(sheet.count || 0, 0)

      for await (const data of emitter.listener('output.upload.count')) {
        bar.update(data as number)
      }

      bar.stop()

      return
    }

    for (const _sheet of await vendor.sheets({bank, category}, {excludeTtl: true})) {
      this.log(`\n---`)

      const _argv = [
        '--vendor',
        flags.vendor,
        '--username',
        flags.username,
        '--bank',
        bank.name,
        '--category',
        category.name,
        '--sheet',
        _sheet.name,
        '--output',
        flags.output,
        '--output_username',
        flags.output_username,
      ]

      if (flags.clean) {
        _argv.push('--clean')
      }

      this.log(`\n*(output:upload)`)
      await this.config.runCommand('output:upload', _argv)
    }
  }
}
