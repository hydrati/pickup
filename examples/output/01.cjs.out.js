const createRequire = (modules) => {
  const caches = /* @__PURE__ */ new Map(), require = (id) => {
    if (caches.has(id))
      return caches.get(id);
    if (modules[id] == null)
      throw new Error("Not Found Module");
    {
      const module2 = {};
      return caches.set(id, module2), modules[id](require, module2), module2;
    }
  };
  return require;
}, _entryModules = "D:\\Projects\\pickup\\examples\\01.js", _modules = {
  "D:\\Projects\\pickup\\examples\\03.ts": (__pickup_require__, __pickup_module__) => {
    const ab = () => {
      console.log("03 ab");
    };
    __pickup_module__.ab = ab;
  },
  "D:\\Projects\\pickup\\examples\\01.js": (__pickup_require__, __pickup_module__) => {
    const { ab } = __pickup_require__("D:\\Projects\\pickup\\examples\\01.js");
    function aa() {
    }
    ab();
    const h2 = "hello";
    __pickup_module__.h2 = h2;
    const h1 = 90;
    console.log(h2), __pickup_module__.h1 = h1;
  }
}, _require = createRequire(_modules), _entry = _require(_entryModules);
module.exports = _entry, module.exports.__esModule = !0;
