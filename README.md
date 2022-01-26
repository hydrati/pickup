# Pickup
> Pickup? Rollup?

Toy-level Javascript Bundler.
**DON'T USE IN PRODUCTION!**

## Usage
```
ts-node src/cli.ts -f {output format: 'esm' | 'cjs'} -i {input} -o {output}
```

## API?
```typescript
const pickup = new Pickup({
  input: args.i,
  plugins: [esbuild()]
})

const graph = await pickup.createMainGraph()

const bundle = await pickup.bundle(graph, args.f)

const file = bundle.toString()  /// dirty output
```