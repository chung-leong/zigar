import Terser from '@rollup/plugin-terser';
import Replace from '@rollup/plugin-replace';

const production = false;

export default [
  {
    input: 'src/addon.js',
    plugins: [
      Replace({
        preventAssignment: true,
        'process.env.NODE_ENV': '"production"',
        'process.env.NODE_ZIG_TARGET': '"NODE-CPP-EXT"',
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
            code = code.replace(/var variable\s*=\s*([\s\S]*);/, '($1)');
            return `R"=====(\n${code}\n)====="`;
          }
        },
      ]
    },
  }
];