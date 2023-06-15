import Terser from '@rollup/plugin-terser';

const minify = false;

export default {
  input: 'src/define.js',
  output: {
		file: 'src/addon.js.txt',
		format: 'iife',
    plugins: [ 
      minify ? Terser() : undefined,
      {
        // place JS code into a C++ raw string 
        // we can't rely on banner/footer here since those are seen by Terser, 
        // which would promptly throw a syntax error
        name: 'C++ string',
        renderChunk (code) {
          return `R"=====(\n${code}\n)====="`;
        }
      },
    ]
	},
  onwarn(warning, warn) {
    if (warning.code === 'MISSING_NAME_OPTION_FOR_IIFE_EXPORT') return
    warn(warning)
  }   
};