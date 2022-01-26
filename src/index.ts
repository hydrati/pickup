import * as acorn from 'acorn'
import * as walk from 'acorn-walk'
import { fstat, readFileSync } from 'fs'
import { readFile, writeFile } from 'fs/promises'
import path from 'path'
import MagicString, { Bundle } from 'magic-string'

import {
  IModuleGraphNode,
  IModuleGraphExprImport,
  ModuleGraphExport,
  IModuleGraphStaticImport,
} from './graph'
import { PickupOptins } from './options'
import { ILoadResult } from './plugin'
import { toBase64 } from 'js-base64'
import { Scope } from './scope'

const entry = path.resolve(__dirname, '..', 'examples', '01.js')

function escape(string: string) {
	if (typeof string !== 'string') {
		throw new TypeError('Expected a string');
	}

	return string
		.replace(/[|\\{}()[\]^$+*?]/g, '\\$&')
		.replace(/-/g, '\\x2d');
}


export class Pickup {
  constructor(public options: PickupOptins) {
    this.options.plugins ??= []
  }

  async resolveId(input: string, importer?: string, entry = false) {
    for (const p of this.options.plugins!) {
      if (typeof p.resolve === 'function') {
        const r = await p.resolve(input, importer, { entry });
        if (typeof r == 'string') {
          // console.log('resolved', p.name, r)
          return r!
        }
      }
    }

    return path.resolve(
      importer != undefined ? path.dirname(importer) : process.cwd(),
      input
    )
  }

  async load(entry: string): Promise<ILoadResult> {
    const f = () => readFile(entry)

    for (const p of this.options.plugins!) {
      if (typeof p.load === 'function') {
        const r = await p.load(entry, f)
        if (typeof r === 'object' && r !== null) {
          return r!
        }
      }
    }

    const c = (await f()).toString('utf8')

    return {
      code: c
    }
  }

  async createMainGraph(resolveDeps = true) {
    const id = await this.resolveId(this.options.input, undefined, true);
    const g = await this.resolveScript(id)
    if (!resolveDeps) {
      return g
    }

    return await this.resolveDeps(g)
  }

  async transform(
    source: ILoadResult,
    id: string
  ): Promise<ILoadResult> {
    let s = source;
    for (const p of this.options.plugins!) {
      if (typeof p.transform === 'function') {
        const l = await p.transform(s, id)
        if (l !== null && l !== undefined) {
          if (typeof l === 'string') {
            s = {
              code: l
            }
          } else if (typeof l === 'object') {
            const r = Object.assign(l, s)
            s = r
          }
        }
      }
    }

    return s
  }

  async parse(code: string, options?: acorn.Options): Promise<acorn.Node> {
    for (const p of this.options.plugins!) {
      if (typeof p.parse === 'function') {
        const r = await p.parse(code, options)
        if (r !== null) {
          return r
        }
      }
    }

    return acorn.parse(code, options ?? { ecmaVersion: 'latest' })
  }

