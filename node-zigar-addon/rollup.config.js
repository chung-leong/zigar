import Terser from '@rollup/plugin-terser';
import Replace from '@rollup/plugin-replace';

const production = false;

export default {
  input: 'src/addon.js',
  plugins: [
    Replace({
      preventAssignment: true,
      'process.env.ZIGAR_TARGET': '"NODE-CPP-EXT"',
      'process.env.ZIGAR_DEV': 'false',
    }),
  ],
  output: {
    file: 'src/addon.js.txt',
    format: 'iife',
    name: 'variable',
    plugins: [
      production && Terser(),
      {
        // place JS code into a C++ raw string
        // we can't rely on banner/footer here since those are seen by Terser,
        // which would promptly throw a syntax error
        name: 'C++ string',
        renderChunk (code) {
          // Terser insists on saving result to variable--remove assignment
          code = code.replace(/var variable\s*=\s*([\s\S]*);/, '$1');
          // convert iife to fe--just a function expression
          code = code.replace(/^([\s\S]*)\(.*\)$/, '$1');
          // insert variable "imports"
          code = code.replace(/(function\s*)\((.*?)\)/, '$1($2, imports)');
          return `R"=====(\n${code}\n)====="`;
        }
      },
    ]
  },
};
