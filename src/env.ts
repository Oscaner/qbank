import 'dotenv/config'
import fs from 'fs-extra'
import path from 'node:path'
import {packageDirectorySync} from 'pkg-dir'

export const CLI_ROOT_DIR = process.cwd()

export const PKG_ROOT_DIR = packageDirectorySync() || CLI_ROOT_DIR

export const PKG_ASSETS_DIR = path.join(PKG_ROOT_DIR, 'src', 'assets')

export const CLI_ASSETS_DIR = path.join(CLI_ROOT_DIR, 'assets')

fs.ensureDirSync(PKG_ASSETS_DIR)

fs.ensureDirSync(CLI_ASSETS_DIR)
