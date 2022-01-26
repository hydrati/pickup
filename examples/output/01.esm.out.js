const createRequire = (modules) => {
  const caches = /* @__PURE__ */ new Map(), require = (id) => {
    if (caches.has(id))
      return caches.get(id);
    if (modules[id] == null)
      throw new Error("Not Found Module");
    {
      const module = {};
      return caches.set(id, module), Promise.resolve(modules[id](require, module)).then(() => module);
    }
  };
  return require;
}, _entryModules = "D:\\Projects\\pickup\\examples\\01.js", _modules = {
  "D:\\Projects\\pickup\\examples\\03.ts": async (__pickup_require__, __pickup_module__) => {
    const ab = () => {
      console.log("03 ab");
    };
    __pickup_module__.ab = ab;
  },
  "D:\\Projects\\pickup\\examples\\01.js": async (__pickup_require__, __pickup_module__) => {
    const { ab } = await __pickup_require__("D:\\Projects\\pickup\\examples\\01.js");
    function aa() {
    }
    ab();
    const h22 = "hello";
    __pickup_module__.h2 = h22;
    const h12 = 90;
    console.log(h22), __pickup_module__.h1 = h12;
  }
}, _require = createRequire(_modules), _entry = await _require(_entryModules);
export const h2 = _entry.h2, h1 = _entry.h1;
export default _entry.default;
