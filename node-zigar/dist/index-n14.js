import { load, parseZigURL } from './index.js';

export function resolve(specifier, context, defaultResolve) {
  return defaultResolve(specifier, context, defaultResolve);
}

export async function getFormat(url, context, defaultGetFormat) {
  const m = parseZigURL(url);
  if (!m) {
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
