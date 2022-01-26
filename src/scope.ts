import * as acorn from "acorn";
import { recursive } from 'acorn-walk'
import { readFileSync } from "fs";
import MagicString from "magic-string";

export class Ident {
  private _count = 0

  constructor(
    public scope: Scope,
    public name: MagicString,
    public node: acorn.Node,
    public refs: MagicString[] = []
  ) {}

  count(magic: MagicString) {
    this.refs.push(magic)
    this._count += 1
  }

  rename(n: string) {
    for (const m of this.refs) {
      m.overwrite(0, m.length(), n)
    }
  }

  get nameStr() {
    return this.name.toString()
  }

  unused() {
    return this._count <= 0
  }
}

export class Scope {
  constructor(
    public parent: Scope | null = null,
    public children: Scope[] = [],
    public ident: Ident[] = [],
    public names: Set<string> = new Set
  ) {
    parent?.children.push(this)
  }

  isRoot() {
    return this.parent === null
  }

  createChild() {
    return new Scope(this)
  }

  define(name: MagicString, node: acorn.Node): Ident {
    const n = new Ident(this, name, node)
    this.names.add(n.nameStr)
    this.ident.push(n)
    return n
  }

  getHere(name: string): Ident | undefined {
    return this.ident.find(v => {
      if (v.nameStr === name) {
        return v
      }
    })
  }

  get(name: string): Ident | undefined {
    const h = this.getHere(name)

    if (h === undefined) {
      if (this.parent !== null) {
        return this.parent.get(name)
      }
      return undefined
    }
    return h!
  }

  scan(src: MagicString, node: acorn.Node): this {
    recursive<Scope>(
      node,
      this,
      {
        'VariableDeclaration': (node: any, state, cb) => {
          for (const d of node.declarations) {
            state.define(src.snip(d.id.start, d.id.end), d)
          }
        },
        'FunctionDeclaration': (node: any, state, cb) => {
          state.define(src.snip(node.id.start, node.id.end), node)
        },
        'ClassDeclaration': (node: any, state, cb) => {
          state.define(src.snip(node.id.start, node.id.end), node)
        }
        ,
        'Identifier': (node: any, state) => {
          state.get(node.name)?.count(node)
        },
        'BlockStatement': (node: any, state, cb) => {
          const c = state.createChild(), s: any[] = [];
          for (const n of node.body) {
            if (n.type === 'VariableDeclaration') {
              for (const d of n.declarations) {
                c.define(src.snip(d.id.start, d.id.end), d)
              }
            } else if(n.type === 'FunctionDeclaration') {
              state.define(src.snip(n.id.start, n.id.end), n)
            } else if(n.type === 'ClassDeclaration') {
              state.define(src.snip(n.id.start, n.id.end), n)
            } else s.push(n)
          }

          for (const n of s) cb(n, c)
        }
      }
    )
    
    return this
  }
}
