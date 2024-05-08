import { load } from './index.js';

export function resolve(specifier, context, defaultResolve) {
  return defaultResolve(specifier, context, defaultResolve);
}

const extensionsRegex = /\.(zig|zigar)(\?|$)/;

export async function getFormat(url, context, defaultGetFormat) {
  if (!extensionsRegex.test(url)) {
    return defaultGetFormat(url, context, defaultGetFormat);
  }
  return { format: 'module' };
}

export async function getSource(url, context, defaultGetSource) {
  const result = await load(url, context, () => {});
  if (result) {
    const { source } = result;
    return { source };
  } else {
    return defaultGetSource(url, context, defaultGetSource);
  }
}
