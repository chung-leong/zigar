!function(t,e){"object"==typeof exports&&"undefined"!=typeof module?e(exports):"function"==typeof define&&define.amd?define(["exports"],e):e((t="undefined"!=typeof globalThis?globalThis:t||self).Def={})}(this,(function(t){"use strict";const e={Primitive:0,Array:1,Struct:2,Union:3,ErrorUnion:4,ErrorSet:5,Enum:6,Optional:7,Pointer:8,Slice:9,Vector:10,Opaque:11,ArgStruct:12,VariadicStruct:13,Function:14},n=Object.keys(e),r=1,i=2,s=4,o=8,c=16,a=64,l=128,u=256,f={Void:0,Bool:1,Int:2,Uint:3,Float:4,Object:5,Type:6,Literal:7,Null:8,Undefined:9,Unsupported:10},h=Object.keys(f),y=1,b=2,g=16,p=64,d=globalThis[Symbol.for("ZIGAR")]??={};function m(t){return d[t]??=Symbol(t)}function S(t){return m(t)}const w=S("memory"),v=S("slots"),$=S("zig"),z=S("type"),E=S("flags"),O=S("props"),V=S("sentinel"),A=S("entries"),x=S("keys"),j=S("cache"),I=S("size"),M=S("bit size"),T=S("align"),C=S("const target"),N=S("environment"),D=S("primitive"),F=S("setters"),B=S("typed array"),R=S("signature"),U=S("restore"),L=S("vivificate"),k=S("visit"),P=S("copy"),_=S("shape"),J=S("initialize"),G=S("restrict"),q=S("finalize"),Z=S("cast");function W(t,e,n){if(n){const{set:r,get:i,value:s,enumerable:o,configurable:c=!0,writable:a=!0}=n;Object.defineProperty(t,e,i||r?{get:i,set:r,configurable:c,enumerable:o}:{value:s,configurable:c,enumerable:o,writable:a})}return t}function X(t,e){for(const[n,r]of Object.entries(e))W(t,n,r);for(const n of Object.getOwnPropertySymbols(e)){W(t,n,e[n])}return t}function H(t){return void 0!==t?{value:t}:void 0}function K(t,e){return t instanceof e||(n=t?.constructor,n===(r=e)||n?.[R]===r[R]&&n?.[N]!==r?.[N]);var n,r}function Q({get:t,set:e}){return t.special=e.special=!0,{get:t,set:e}}function Y(){return this}function tt(){}class et{map=new WeakMap;find(t){return this.map.get(t)}save(t,e){return this.map.set(t,e),e}}const nt={name:"",mixins:[],constructor:null};function rt(t){return nt.constructor||nt.mixins.push(t),t}function it(){return nt.constructor||(nt.constructor=function(t,e){const n={},r=function(){for(const[t,e]of Object.entries(n))this[t]=structuredClone(e)},{prototype:i}=r;W(r,"name",H(t));for(const t of e)for(let[e,r]of Object.entries(t))if("function"==typeof r)W(i,e,H(r));else{let t=n[e];if(void 0!==t)if(t?.constructor===Object)r=Object.assign({...t},r);else if(t!==r)throw new Error(`Duplicate property: ${e}`);n[e]=r}return r}(nt.name,nt.mixins),nt.name="",nt.mixins=[]),nt.constructor}rt({accessorCache:new Map,getAccessor(t,e){const{type:n,bitSize:r,bitOffset:i,byteSize:s}=e,o=[],c=void 0===s&&(7&r||7&i);c&&o.push("Unaligned");let a=h[n];r>32&&(n===f.Int||n===f.Uint)&&(a=r<=64?`Big${a}`:`Jumbo${a}`),o.push(a,`${n===f.Bool&&s?8*s:r}`),c&&o.push(`@${i}`);const l=t+o.join("");let u=DataView.prototype[l];if(u)return u;if(u=this.accessorCache.get(l),u)return u;for(;o.length>0;){const n=`getAccessor${o.join("")}`;if(u=this[n]?.(t,e))break;o.pop()}if(!u)throw new Error(`No accessor available: ${l}`);return W(u,"name",H(l)),this.accessorCache.set(l,u),u}}),rt({copiers:null,resetters:null,defineCopier(t,e){const n=this.getCopyFunction(t,e);return{value(t){this[U]?.(),t[U]?.();const e=t[w],r=this[w];n(r,e)}}},defineResetter(t,e){const n=this.getResetFunction(e);return{value(){this[U]?.();const r=this[w];n(r,t,e)}}},getCopyFunction(t,e=!1){this.copiers||(this.copiers=this.defineCopiers());return(e?void 0:this.copiers[t])??this.copiers.any},getResetFunction(t){return this.resetters||(this.resetters=this.defineResetters()),this.resetters[t]??this.resetters.any},defineCopiers(){const t={type:f.Int,bitSize:8,byteSize:1},e={type:f.Int,bitSize:16,byteSize:2},n={type:f.Int,bitSize:32,byteSize:4},r=this.getAccessor("get",t),i=this.getAccessor("set",t),s=this.getAccessor("get",e),o=this.getAccessor("set",e),c=this.getAccessor("get",n),a=this.getAccessor("set",n);return{0:tt,1:function(t,e){i.call(t,0,r.call(e,0))},2:function(t,e){o.call(t,0,s.call(e,0,!0),!0)},4:function(t,e){a.call(t,0,c.call(e,0,!0),!0)},8:function(t,e){a.call(t,0,c.call(e,0,!0),!0),a.call(t,4,c.call(e,4,!0),!0)},16:function(t,e){a.call(t,0,c.call(e,0,!0),!0),a.call(t,4,c.call(e,4,!0),!0),a.call(t,8,c.call(e,8,!0),!0),a.call(t,12,c.call(e,12,!0),!0)},any:function(t,e){let n=0,s=t.byteLength;for(;n+4<=s;)a.call(t,n,c.call(e,n,!0),!0),n+=4;for(;n+1<=s;)i.call(t,n,r.call(e,n)),n++}}},defineResetters(){const t={type:f.Int,bitSize:8,byteSize:1},e={type:f.Int,bitSize:16,byteSize:2},n={type:f.Int,bitSize:32,byteSize:4},r=this.getAccessor("set",t),i=this.getAccessor("set",e),s=this.getAccessor("set",n);return{0:tt,1:function(t,e){r.call(t,e,0)},2:function(t,e){i.call(t,e,0,!0)},4:function(t,e){s.call(t,e,0,!0)},8:function(t,e){s.call(t,e+0,0,!0),s.call(t,e+4,0,!0)},16:function(t,e){s.call(t,e+0,0,!0),s.call(t,e+4,0,!0),s.call(t,e+8,0,!0),s.call(t,e+12,0,!0)},any:function(t,e,n){let i=e;for(;i+4<=n;)s.call(t,i,0,!0),i+=4;for(;i+1<=n;)r.call(t,i,0),i++}}},...{defineRetvalCopier({byteSize:t,bitOffset:e}){if(t>0){const n=this,r=e>>3,i=this.getCopyFunction(t);return{value(e){const s=this[w],{address:o}=e[$],c=new DataView(n.memory.buffer,o+r,t),a=new DataView(s.buffer,s.byteOffset+r,t);i(a,c)}}}},copyExternBytes(t,e,n){const{memory:r}=this,i=new DataView(r.buffer,e,n);this.getCopyFunction(n)(t,i)}}});class st extends SyntaxError{constructor(t){super(`Cannot convert ${t} to an Int`)}}class ot extends TypeError{constructor(t){const{name:e}=t;super(`An initializer must be provided to the constructor of ${e}, even when the intended value is undefined`)}}class ct extends TypeError{constructor(t,n,r=null){const{name:i,type:s,byteSize:o}=t,c=n.byteLength,a=1!==o?"s":"";let l;if(s!==e.Slice||r){l=`${i} has ${s===e.Slice?r.length*o:o} byte${a}, received ${c}`}else l=`${i} has elements that are ${o} byte${a} in length, received ${c}`;super(l)}}class at extends TypeError{constructor(t){const{type:n,byteSize:r,typedArray:i}=t,s=1!==r?"s":"",o=["ArrayBuffer","DataView"].map(St);let c;i&&o.push(St(i.name)),c=n===e.Slice?`Expecting ${wt(o)} that can accommodate items ${r} byte${s} in length`:`Expecting ${wt(o)} that is ${r} byte${s} in length`,super(c)}}class lt extends TypeError{constructor(t,e,n){const{name:r}=t,i=[];if(Array.isArray(e))for(const t of e)i.push(St(t));else i.push(St(e));const s=mt(n);super(`${r} expects ${wt(i)} as argument, received ${s}`)}}class ut extends TypeError{constructor(t,e,n){const{name:r,length:i,instance:{members:[s]}}=t,{structure:{constructor:o}}=s,{length:c,constructor:a}=n,l=e?.length??i,u=1!==l?"s":"";let f;f=a===o?"only a single one":a.child===o?`a slice/array that has ${c}`:`${c} initializer${c>1?"s":""}`,super(`${r} has ${l} element${u}, received ${f}`)}}class ft extends TypeError{constructor(t,e){const{name:n}=t;super(`Missing initializers for ${n}: ${e.join(", ")}`)}}class ht extends TypeError{constructor(t,e){const{name:n,instance:{members:r}}=t,i=r.find((t=>t.name===e));let s;s=i?`Comptime value cannot be changed: ${e}`:`${n} does not have a property with that name: ${e}`,super(s)}}class yt extends TypeError{constructor(t,e){const n=mt(e);super(`Expected ${St(t)}, received ${n}`)}}class bt extends RangeError{constructor(t,e){const{name:n}=t;super(`Index exceeds the size of ${n??"array"}: ${e}`)}}class gt extends TypeError{constructor(){super("Unable to modify read-only object")}}function pt(t,e,n){return n instanceof RangeError&&!(n instanceof bt)&&(n=new bt(t,e)),n}function dt(){throw new gt}function mt(t){const e=typeof t;let n;return n="object"===e?t?Object.prototype.toString.call(t):"null":e,St(n)}function St(t){return`${function(t){return/^\W*[aeiou]/i.test(t)?"an":"a"}(t)} ${t}`}function wt(t,e="or"){const n=` ${e} `;return t.length>2?t.slice(0,-1).join(", ")+n+t[t.length-1]:t.join(n)}function vt(t,n){const{byteSize:r,type:i}=n;if(!(i===e.Slice?t.byteLength%r==0:t.byteLength===r))throw new ct(n,t)}function $t(t){throw new at(t)}function zt(t){return{[Symbol.iterator]:Ot.bind(this,t),length:this[O].length}}function Et(t){return zt.call(this,t)[Symbol.iterator]()}function Ot(t){const e=function(t){return"return"===t?.error?t=>{try{return t()}catch(t){return t}}:t=>t()}(t),n=this,r=this[O];let i=0;return{next(){let t,s;if(i<r.length){const o=r[i++];t=[o,e((()=>n[o]))],s=!1}else s=!0;return{value:t,done:s}}}}function Vt(t,{get:e,set:n}){return void 0!==t?{get:function(){return e.call(this,t)},set:n?function(e,r){return n.call(this,t,e,r)}:void 0}:{get:e,set:n}}function At(t){return(this[v][t]??this[L](t)).$}function xt(t){return this[v][t]??this[L](t)}function jt(t,e,n){(this[v][t]??this[L](t))[J](e,n)}rt({addIntConversion:t=>function(e,n){const r=t.call(this,e,n),{flags:i,bitSize:s}=n;if("set"===e)return s>32?function(t,e,n){r.call(this,t,BigInt(e),n)}:function(t,e,n){const i=Number(e);if(!isFinite(i))throw new st(e);r.call(this,t,i,n)};{const{flags:t}=n.structure;if(t&c&&s>32){const t=BigInt(Number.MAX_SAFE_INTEGER),e=BigInt(Number.MIN_SAFE_INTEGER);return function(n,i){const s=r.call(this,n,i);return e<=s&&s<=t?Number(s):s}}}return r}}),rt({viewMap:null,extractView(t,n,r=$t){const{type:i,byteSize:s,constructor:o}=t;let c;const a=n?.[Symbol.toStringTag];if(a&&("DataView"===a?c=this.registerView(n):"ArrayBuffer"===a?c=this.obtainView(n,0,n.byteLength):(a&&a===o[B]?.name||"Uint8ClampedArray"===a&&o[B]===Uint8Array)&&(c=this.obtainView(n.buffer,n.byteOffset,n.byteLength))),!c){const r=n?.[w];if(r){const{constructor:o,instance:{members:[c]}}=t;if(K(n,o))return r;if(function(t){return t===e.Array||t===e.Vector||t===e.Slice}(i)){const{byteSize:o,structure:{constructor:a}}=c,l=function(t,e){const{constructor:n}=t;return n===e?1:n.child===e?t.length:void 0}(n,a);if(void 0!==l){if(i===e.Slice||l*o===s)return r;throw new ut(t,null,n)}}}}return c?void 0!==s&&vt(c,t):r?.(t,n),c},assignView(t,n,r,i,s){const{byteSize:o,type:c}=r,a=o??1;if(t[w]){const i=c===e.Slice?a*t.length:a;if(n.byteLength!==i)throw new ct(r,n,t);const s={[w]:n};t.constructor[V]?.validateData?.(s,t.length),t[P](s)}else{void 0!==o&&vt(n,r);const e=n.byteLength/a,c={[w]:n};t.constructor[V]?.validateData?.(c,e),s&&(i=!0),t[_](i?null:n,e,s),i&&t[P](c)}},findViewAt(t,e,n){let r,i=(this.viewMap??=new WeakMap).get(t);if(i)if(i instanceof DataView)if(i.byteOffset===e&&i.byteLength===n)r=i,i=null;else{const e=i,n=`${e.byteOffset}:${e.byteLength}`;i=new Map([[n,e]]),this.viewMap.set(t,i)}else r=i.get(`${e}:${n}`);return-1===r?.[$]?.address&&(r=null),{existing:r,entry:i}},obtainView(t,e,n){const{existing:r,entry:i}=this.findViewAt(t,e,n);let s;return r||(i?(s=new DataView(t,e,n),i.set(`${e}:${n}`,s)):this.viewMap.set(t,s=new DataView(t,e,n)),t!==this.memory?.buffer&&t!==this.usizeMaxBuffer||(s[$]={address:e,len:n}),s)},registerView(t){if(!t[$]){const{buffer:e,byteOffset:n,byteLength:r}=t,{existing:i,entry:s}=this.findViewAt(e,n,r);if(i)return i;s?s.set(`${n}:${r}`,t):this.viewMap.set(e,t)}return t},allocateMemory(t,e=0,n=null){return n?.alloc?.(t,e)??this.allocateJSMemory(t,e)},...{allocateJSMemory(t,e){return this.obtainView(new ArrayBuffer(t),0,t)},restoreView(t){const e=t?.[$];return e?.len>0&&0===t.buffer.byteLength&&(t=this.obtainZigView(e.address,e.len),e.align&&(t[$].align=e.align)),t},defineRestorer(){const t=this;return{value(){const e=this[w],n=t.restoreView(e);return e!==n&&(this[w]=n,this.constructor[j]?.save?.(n,this),!0)}}}}}),rt({defineStructEntries:()=>H(zt),defineStructIterator:()=>H(Et)}),rt({defineMember(t,e=!0){if(!t)return{};const{type:r,structure:i}=t,s=this[`defineMember${h[r]}`].call(this,t);if(e&&i){const{type:e}=i,r=this[`transformDescriptor${n[e]}`];if(r)return r.call(this,s,t)}return s}}),rt({defineBase64(t){const e=this;return Q({get(){return function(t){const e=new Uint8Array(t.buffer,t.byteOffset,t.byteLength),n=String.fromCharCode.apply(null,e);return btoa(n)}(this.dataView)},set(n,r){if("string"!=typeof n)throw new yt("string",n);const i=function(t){const e=atob(t),n=new Uint8Array(e.length);for(let t=0;t<n.byteLength;t++)n[t]=e.charCodeAt(t);return new DataView(n.buffer)}(n);e.assignView(this,i,t,!1,r)}})}}),rt({defineDataView(t){const e=this;return Q({get(){this[U]?.();return this[w]},set(n,r){if("DataView"!==n?.[Symbol.toStringTag])throw new yt("DataView",n);e.assignView(this,n,t,!0,r)}})}}),rt({defineMemberInt(t){let e=this.getAccessor;return this.runtimeSafety&&(e=this.addRuntimeCheck(e)),e=this.addIntConversion(e),this.defineMemberUsing(t,e)}}),rt({defineMemberObject:t=>Vt(t.slot,{get:t.structure.flags&r?At:xt,set:t.flags&b?dt:jt})}),rt({...{defineMemberUsing(t,e){const{littleEndian:n}=this,{bitOffset:r,byteSize:i}=t,s=e.call(this,"get",t),o=e.call(this,"set",t);if(void 0!==r){const t=r>>3;return{get:function(){try{return s.call(this[w],t,n)}catch(e){if(e instanceof TypeError&&this[U]?.())return s.call(this[w],t,n);throw e}},set:function(e){try{return o.call(this[w],t,e,n)}catch(r){if(r instanceof TypeError&&this[U]?.())return o.call(this[w],t,e,n);throw r}}}}return{get:function(e){try{return s.call(this[w],e*i,n)}catch(r){if(r instanceof TypeError&&this[U]?.())return s.call(this[w],e*i,n);throw pt(t,e,r)}},set:function(e,r){try{return o.call(this[w],e*i,r,n)}catch(s){if(s instanceof TypeError&&this[U]?.())return o.call(this[w],e*i,r,n);throw pt(t,e,s)}}}}}}),rt({defineValueOf:()=>({value(){return Tt(this,!1)}})});const It=BigInt(Number.MAX_SAFE_INTEGER),Mt=BigInt(Number.MIN_SAFE_INTEGER);function Tt(t,n){const r=n?t=>{try{return t()}catch(t){return t}}:t=>t(),i=new Map,s=function(t){const o="function"==typeof t?e.Struct:t?.constructor?.[z];if(void 0===o){if(n){if("bigint"==typeof t&&Mt<=t&&t<=It)return Number(t);if(t instanceof Error)return{error:t.message}}return t}let c=i.get(t);if(void 0===c){let n;switch(o){case e.Struct:n=t[A](),c=t.constructor[E]&l?[]:{};break;case e.Union:n=t[A](),c={};break;case e.Array:case e.Vector:case e.Slice:n=t[A](),c=[];break;case e.Pointer:try{c=t["*"]}catch(t){c=Symbol.for("inaccessible")}break;case e.Enum:c=r((()=>String(t)));break;case e.Opaque:c={};break;default:c=r((()=>t.$))}if(c=s(c),i.set(t,c),n)for(const[t,e]of n)c[t]=s(e)}return c};return s(t)}rt({defineToJSON:()=>({value(){return Tt(this,!0)}})}),rt({defineMemberType(t,e){const{slot:n}=t;return Vt(n,{get(t){const e=this[v][t];return e?.constructor},set:dt})}}),rt({defineStructure(t){const{type:e,byteSize:r}=t,i=this[`define${n[e]}`],s=[],o={},c={dataView:this.defineDataView(t),base64:this.defineBase64(t),toJSON:this.defineToJSON(),valueOf:this.defineValueOf(),[C]:{value:null},[F]:H(o),[x]:H(s),[P]:this.defineCopier(r),[U]:this.defineRestorer()},a=t.constructor=i.call(this,t,c);for(const[t,e]of Object.entries(c)){const n=e?.set;n&&!o[t]&&(o[t]=n,s.push(t))}return X(a.prototype,c),a},finalizeStructure(t){const{name:r,type:i,constructor:s,align:o,byteSize:c,flags:a,signature:l,static:{members:u,template:f}}=t,h=[],y={name:H(r),toJSON:this.defineToJSON(),valueOf:this.defineValueOf(),[R]:H(l),[N]:H(this),[T]:H(o),[I]:H(c),[z]:H(i),[E]:H(a),[O]:H(h),[B]:H(this.getTypedArray(t)),[Symbol.iterator]:this.defineStructIterator(),[A]:this.defineStructEntries(),[O]:H(h)},b={[Symbol.toStringTag]:H(r)};for(const t of u){const{name:n,slot:r}=t;if(t.structure.type===e.Function){const e=f[v][r];y[n]=H(e),e.name||W(e,"name",H(n));const[i,s]=/^(get|set)\s+([\s\S]+)/.exec(n)?.slice(1)??[],o="get"===i?0:1;if(i&&e.length===o){(y[s]??={})[i]=e}if(t.flags&g){const t=function(...t){try{return e(this,...t)}catch(t){throw"argCount"in t&&(t.argIndex--,t.argCount--),t}};if(X(t,{name:H(n),length:H(e.length-1)}),b[n]=H(t),i&&t.length===o){(b[s]??={})[i]=t}}}else y[n]=this.defineMember(t),h.push(n)}y[v]=h.length>0&&H(f[v]);const p=this[`finalize${n[i]}`];!1!==p?.call(this,t,y,b)&&(X(s.prototype,b),X(s,y))},createConstructor(t,n={}){const{type:r,byteSize:i,align:s,flags:c,instance:{members:a,template:l}}=t,{onCastError:u}=n;let f;if(l?.[v]){const t=a.filter((t=>t.flags&b));t.length>0&&(f=t.map((t=>t.slot)))}const h=new et,y=this,g=function(n,a={}){const{allocator:b}=a,p=this instanceof g;let d,m;if(p){if(0===arguments.length)throw new ot(t);if(d=this,c&o&&(d[v]={}),_ in d)d[J](n,b),m=d[w];else{const t=r!==e.Pointer?b:null;d[w]=m=y.allocateMemory(i,s,t)}}else{if(Z in g&&(d=g[Z].call(this,n,a),!1!==d))return d;if(m=y.extractView(t,n,u),d=h.find(m))return d;d=Object.create(g.prototype),_ in d?y.assignView(d,m,t,!1,!1):d[w]=m,c&o&&(d[v]={})}if(f)for(const t of f)d[v][t]=l[v][t];return d[G]?.(),p&&(_ in d||d[J](n,b)),q in d&&(d=d[q]()),h.save(m,d)};return W(g,j,H(h)),l?.[w]&&W(l,U,this.defineRestorer()),g},createApplier(t){const{instance:{template:e}}=t;return function(n,r){const i=Object.keys(n),s=this[x],o=this[F];for(const e of i)if(!(e in o))throw new ht(t,e);let c=0,a=0,l=0,u=0;for(const t of s){const e=o[t];e.special?t in n&&u++:(c++,t in n?a++:e.required&&l++)}if(0!==l&&0===u){const e=s.filter((t=>o[t].required&&!(t in n)));throw new ft(t,e)}if(u+a>i.length)for(const t of s)t in n&&(i.includes(t)||i.push(t));a<c&&0===u&&e&&e[w]&&this[P](e);for(const t of i){o[t].call(this,n[t],r)}return i.length}},getTypedArray(t){const{type:n,instance:r}=t;if(void 0!==n&&r){const[t]=r.members;switch(n){case e.Enum:case e.ErrorSet:case e.Primitive:{const{byteSize:e,type:n}=t;return globalThis[(e>4&&n!==f.Float?"Big":"")+(n===f.Float?"Float":n===f.Int?"Int":"Uint")+8*e+"Array"]}case e.Array:case e.Slice:case e.Vector:return this.getTypedArray(t.structure)}}}}),rt({definePrimitive(t,e){const{instance:{members:[n]}}=t,r=this.createApplier(t),{get:i,set:s}=this.defineMember(n),o=function(e){if(K(e,c))this[P](e);else if(e&&"object"==typeof e){if(0===r.call(this,e)){const r=function({type:t,bitSize:e}){switch(t){case f.Bool:return"boolean";case f.Int:case f.Uint:if(e>32)return"bigint";case f.Float:return"number"}}(n);throw new lt(t,r,e)}}else void 0!==e&&s.call(this,e)},c=this.createConstructor(t);return e.$={get:i,set:o},e[J]=H(o),e[Symbol.toPrimitive]=H(i),c},finalizePrimitive(t,e){const{instance:{members:[n]}}=t;e[M]=H(n.bitSize),e[D]=H(n.type)}}),rt({defineStruct(t,e){const{flags:n,length:r,instance:{members:o}}=t,c=o.find((t=>t.flags&p)),f=c&&this.defineMember(c),h=this.createApplier(t),b=function(e,r){if(K(e,g))this[P](e),n&s&&this[k]("copy",0,e);else if(e&&"object"==typeof e)h.call(this,e,r);else if("number"!=typeof e&&"bigint"!=typeof e||!f){if(void 0!==e)throw new lt(t,"object",e)}else f.set.call(this,e)},g=this.createConstructor(t),d=e[F].value,m=e[x].value,S=[];for(const t of o.filter((t=>!!t.name))){const{name:n,flags:r}=t,{set:i}=e[n]=this.defineMember(t);i&&(r&y&&(i.required=!0),d[n]=i,m.push(n)),S.push(n)}return e.$={get:Y,set:b},e.length=H(r),e.entries=n&l&&this.defineVectorEntries(),e[Symbol.toPrimitive]=f&&{value(t){return"string"===t?Object.prototype.toString.call(this):f.get.call(this)}},e[Symbol.iterator]=n&a?this.defineZigIterator():n&l?this.defineVectorIterator():this.defineStructIterator(),e[J]=H(b),e[L]=n&i&&this.defineVivificatorStruct(t),e[k]=n&s&&this.defineVisitorStruct(o),e[A]=n&l?this.defineVectorEntries():this.defineStructEntries(),e[O]=H(S),n&u&&(e.alloc=this.defineAlloc(),e.free=this.defineFree(),e.dupe=this.defineDupe()),g}}),rt({variables:[],getSpecialExports(){const t=t=>{if(void 0===t)throw new Error("Not a Zig type");return t};return{init:(...t)=>this.initialize?.(...t),abandon:()=>this.abandonModule?.(),released:()=>this.released,connect:t=>this.consoleObject=t,sizeOf:e=>t(e?.[I]),alignOf:e=>t(e?.[T]),typeOf:e=>n[t(e?.[z])]?.toLowerCase()}},recreateStructures(t,e){Object.assign(this,e);const n=(t,e)=>{for(const[n,r]of Object.entries(e))t[n]=i(r);return t},r=t=>t.length?t.buffer:new ArrayBuffer(0),i=t=>{const{memory:e,structure:i,actual:s}=t;if(e){if(s)return s;{const{array:s,offset:o,length:c}=e,a=this.obtainView(r(s),o,c),{handle:l,const:u}=t,f=i?.constructor,h=t.actual=f.call(N,a);return u&&this.makeReadOnly(h),t.slots&&n(h[v],t.slots),l&&this.variables.push({handle:l,object:h}),h}}return i};this.resetGlobalErrorSet?.();const s=new Map;for(const e of t){for(const t of[e.instance,e.static])if(t.template){const{slots:e,memory:n,handle:i}=t.template,o=t.template={};if(n){const{array:t,offset:e,length:s}=n;o[w]=this.obtainView(r(t),e,s),i&&this.variables.push({handle:i,object:o})}if(e){const t=o[v]={};s.set(t,e)}}this.defineStructure(e)}for(const[t,e]of s)n(t,e);for(const e of t)this.finalizeStructure(e)}});const Ct={constructor:null,type:0,flags:0,signature:void 0,name:void 0,byteSize:0,align:0,instance:{members:[],template:null},static:{members:[],template:null}},Nt={type:0,flags:0},Dt={},Ft={},Bt={},Rt={},Ut={},Lt={},kt={},Pt={},_t=t=>new Uint8Array(t),Jt=_t(8),Gt=_t(0),qt=Object.assign;qt(Ut,{memory:{array:Jt}}),qt(Lt,{slots:{0:kt}}),qt(kt,{structure:Dt,memory:{array:Gt},slots:{0:Pt}}),qt(Pt,{structure:Bt}),qt(Dt,{...Ct,flags:9,signature:0x406b8a99e2cc9d59n,name:"type",align:1,instance:{members:[{...Nt,type:6,bitOffset:0,bitSize:0,byteSize:0,slot:0,structure:Dt}]}}),qt(Ft,{...Ct,flags:1,signature:0xbdb875b052db9ef8n,name:"i32",byteSize:4,align:4,instance:{members:[{...Nt,type:2,bitOffset:0,bitSize:32,byteSize:4,structure:Ft}]}}),qt(Bt,{...Ct,type:2,flags:16,signature:0x3332ef94e8102bf2n,name:"Struct",byteSize:8,align:4,instance:{members:[{...Nt,type:2,bitOffset:0,bitSize:32,byteSize:4,slot:0,name:"number1",structure:Ft},{...Nt,type:2,bitOffset:32,bitSize:32,byteSize:4,slot:1,name:"number2",structure:Ft}],template:Ut}}),qt(Rt,{...Ct,type:2,signature:0x239ab4f327f6ac1bn,name:"def",align:1,static:{members:[{...Nt,type:5,flags:2,slot:0,name:"Struct",structure:Dt}],template:Lt}});const Zt=[Dt,Ft,Bt,Rt],Wt=Rt,Xt=new(it());Xt.recreateStructures(Zt,{runtimeSafety:!1,littleEndian:!0,libc:!1});const{constructor:Ht}=Wt,Kt=Xt.getSpecialExports(),{Struct:Qt}=Ht;t.Struct=Qt,t.__zigar=Kt,t.default=Ht,Object.defineProperty(t,"__esModule",{value:!0})}));
