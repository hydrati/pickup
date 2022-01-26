import path from 'path'
import { readFile } from 'fs/promises'
import * as esBuild from 'esbuild'
import { SourceMap } from 'magic-string'
import { Plugin } from '../plugin'

export const esbuild = (): Plugin => ({
  name: 'esbuild',
  async load(id, read) {
    const ext = path.extname(id)
    if (ext !== '.ts' && ext !== '.jsx' && ext !== '.tsx') {
      return null;
    } else {
      const r = (await read()).toString('utf8')
      const esb = await esBuild.transform(r, {
        sourcemap: true,
        tsconfigRaw: await readFile('./tsconfig.json', 'utf8'),
        sourcefile: id,
        color: true,
        loader: ext.slice(1) as esBuild.Loader
      })

      return { code: esb.code, map: new SourceMap(JSON.parse(esb.map)) }
    }
  }
})