export async function load(libPath) {
  const { createRequire } = await import('module');
  const { fileURLToPath } = await import('url');
  const require = createRequire(import.meta.url);
  const extPath = fileURLToPath(new URL('../build/Release/addon', import.meta.url));
  const { load } = require(extPath);
  return load(libPath);
}
