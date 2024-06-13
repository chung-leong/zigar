import Terser from '@rollup/plugin-terser';
import StripCode from 'rollup-plugin-strip-code';

const productionReady = false;

export default {
  input: 'src/addon.js',
  plugins: [
    StripCode({
      start_comment: 'OVERRIDDEN',
      end_comment: 'OVERRIDDEN-END'
    }),
    StripCode({
      start_comment: 'DEV-TEST',
      end_comment: 'DEV-TEST-END'
    }),
    StripCode({
      start_comment: 'WASM-ONLY',
      end_comment: 'WASM-ONLY-END'
    }),
  ],
  output: {
    file: 'src/addon.js.txt',
    format: 'iife',
    name: 'variable',
    plugins: [
      productionReady && Terser(),
      {
        // place JS code into a C++ string
        name: 'C++ string',
        renderChunk (code) {
          // rollup insisted on using a variable--remove it
          const iife = code.replace(/var variable\s*=\s*([\s\S]*);/, '($1)');
          // MSVC can't handle long raw string--need to break it up
          const lines = iife.split(/(?<=\n)/);
          const literals = lines.map(l => JSON.stringify(l));
          return literals.join('\n');
        }
      },
    ]
  },
};