  async resolveScript(entry: string): Promise<IModuleGraphNode> {
    const source = await this.transform(
      await this.load(entry),
      entry,
    )

    const magic = new MagicString(source.code, {
      filename: entry,
      indentExclusionRanges: []
    })
  
    const ast = source.ast ?? await this.parse(source.code, {
      sourceType: 'module',
      sourceFile: entry,
      ecmaVersion: 'latest'
    })
  
    const module_imports: acorn.Node[] = [], module_exports: acorn.Node[] = []
  
    const graph = {
      source,
      code: magic.clone(),
      magic,
      node: ast,
      exports: [],
      imports: [],
      export_nodes: module_exports,
      import_nodes: module_imports,
      path: entry,
      scope: new Scope,
      import_idents: new Map(),
      static_deps: new Set(),
      circular: new Map,
      children: new Map,
    } as IModuleGraphNode

    const pool: Promise<any>[] = []

    const collectAsync = (fn: (node: any) => Promise<any>): (node: any) => void => {
      return n => {
        pool.push(fn(n))
      }
    }
  
    walk.simple(ast, {
      ImportDeclaration: collectAsync(async (node: any) => {
        const id = await this.resolveId(node.source.value, graph.path, false)
        const i = {
          node,
          specifiers: [],
          static: true,
          source: id,
          code: magic.snip(node.start, node.end)
        } as IModuleGraphStaticImport
  
        graph.static_deps.add(id)
  
        for (const s of node.specifiers) {
          if (s.type === 'ImportNamespaceSpecifier') {
            i.specifiers.push({
              type: 'all',
              local: magic.snip(s.local.start, s.local.end),
              node: s
            })
          } else if (s.type === 'ImportDefaultSpecifier') {
            i.specifiers.push({
              type: 'default',
              local: magic.snip(s.local.start, s.local.end),
              node: s
            })
          } else if (s.type === 'ImportSpecifier') {
            i.specifiers.push({
              type: 'named',
              imported: magic.snip(s.imported.start, s.imported.end),
              local: magic.snip(s.local.start, s.local.end),
              node: s
            })
          }
        }
  
        graph.imports.push(i)
  
        module_imports.push(node)
      }),
      ImportExpression: collectAsync(async (node: any) => {
        const i = {
          node,
          static: false,
          specifiers: [],
          source: node.source,
          code: magic.snip(node.start, node.end)
        } as IModuleGraphExprImport
  
        graph.imports.push(i)
  
        module_imports.push(node)
      }),
  
      ExportAllDeclaration: collectAsync(async (node: any) => {
        let id: string | null = null
        if (typeof node.source === 'string') {
          id = await this.resolveId(node.source.value, graph.path, false)
        }
        const e = {
          node,
          source: id,
          specifiers: [],
          local: id === null,
          code: magic.snip(node.start, node.end)
        } as ModuleGraphExport
  
        e.specifiers.push({
          type: 'all',
          exported: magic.snip(node.exported.start, node.exported.end),
          node: node.exported
        })
  
        if (node.source !== null) {
          graph.static_deps.add(node.source.value)
        }
  
        graph.exports.push(e)
  
        module_exports.push(node)
        module_exports.push(node)
      }),
      ExportNamedDeclaration: collectAsync(async (node: any) => {
        let id: string | null = null
        if (typeof node.source === 'string') {
          id = await this.resolveId(node.source.value, graph.path, false)
        }
        const e = {
          node,
          source: id,
          specifiers: [],
          local: id === null,
          code: magic.snip(node.start, node.end)
        } as ModuleGraphExport
  
        if (node.declaration === null || node.declaration === undefined) {
          for (const s of node.specifiers) {
            if (s.type === 'ExportSpecifier') {
              e.specifiers.push({
                type: 'named',
                local: magic.snip(s.local.start, s.local.end),
                exported: magic.snip(s.exported.start, s.exported.end),
                node: s
              })
            } else {
              throw new Error('named?')
            }
          }
        } else {
          // // console.log(node.declaration)
          if (node.declaration.type == 'VariableDeclaration') {
            const l = node.declaration.declarations.map((v: any) => v.id);
            e.specifiers.push({
              type: 'named-decl',
              node,
              decl: node.declaration,
              local_node: l,
              local: l.map((v: any) => magic.snip(v.start, v.end)),
            })
          } else {
            e.specifiers.push({
              type: 'named-decl',
              node,
              decl: node.declaration,
              local_node: node.declaration.id,
              local: magic.snip(node.declaration.id.start, node.declaration.id.end),
            })
          }
        }
  
        if (node.source !== null) {
          graph.static_deps.add(node.source.value)
        }
  
        graph.exports.push(e)
        module_exports.push(node)
      }),
      ExportDefaultDeclaration: (node: any) => {
        const e = {
          node,
          source: null,
          specifiers: [{
            type: 'default',
            decl: node.declaration,
            node,
          }],
          local: true,
          code: magic.snip(node.start, node.end)
        } as ModuleGraphExport
        // // console.log(node)
  
        if (node.source != null && node.source != undefined) {
          graph.static_deps.add(node.source.value)
        }
  
        graph.exports.push(e)
  
        module_exports.push(node)
      }
    })

    await Promise.all(pool)

    for (const e of graph.imports) {
      if (e.static) {
        for (const s of e.specifiers) {
          graph.import_idents.set(s, graph.scope.define(s.local, s.node))
        }
      }
    }

    for (const e of graph.exports) {
      magic.remove(e.node.start, e.node.end)
    }

    graph.scope.scan(magic, ast)
  
    return graph
  }
  
