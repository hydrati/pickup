import { parse } from "acorn";
import MagicString from "magic-string";
import { Scope } from "./src/scope"; 

const src = `
const a = {
  b: c,
  a: k
}


{
  console.log(a)
  const a = 16
}
`

const ast = parse(src, {
  ecmaVersion: 'latest'
})

const root = new Scope()
root.scan(new MagicString(src), ast)

console.log(root)