import path from 'path'
import { access, readFile } from 'fs/promises'
import { constants } from 'fs'
import { Plugin } from '../plugin'
import { builtinModules } from 'module'
import resolve from 'resolve'

export const node = (): Plugin => ({
  name: 'node-resolve',
  async resolve(id, importer, o) {
    if (o?.entry) {
      return null
    }

    if (builtinModules.includes(id)) {
      return `node:${id}`
    } else {
      try {
        const r = resolve.sync(id, {
          // extensions: ['.jsx', '.js', '.tsx', '.ts'],
          paths: [process.cwd(), importer == undefined ? "" : path.dirname(importer)]
        })
        console.log(r)
        return r
      } catch(e) {
        console.log('failed', id)
        return null
      }
    }
  },

  async load(id) {
    console.log('load', id)
    if (id.startsWith('node:')) {
      return {
        code: `export default globalThis.require('${id.slice(5)}')`
      }
    }
    return null
  }
})