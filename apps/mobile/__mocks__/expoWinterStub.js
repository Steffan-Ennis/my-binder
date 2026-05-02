// No-op stub for Expo's "winter" runtime polyfills. The polyfills install lazy
// getters on globalThis (e.g. __ExpoImportMetaRegistry) that fire AFTER the
// Jest test runtime is in isolated mode, triggering
//   ReferenceError: You are trying to `import` a file outside of the scope of the test code
// in jest-runtime/_execModule. Our unit tests never exercise the polyfilled
// globals, so this short-circuits the lazy require chain entirely.
module.exports = {};