  async resolveDeps(
    graph: IModuleGraphNode, 
    circular = new Set<string>(), 
    circular_map = new Map<string, IModuleGraphNode>()
  ) {
    circular.add(graph.path)
    circular_map.set(graph.path, graph)
    for (const p of graph.static_deps) {
      if (circular.has(p)) {
        // // // console.log(p, circular, circular_map)
        graph.circular.set(p, circular_map.get(p)!)
        circular_map.get(p)!.circular.set(graph.path, graph)
      } else {
        circular.add(p)
        const g = await this.resolveScript(p)
        // // // console.log(g)
        circular_map.set(p, g)
        // // // console.log('r', circular, circular_map)
        const d = await this.resolveDeps(g, circular, circular_map)
        // // // console.log(d)
        graph.children.set(p, d)
      }
    }
  
    return graph
  }

  async bundle(entry: IModuleGraphNode, format: string): Promise<string> {
    const added = new Set<string>()
    const scope = new Scope()
    // console.log(graph.path)

    const utils_create_require = `const createRequire = (modules) => {
      const caches = new Map();

      const require = (id) => {
        if (caches.has(id)) {
          return caches.get(id)
        } else {
          if (modules[id] == undefined) {
            throw new Error('Not Found Module');
          } else {
            const module = {}
            caches.set(id, module)
            ${
              format == 'esm'
              ? `const p = Promise.resolve(modules[id](require, module));
              return p.then(() => module) `
              : `modules[id](require, module); return module;`
            }
          }
        }
      }
      return require;
    };
    
    const _entryModules = '${escape(entry.path)}';
    const _modules = {`

    const utils_entry_load = `const _require = createRequire(_modules);
const _entry = ${format == 'esm' ? 'await' : ''} _require(_entryModules);`
    const utils_module_wrap_head = `': ${format == 'esm' ? 'async' : ''} (__pickup_require__, __pickup_module__) => {\n`
    const utils_module_wrap_end = `},`

    const b = new Bundle({})
    
    /*
    

    const _entryModules = '...'
    const _modules = {
      '....': async(__pickup_require__, __pickup_module__) => {
        const {...} = await __pickup_require__('...');
      }
    }

    const _require = createRequire(_modules)
    const _entry = await _require(_entryModules)

    export const ... = _entry....
    export default _entry?.default;
    */
    // console.log(graph)
    const appendDeps = (g: IModuleGraphNode, i?: IModuleGraphNode, entry = true) => {
      added.add(g.path)
      const s = (`  '${escape(g.path)}${utils_module_wrap_head}`)
      for (const im of g.imports) {
        if (im.static) {
          if (g.children.has(im.source) || g.circular.has(im.source)) {
            const ss = g.children.get(im.source) ?? g.circular.get(im.source)!
            // console.log(added, im.source, ss.path)
            if (!added.has(im.source)) {
              appendDeps(ss, g, false)
            }
            added.add(im.source)

            const e = ` = ${format == 'esm' ? 'await' : ''} __pickup_require__('${escape(g.path)}');`;
            const es = []
            es.push(`\n;const `);
            if (im.specifiers?.[0].type === 'all') {
              es.push(im.specifiers?.[0].local.toString())
            } else {
              es.push('{ ')
              for (const sp of im.specifiers) {
                if (sp.type === 'default') {
                  es.push(`default: ${sp.local.toString()}, `)
                } else if (sp.type === 'named') {
                  es.push(`${sp.imported.toString()}: ${sp.local.toString()}, `)
                }
              }
              es.push('}')
            }
            es.push(e);
            // // console.log(g.code.overwrite(im.node.start, im.node.end, es.join('')).toString())
            g.code = g.code.overwrite(im.node.start, im.node.end, es.join(''))
          }
        } else {
          const src = g.code.snip(im.source.start, im.source.end)
          g.code = g.code.overwrite(im.node.start, im.node.end, src.prepend(`;(__pickup_require__(`).append(`))`).toString())
        }
      }
      for (const ex of g.exports) {
        // // console.log('1', ex)
        const e = []
        if (ex.local) {
          
          for (const sp of ex.specifiers) {
            if (sp.type == 'default') {
              const decl = g.code.snip(sp.decl.start, sp.decl.end)
              e.push(`;(__pickup_module__['default'] = (${decl.toString()}));`)
            } else if (sp.type == 'named-decl') {
              const decl = g.code.snip(sp.decl.start, sp.decl.end)
              e.push(`${
                decl.toString()
              };\n${
                sp.local instanceof Array 
                ? sp.local.map(v => `;(__pickup_module__['${v.toString()}'] = (${v.toString()}));`).join('\n')
                : `;(__pickup_module__['${sp.local.toString()}'] = (${(sp.local.toString())}));`
              }`)
            } else if (sp.type == 'named') {
              e.push(`;(__pickup_module__['${sp.exported.toString()}'] = (${sp.local.toString()}));`)
            }
          }
        } else {
          for (const sp of ex.specifiers) {
            if (sp.type == 'all') {
              e.push(
                `;(__pickup_module__['${sp.exported.toString()}'] = ((${format == 'esm' ? 'await' : ''} __pickup_require__('${escape(g.path)}'))));`
              )
            } else if (sp.type == 'named') {
              e.push(`;(__pickup_module__['${sp.exported.toString()}'] = ((${format == 'esm' ? 'await' : ''} __pickup_require__('${escape(g.path)}'))['${sp.local.toString()}']));`)
            }
          }
        }
        g.code = g.code.overwrite(ex.node.start, ex.node.end, e.join('\n'))
      }

      const code = g.code.prepend(s).append('\n},')

      b.addSource(code)
    }

    appendDeps(entry)

    if (format == 'cjs') {
      return `${utils_create_require}
    ${b.toString()}
  };
  
  ${utils_entry_load}

  module.exports = _entry;
  module.exports.__esModule = true;`
    } else {
      return `${utils_create_require}
    ${b.toString()}
  };
  
  ${utils_entry_load}

  ${
    entry.exports.map(x =>
      x.specifiers.map(v => {
        if (x.local) {
          if (v.type == 'named') {
            if (v.exported.toString() == 'default') {
              return `export default _entry['${v.exported.toString()}'];`
            }
            
            return `export const ${v.exported.toString()} = _entry['${v.exported.toString()}'];`
          } else if (v.type == 'named-decl') {
            if (v.local instanceof Array) {
              return v.local.map(z => `export const ${z.toString()} = _entry['${z.toString()}'];`).join('\n')
            } else {
              return `export const ${v.local.toString()} = _entry['${v.local.toString()}'];`
            }
          }
        } else {
          if (v.type == 'named') {
            return `export const ${v.local.toString()} = _entry['${v.local.toString()}'];`
          } else if (v.type == 'named-decl') {
            if (v.local instanceof Array) {
              return v.local.map(z => `export const ${z.toString()} = _entry['${z.toString()}'];`).join('\n')
            } else {
              return `export const ${v.local.toString()} = _entry['${v.local.toString()}'];`
            }
          } else if (v.type == 'all') {
            return `export const ${v.exported.toString()} = _entry['${v.exported.toString()}'];`
          }
        }
      })
    ).join('\n')
  }
  
  export default _entry.default`
    }
  }
  
}
