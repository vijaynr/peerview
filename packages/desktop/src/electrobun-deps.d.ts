// Stub for electrobun's three.js dependency — electrobun ships raw .ts
// that imports 'three' but we don't need the types.
declare module "three" {
  const _: any
  export = _
  export default _
}
