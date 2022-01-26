import { esbuild } from './plugins/esbuild'
import { transform } from 'esbuild'
import { writeFile } from 'fs/promises'
import { Pickup } from '.'
import minimist from 'minimist'

(async() => {
  const args = minimist(process.argv.slice(2), {
    '--': false,
  })
  console.log(args)
  const pickup = new Pickup({
    input: args.i,
    plugins: [esbuild()]
  })

  const graph = await pickup.createMainGraph()

  const bundle = (await pickup.bundle(graph, args.f)).toString()
  
  await writeFile(args.o, (await transform(bundle, {
    minifySyntax: true,
    minifyWhitespace: false,
    minifyIdentifiers: false,
  })).code)
})()