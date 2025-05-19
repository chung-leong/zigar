(function(t) {
    "use strict";
    const e = {
        Primitive: 0,
        Array: 1,
        Struct: 2,
        Union: 3,
        ErrorUnion: 4,
        ErrorSet: 5,
        Enum: 6,
        Optional: 7,
        Pointer: 8,
        Slice: 9,
        Vector: 10,
        Opaque: 11,
        ArgStruct: 12,
        VariadicStruct: 13,
        Function: 14
    }, n = Object.keys(e), r = 1, i = 2, s = 4, o = 8, c = 16, a = 16, l = 32, u = 64, f = 128, h = 64, d = 128, g = 256, p = 512, b = 1024, y = 2048, m = 8192, w = 16384, v = 16, S = 32, A = 64, I = 512, M = 16, x = 16, V = 16, E = 32, O = 64, C = 128, $ = 256, T = 16, U = 32, z = 64, B = 128, j = 256, k = 16, F = 16, N = 16, P = 32, L = 16, D = 32, R = 64, Z = {
        Void: 0,
        Bool: 1,
        Int: 2,
        Uint: 3,
        Float: 4,
        Object: 5,
        Type: 6,
        Literal: 7,
        Null: 8,
        Undefined: 9,
        Unsupported: 10
    }, G = Object.keys(Z), q = 1, J = 2, _ = 4, W = 16, Y = 64, H = 128, X = 0, K = 1, Q = 2, tt = 1, et = 2, nt = 4, rt = {
        IsInactive: 1,
        IsImmutable: 2,
        IgnoreUncreated: 4,
        IgnoreInactive: 8,
        IgnoreArguments: 16,
        IgnoreRetval: 32
    }, it = globalThis[Symbol.for("ZIGAR")] ||= {};
    function st(t) {
        return it[t] ||= Symbol(t);
    }
    function ot(t) {
        return st(t);
    }
    const ct = ot("memory"), at = ot("slots"), lt = ot("parent"), ut = ot("zig"), ft = ot("name"), ht = ot("type"), dt = ot("flags"), gt = ot("class"), pt = ot("tag"), bt = ot("props"), yt = ot("pointer"), mt = ot("sentinel"), wt = ot("array"), vt = ot("target"), St = ot("entries"), At = ot("max length"), It = ot("keys"), Mt = ot("address"), xt = ot("length"), Vt = ot("last address"), Et = ot("last length"), Ot = ot("proxy"), Ct = ot("cache"), $t = ot("size"), Tt = ot("bit size"), Ut = ot("align"), zt = ot("const target"), Bt = ot("environment"), jt = ot("attributes"), kt = ot("primitive"), Ft = ot("getters"), Nt = ot("setters"), Pt = ot("typed array"), Lt = ot("throwing"), Dt = ot("promise"), Rt = ot("generator"), Zt = ot("allocator"), Gt = ot("fallback"), qt = ot("signature"), Jt = ot("string retval"), _t = ot("update"), Wt = ot("reset"), Yt = ot("vivificate"), Ht = ot("visit"), Xt = ot("copy"), Kt = ot("shape"), Qt = ot("initialize"), te = ot("restrict"), ee = ot("finalize"), ne = ot("cast"), re = ot("return"), ie = ot("yield");
    function se(t, e, n) {
        if (n) {
            const {set: r, get: i, value: s, enumerable: o, configurable: c = !0, writable: a = !0} = n;
            Object.defineProperty(t, e, i || r ? {
                get: i,
                set: r,
                configurable: c,
                enumerable: o
            } : {
                value: s,
                configurable: c,
                enumerable: o,
                writable: a
            });
        }
        return t;
    }
    function oe(t, e) {
        for (const [n, r] of Object.entries(e)) se(t, n, r);
        for (const n of Object.getOwnPropertySymbols(e)) {
            se(t, n, e[n]);
        }
        return t;
    }
    function ce(t) {
        return void 0 !== t ? {
            value: t
        } : void 0;
    }
    function ae(t) {
        return "return" === t?.error ? t => {
            try {
                return t();
            } catch (t) {
                return t;
            }
        } : t => t();
    }
    function le({type: t, bitSize: e}) {
        switch (t) {
          case Z.Bool:
            return "boolean";

          case Z.Int:
          case Z.Uint:
            if (e > 32) return "bigint";

          case Z.Float:
            return "number";
        }
    }
    function ue(t, e = "utf-8") {
        const n = he[e] ||= new TextDecoder(e);
        let r;
        if (Array.isArray(t)) if (1 === t.length) r = t[0]; else {
            let e = 0;
            for (const n of t) e += n.length;
            const {constructor: n} = t[0];
            r = new n(e);
            let i = 0;
            for (const e of t) r.set(e, i), i += e.length;
        } else r = t;
        return "SharedArrayBuffer" === r.buffer[Symbol.toStringTag] && (r = new r.constructor(r)), 
        n.decode(r);
    }
    function fe(t, e = "utf-8") {
        if ("utf-16" === e) {
            const {length: e} = t, n = new Uint16Array(e);
            for (let r = 0; r < e; r++) n[r] = t.charCodeAt(r);
            return n;
        }
        return (de[e] ||= new TextEncoder).encode(t);
    }
    const he = {}, de = {};
    function ge(t, e, n) {
        let r = 0, i = t.length;
        if (0 === i) return 0;
        for (;r < i; ) {
            const s = Math.floor((r + i) / 2);
            n(t[s]) <= e ? r = s + 1 : i = s;
        }
        return i;
    }
    const pe = function(t, e) {
        return !!e && !!(t & e - 1);
    }, be = function(t, e) {
        return t + (e - 1) & ~(e - 1);
    }, ye = 4294967295, me = function(t) {
        return Number(t);
    }, we = function(t, e) {
        return t + e;
    };
    function ve(t) {
        if ("number" == typeof t.length) return t;
        const e = t[Symbol.iterator](), n = e.next(), r = n.value?.length;
        if ("number" == typeof r && "length" === Object.keys(n.value).join()) return Object.assign(function*() {
            let t;
            for (;!(t = e.next()).done; ) yield t.value;
        }(), {
            length: r
        });
        {
            const t = [];
            let r = n;
            for (;!r.done; ) t.push(r.value), r = e.next();
            return t;
        }
    }
    function Se(t, e) {
        const {constructor: n} = t;
        return n === e ? 1 : n.child === e ? t.length : void 0;
    }
    function Ae(t, e) {
        const n = [], r = new Map, i = t => {
            if (t && !r.get(t) && (r.set(t, !0), n.push(t), t[e])) for (const n of Object.values(t[e])) i(n);
        };
        for (const e of t) i(e.instance.template), i(e.static.template);
        return n;
    }
    function Ie(t, e) {
        return t === e || t?.[qt] === e[qt] && t?.[Bt] !== e?.[Bt];
    }
    function Me(t, e) {
        return t instanceof e || Ie(t?.constructor, e);
    }
    function xe({get: t, set: e}) {
        return t.special = e.special = !0, {
            get: t,
            set: e
        };
    }
    function Ve() {
        return this;
    }
    function Ee() {
        return this[Ot];
    }
    function Oe() {
        return String(this);
    }
    function Ce() {}
    class ObjectCache {
        map=new WeakMap;
        find(t) {
            return this.map.get(t);
        }
        save(t, e) {
            return this.map.set(t, e), e;
        }
    }
    const $e = {
        name: "",
        mixins: [],
        constructor: null
    };
    function Te(t) {
        return $e.constructor || $e.mixins.push(t), t;
    }
    function Ue() {
        return $e.constructor || ($e.constructor = function(t, e) {
            const n = [], r = function() {
                for (const t of n) t.call(this);
            }, {prototype: i} = r;
            se(r, "name", ce(t));
            for (const t of e) for (let [e, r] of Object.entries(t)) if ("init" === e) n.push(r); else {
                if ("function" == typeof r) ; else {
                    let t = i[e];
                    if (void 0 !== t) if (t?.constructor === Object) r = Object.assign({
                        ...t
                    }, r); else if (t !== r) throw new Error(`Duplicate property: ${e}`);
                }
                se(i, e, ce(r));
            }
            return r;
        }($e.name, $e.mixins), $e.name = "", $e.mixins = []), $e.constructor;
    }
    function ze(t, e, n) {
        if (t + e <= 8) {
            const r = 2 ** e - 1;
            if (n) return function(e, n, i) {
                const s = n.getUint8(i) >> t & r;
                e.setUint8(0, s);
            };
            {
                const e = 255 ^ r << t;
                return function(n, i, s) {
                    const o = i.getUint8(0), c = n.getUint8(s) & e | (o & r) << t;
                    n.setUint8(s, c);
                };
            }
        }
        {
            const r = 8 - t, i = 2 ** r - 1;
            if (n) {
                const n = 2 ** (e % 8) - 1;
                return function(s, o, c) {
                    let a, l = c, u = 0, f = o.getUint8(l++), h = f >> t & i, d = r, g = e;
                    do {
                        g > d && (f = o.getUint8(l++), h |= f << d), a = g >= 8 ? 255 & h : h & n, s.setUint8(u++, a), 
                        h >>= 8, g -= 8;
                    } while (g > 0);
                };
            }
            {
                const n = 2 ** ((e - r) % 8) - 1, s = 255 ^ i << t, o = 255 ^ n;
                return function(r, i, c) {
                    let a, l, u = 0, f = c, h = r.getUint8(f), d = h & s, g = t, p = e + g;
                    do {
                        p > g && (a = i.getUint8(u++), d |= a << g, g += 8), p >= 8 ? l = 255 & d : (h = r.getUint8(f), 
                        l = h & o | d & n), r.setUint8(f++, l), d >>= 8, g -= 8, p -= 8;
                    } while (p > 0);
                };
            }
        }
    }
    Te({
        init() {
            this.accessorCache = new Map;
        },
        getAccessor(t, e) {
            const {type: n, bitSize: r, bitOffset: i, byteSize: s} = e, o = [], c = void 0 === s && (7 & r || 7 & i);
            c && o.push("Unaligned");
            let a = G[n];
            r > 32 && (n === Z.Int || n === Z.Uint) && (a = r <= 64 ? `Big${a}` : `Jumbo${a}`), 
            o.push(a, `${n === Z.Bool && s ? 8 * s : r}`), c && o.push(`@${i}`);
            const l = t + o.join("");
            let u = DataView.prototype[l];
            if (u && this.usingBufferFallback()) {
                const e = this, i = u, s = function(t) {
                    const {buffer: e, byteOffset: n, byteLength: i} = this, s = e[Gt];
                    if (s) {
                        if (t < 0 || t + r / 8 > i) throw new RangeError("Offset is outside the bounds of the DataView");
                        return s + me(n + t);
                    }
                };
                u = "get" === t ? function(t, o) {
                    const c = s.call(this, t);
                    return void 0 !== c ? e.getNumericValue(n, r, c) : i.call(this, t, o);
                } : function(t, o, c) {
                    const a = s.call(this, t);
                    return void 0 !== a ? e.setNumericValue(n, r, a, o) : i.call(this, t, o, c);
                };
            }
            if (u) return u;
            if (u = this.accessorCache.get(l), u) return u;
            for (;o.length > 0; ) {
                const n = `getAccessor${o.join("")}`;
                if (u = this[n]?.(t, e)) break;
                o.pop();
            }
            if (!u) throw new Error(`No accessor available: ${l}`);
            return se(u, "name", ce(l)), this.accessorCache.set(l, u), u;
        },
        imports: {
            getNumericValue: null,
            setNumericValue: null
        }
    }), Te({
        getAccessorBigInt(t, e) {
            const {bitSize: n} = e, r = 2n ** BigInt(n - 1), i = r - 1n;
            return "get" === t ? function(t, e) {
                const n = this.getBigUint64(t, e);
                return (n & i) - (n & r);
            } : function(t, e, n) {
                const s = e < 0 ? r | e & i : e & i;
                this.setBigUint64(t, s, n);
            };
        }
    }), Te({
        getAccessorBigUint(t, e) {
            const {bitSize: n} = e, r = 2n ** BigInt(n) - 1n;
            return "get" === t ? function(t, e) {
                return this.getBigInt64(t, e) & r;
            } : function(t, e, n) {
                const i = e & r;
                this.setBigUint64(t, i, n);
            };
        }
    }), Te({
        getAccessorBool(t, e) {
            const {byteSize: n} = e, r = 8 * n, i = this.getAccessor(t, {
                type: Z.Uint,
                bitSize: r,
                byteSize: n
            });
            if ("get" === t) return function(t, e) {
                return !!i.call(this, t, e);
            };
            {
                const t = r <= 32 ? 0 : 0n, e = r <= 32 ? 1 : 1n;
                return function(n, r, s) {
                    i.call(this, n, r ? e : t, s);
                };
            }
        }
    }), Te({
        getAccessorFloat128(t, e) {
            const {byteSize: n} = e, r = new DataView(new ArrayBuffer(8)), i = function(t, e) {
                return BigInt(this.getUint32(t + (e ? 0 : n - 4), e)) | BigInt(this.getUint32(t + (e ? 4 : n - 8), e)) << 32n | BigInt(this.getUint32(t + (e ? 8 : n - 12), e)) << 64n | BigInt(this.getUint32(t + (e ? 12 : n - 16), e)) << 96n;
            }, s = function(t, e, r) {
                const i = 0xffffffffn & e, s = e >> 32n & 0xffffffffn, o = e >> 64n & 0xffffffffn, c = e >> 96n & 0xffffffffn;
                this.setUint32(t + (r ? 0 : n - 4), Number(i), r), this.setUint32(t + (r ? 4 : n - 8), Number(s), r), 
                this.setUint32(t + (r ? 8 : n - 12), Number(o), r), this.setUint32(t + (r ? 12 : n - 16), Number(c), r);
            };
            return "get" === t ? function(t, e) {
                const n = i.call(this, t, e), s = n >> 127n, o = (0x7fff0000000000000000000000000000n & n) >> 112n, c = 0x0000ffffffffffffffffffffffffffffn & n;
                if (0n === o) {
                    const t = c ? Number.MIN_VALUE : 0;
                    return s ? -t : t;
                }
                if (0x7fffn === o) return c ? NaN : s ? -1 / 0 : 1 / 0;
                const a = o - 16383n + 1023n;
                if (a >= 2047n) {
                    const t = 1 / 0;
                    return s ? -t : t;
                }
                const l = s << 63n | a << 52n | (c >> 60n) + BigInt((c & 2n ** 60n - 1n) >= 2n ** 59n);
                return r.setBigUint64(0, l, e), r.getFloat64(0, e);
            } : function(t, e, n) {
                r.setFloat64(0, e, n);
                const i = r.getBigUint64(0, n), o = i >> 63n, c = (0x7ff0000000000000n & i) >> 52n, a = 0x000fffffffffffffn & i;
                let l;
                l = 0n === c ? o << 127n | a << 60n : 0x07ffn === c ? o << 127n | 0x7fffn << 112n | (a ? 1n : 0n) : o << 127n | c - 1023n + 16383n << 112n | a << 60n, 
                s.call(this, t, l, n);
            };
        }
    }), Te({
        getAccessorFloat16(t, e) {
            const n = new DataView(new ArrayBuffer(4)), r = DataView.prototype.setUint16, i = DataView.prototype.getUint16;
            return "get" === t ? function(t, e) {
                const r = i.call(this, t, e), s = r >>> 15, o = (31744 & r) >> 10, c = 1023 & r;
                if (0 === o) return s ? -0 : 0;
                if (31 === o) return c ? NaN : s ? -1 / 0 : 1 / 0;
                const a = s << 31 | o - 15 + 127 << 23 | c << 13;
                return n.setUint32(0, a, e), n.getFloat32(0, e);
            } : function(t, e, i) {
                n.setFloat32(0, e, i);
                const s = n.getUint32(0, i), o = s >>> 31, c = (2139095040 & s) >> 23, a = 8388607 & s, l = c - 127 + 15;
                let u;
                u = 0 === c ? o << 15 : 255 === c ? o << 15 | 31744 | (a ? 1 : 0) : l >= 31 ? o << 15 | 31744 : o << 15 | l << 10 | a >> 13, 
                r.call(this, t, u, i);
            };
        }
    }), Te({
        getAccessorFloat80(t, e) {
            const {byteSize: n} = e, r = new DataView(new ArrayBuffer(8)), i = function(t, e) {
                return BigInt(this.getUint32(t + (e ? 0 : n - 4), e)) | BigInt(this.getUint32(t + (e ? 4 : n - 8), e)) << 32n | BigInt(this.getUint32(t + (e ? 8 : n - 12), e)) << 64n;
            }, s = function(t, e, r) {
                const i = 0xffffffffn & e, s = e >> 32n & 0xffffffffn, o = e >> 64n & 0xffffffffn;
                this.setUint32(t + (r ? 0 : n - 4), Number(i), r), this.setUint32(t + (r ? 4 : n - 8), Number(s), r), 
                this.setUint32(t + (r ? 8 : n - 12), Number(o), r);
            };
            return "get" === t ? function(t, e) {
                const n = i.call(this, t, e), s = n >> 79n, o = (0x7fff0000000000000000n & n) >> 64n, c = 0x00007fffffffffffffffn & n;
                if (0n === o) {
                    const t = c ? Number.MIN_VALUE : 0;
                    return s ? -t : t;
                }
                if (0x7fffn === o) return c ? NaN : s ? -1 / 0 : 1 / 0;
                const a = o - 16383n + 1023n;
                if (a >= 2047n) {
                    const t = 1 / 0;
                    return s ? -t : t;
                }
                const l = s << 63n | a << 52n | (c >> 11n) + BigInt((c & 2n ** 11n - 1n) >= 2n ** 10n);
                return r.setBigUint64(0, l, e), r.getFloat64(0, e);
            } : function(t, e, n) {
                r.setFloat64(0, e, n);
                const i = r.getBigUint64(0, n), o = i >> 63n, c = (0x7ff0000000000000n & i) >> 52n, a = 0x000fffffffffffffn & i;
                let l;
                l = 0n === c ? o << 79n | a << 11n : 0x07ffn === c ? o << 79n | 0x7fffn << 64n | (a ? 0x00002000000000000000n : 0n) | 0x00008000000000000000n : o << 79n | c - 1023n + 16383n << 64n | a << 11n | 0x00008000000000000000n, 
                s.call(this, t, l, n);
            };
        }
    }), Te({
        getAccessorInt(t, e) {
            const {bitSize: n, byteSize: r} = e;
            if (r) {
                const e = this.getAccessor(t, {
                    type: Z.Uint,
                    bitSize: 8 * r,
                    byteSize: r
                }), i = 2 ** (n - 1), s = i - 1;
                return "get" === t ? function(t, n) {
                    const r = e.call(this, t, n);
                    return (r & s) - (r & i);
                } : function(t, n, r) {
                    const o = n < 0 ? i | n & s : n & s;
                    e.call(this, t, o, r);
                };
            }
        }
    }), Te({
        getAccessorJumboInt(t, e) {
            const {bitSize: n} = e, r = this.getJumboAccessor(t, n), i = 2n ** BigInt(n - 1), s = i - 1n;
            return "get" === t ? function(t, e) {
                const n = r.call(this, t, e);
                return (n & s) - (n & i);
            } : function(t, e, n) {
                const o = e < 0 ? i | e & s : e & s;
                r.call(this, t, o, n);
            };
        }
    }), Te({
        getAccessorJumboUint(t, e) {
            const {bitSize: n} = e, r = this.getJumboAccessor(t, n), i = 2n ** BigInt(n) - 1n;
            return "get" === t ? function(t, e) {
                return r.call(this, t, e) & i;
            } : function(t, e, n) {
                const s = e & i;
                r.call(this, t, s, n);
            };
        }
    }), Te({
        getJumboAccessor(t, e) {
            const n = e + 63 >> 6;
            return "get" === t ? function(t, e) {
                let r = 0n;
                if (e) for (let i = 0, s = t + 8 * (n - 1); i < n; i++, s -= 8) {
                    r = r << 64n | this.getBigUint64(s, e);
                } else for (let i = 0, s = t; i < n; i++, s += 8) {
                    r = r << 64n | this.getBigUint64(s, e);
                }
                return r;
            } : function(t, e, r) {
                let i = e;
                const s = 0xffffffffffffffffn;
                if (r) for (let e = 0, o = t; e < n; e++, o += 8) {
                    const t = i & s;
                    this.setBigUint64(o, t, r), i >>= 64n;
                } else for (let e = 0, o = t + 8 * (n - 1); e < n; e++, o -= 8) {
                    const t = i & s;
                    this.setBigUint64(o, t, r), i >>= 64n;
                }
            };
        }
    }), Te({
        getAccessorUint(t, e) {
            const {bitSize: n, byteSize: r} = e;
            if (r) {
                const i = this.getAccessor(t, {
                    ...e,
                    bitSize: 8 * r
                }), s = 2 ** n - 1;
                return "get" === t ? function(t, e) {
                    return i.call(this, t, e) & s;
                } : function(t, e, n) {
                    const r = e & s;
                    i.call(this, t, r, n);
                };
            }
        }
    }), Te({
        getAccessorUnalignedBool1(t, e) {
            const {bitOffset: n} = e, r = 1 << (7 & n);
            return "get" === t ? function(t) {
                return !!(this.getInt8(t) & r);
            } : function(t, e) {
                const n = this.getInt8(t), i = e ? n | r : n & ~r;
                this.setInt8(t, i);
            };
        }
    }), Te({
        getAccessorUnalignedInt(t, e) {
            const {bitSize: n, bitOffset: r} = e, i = 7 & r;
            if (i + n <= 8) {
                const e = 2 ** (n - 1), r = e - 1;
                if ("get" === t) return function(t) {
                    const n = this.getUint8(t) >>> i;
                    return (n & r) - (n & e);
                };
                {
                    const t = 255 ^ (r | e) << i;
                    return function(n, s) {
                        let o = this.getUint8(n);
                        o = o & t | (s < 0 ? e | s & r : s & r) << i, this.setUint8(n, o);
                    };
                }
            }
        }
    }), Te({
        getAccessorUnalignedUint(t, e) {
            const {bitSize: n, bitOffset: r} = e, i = 7 & r;
            if (i + n <= 8) {
                const e = 2 ** n - 1;
                if ("get" === t) return function(t) {
                    return this.getUint8(t) >>> i & e;
                };
                {
                    const t = 255 ^ e << i;
                    return function(n, r) {
                        const s = this.getUint8(n) & t | (r & e) << i;
                        this.setUint8(n, s);
                    };
                }
            }
        }
    }), Te({
        getAccessorUnaligned(t, e) {
            const {bitSize: n, bitOffset: r} = e, i = 7 & r, s = [ 1, 2, 4, 8 ].find((t => 8 * t >= n)) ?? 64 * Math.ceil(n / 64), o = new DataView(new ArrayBuffer(s));
            if ("get" === t) {
                const t = this.getAccessor("get", {
                    ...e,
                    byteSize: s
                }), r = ze(i, n, !0);
                return function(e, n) {
                    return r(o, this, e), t.call(o, 0, n);
                };
            }
            {
                const t = this.getAccessor("set", {
                    ...e,
                    byteSize: s
                }), r = ze(i, n, !1);
                return function(e, n, i) {
                    t.call(o, 0, n, i), r(this, o, e);
                };
            }
        }
    }), Te({
        createSignal(t, e) {
            const {constructor: {child: n}} = t.instance.members[0].structure, r = new Int32Array([ e?.aborted ? 1 : 0 ]), i = n(r);
            return e && e.addEventListener("abort", (() => {
                Atomics.store(r, 0, 1);
            }), {
                once: !0
            }), {
                ptr: i
            };
        },
        createInboundSignal(t) {
            const e = new AbortController;
            if (t.ptr["*"]) e.abort(); else {
                const n = setInterval((() => {
                    t.ptr["*"] && (e.abort(), clearInterval(n));
                }), 50);
            }
            return e.signal;
        }
    });
    class InvalidIntConversion extends SyntaxError {
        constructor(t) {
            super(`Cannot convert ${t} to an Int`);
        }
    }
    class Unsupported extends TypeError {
        constructor() {
            super("Unsupported");
        }
    }
    class NoInitializer extends TypeError {
        constructor(t) {
            const {name: e} = t;
            super(`An initializer must be provided to the constructor of ${e}, even when the intended value is undefined`);
        }
    }
    class BufferSizeMismatch extends TypeError {
        constructor(t, n, r = null) {
            const {name: i, type: s, byteSize: o} = t, c = n.byteLength, a = 1 !== o ? "s" : "";
            let l;
            if (s !== e.Slice || r) {
                l = `${i} has ${s === e.Slice ? r.length * o : o} byte${a}, received ${c}`;
            } else l = `${i} has elements that are ${o} byte${a} in length, received ${c}`;
            super(l);
        }
    }
    class BufferExpected extends TypeError {
        constructor(t) {
            const {type: n, byteSize: r, typedArray: i} = t, s = 1 !== r ? "s" : "", o = [ "ArrayBuffer", "DataView" ].map(Le);
            let c;
            i && o.push(Le(i.name)), c = n === e.Slice ? `Expecting ${Re(o)} that can accommodate items ${r} byte${s} in length` : `Expecting ${Re(o)} that is ${r} byte${s} in length`, 
            super(c);
        }
    }
    class EnumExpected extends TypeError {
        constructor(t, e) {
            const {name: n} = t;
            let r;
            r = "number" == typeof e || "bigint" == typeof e ? `Value given does not correspond to an item of enum ${n}: ${e}` : `Enum item of the type ${n} expected, received ${e}`, 
            super(r);
        }
    }
    class ErrorExpected extends TypeError {
        constructor(t, e) {
            const {name: n} = t, r = typeof e;
            let i;
            "string" === r || "number" === r || Ne(e) ? (Ne(e) && (e = `{ error: ${JSON.stringify(e.error)} }`), 
            i = `Error ${r} does not corresponds to any error in error set ${n}: ${e}`) : i = `Error of the type ${n} expected, received ${e}`, 
            super(i);
        }
    }
    class NotInErrorSet extends TypeError {
        constructor(t) {
            const {name: e} = t;
            super(`Error given is not a part of error set ${e}`);
        }
    }
    class MultipleUnionInitializers extends TypeError {
        constructor(t) {
            const {name: e} = t;
            super(`Only one property of ${e} can be given a value`);
        }
    }
    class InactiveUnionProperty extends TypeError {
        constructor(t, e, n) {
            super(`Accessing property ${e} when ${n} is active`);
        }
    }
    class MissingUnionInitializer extends TypeError {
        constructor(t, e, n) {
            const {name: r, instance: {members: i}} = t;
            super(`${r} needs an initializer for one of its union properties: ${i.slice(0, n ? -1 : void 0).map((t => t.name)).join(", ")}`);
        }
    }
    class InvalidInitializer extends TypeError {
        constructor(t, e, n) {
            const {name: r} = t, i = [];
            if (Array.isArray(e)) for (const t of e) i.push(Le(t)); else i.push(Le(e));
            const s = Pe(n);
            super(`${r} expects ${Re(i)} as argument, received ${s}`);
        }
    }
    class InvalidArrayInitializer extends InvalidInitializer {
        constructor(t, n, r = !1) {
            const {instance: {members: [i]}, type: s, constructor: o} = t, c = [], a = le(i);
            if (a) {
                let t;
                switch (i.structure?.type) {
                  case e.Enum:
                    t = "enum item";
                    break;

                  case e.ErrorSet:
                    t = "error";
                    break;

                  default:
                    t = a;
                }
                c.push(`array of ${t}s`);
            } else c.push("array of objects");
            o[Pt] && c.push(o[Pt].name), s === e.Slice && r && c.push("length"), super(t, c.join(" or "), n);
        }
    }
    class ArrayLengthMismatch extends TypeError {
        constructor(t, e, n) {
            const {name: r, length: i, instance: {members: [s]}} = t, {structure: {constructor: o}} = s, {length: c, constructor: a} = n, l = e?.length ?? i, u = 1 !== l ? "s" : "";
            let f;
            f = a === o ? "only a single one" : a.child === o ? `a slice/array that has ${c}` : `${c} initializer${c > 1 ? "s" : ""}`, 
            super(`${r} has ${l} element${u}, received ${f}`);
        }
    }
    class InvalidSliceLength extends TypeError {
        constructor(t, e) {
            super(t < 0 ? "Length of slice cannot be negative" : `Length of slice can be ${e} or less, received ${t}`);
        }
    }
    class MissingInitializers extends TypeError {
        constructor(t, e) {
            const {name: n} = t;
            super(`Missing initializers for ${n}: ${e.join(", ")}`);
        }
    }
    class NoProperty extends TypeError {
        constructor(t, e) {
            const {name: n, instance: {members: r}} = t;
            let i;
            i = r.find((t => t.name === e)) ? `Comptime value cannot be changed: ${e}` : `${n} does not have a property with that name: ${e}`, 
            super(i);
        }
    }
    class ArgumentCountMismatch extends Error {
        constructor(t, e, n = !1) {
            super();
            const r = r => {
                e -= r;
                const i = 1 !== (t -= r) ? "s" : "", s = n ? "at least " : "";
                this.message = `Expecting ${s}${t} argument${i}, received ${e}`, this.stack = je(this.stack, "new Arg(");
            };
            r(0), se(this, _t, {
                value: r,
                enumerable: !1
            });
        }
    }
    class UndefinedArgument extends Error {
        constructor() {
            super("Undefined argument");
        }
    }
    class NoCastingToPointer extends TypeError {
        constructor() {
            super("Non-slice pointers can only be created with the help of the new operator");
        }
    }
    class NoCastingToFunction extends TypeError {
        constructor() {
            super("Casting to function is not allowed");
        }
    }
    class ConstantConstraint extends TypeError {
        constructor(t, e) {
            const {name: n} = t, {constructor: {name: r}} = e;
            super(`Conversion of ${r} to ${n} requires an explicit cast`);
        }
    }
    class MisplacedSentinel extends TypeError {
        constructor(t, e, n, r) {
            const {name: i} = t;
            super(`${i} expects the sentinel value ${e} at ${r - 1}, found at ${n}`);
        }
    }
    class MissingSentinel extends TypeError {
        constructor(t, e, n) {
            const {name: r} = t;
            super(`${r} expects the sentinel value ${e} at ${n - 1}`);
        }
    }
    class AlignmentConflict extends TypeError {
        constructor(t, e) {
            super(`Unable to simultaneously align memory to ${e}-byte and ${t}-byte boundary`);
        }
    }
    class TypeMismatch extends TypeError {
        constructor(t, e) {
            const n = Pe(e);
            super(`Expected ${Le(t)}, received ${n}`);
        }
    }
    class InaccessiblePointer extends TypeError {
        constructor() {
            super("Pointers within an untagged union are not accessible");
        }
    }
    class NullPointer extends TypeError {
        constructor() {
            super("Null pointer");
        }
    }
    class PreviouslyFreed extends TypeError {
        constructor(t) {
            super(`Object has been freed already: ${t.constructor.name}`);
        }
    }
    class InvalidPointerTarget extends TypeError {
        constructor(t, e) {
            const {name: n} = t;
            let r;
            if (null != e) {
                const t = e instanceof Object && e.constructor !== Object ? `${e.constructor.name} object` : typeof e;
                r = `${De(t)} ${t}`;
            } else r = e + "";
            super(`${n} cannot point to ${r}`);
        }
    }
    class ZigMemoryTargetRequired extends TypeError {
        constructor() {
            super("Pointers in Zig memory cannot point to garbage-collected object");
        }
    }
    class Overflow extends TypeError {
        constructor(t, e) {
            const {type: n, bitSize: r} = t;
            super(`${(r > 32 ? "Big" : "") + G[n] + r} cannot represent the value given: ${e}`);
        }
    }
    class OutOfBound extends RangeError {
        constructor(t, e) {
            const {name: n} = t;
            super(`Index exceeds the size of ${n ?? "array"}: ${e}`);
        }
    }
    class NotUndefined extends TypeError {
        constructor(t) {
            const {name: e} = t;
            super(`${void 0 !== e ? `Property ${e}` : "Element"} can only be undefined`);
        }
    }
    class NotOnByteBoundary extends TypeError {
        constructor(t) {
            const {name: e, structure: {name: n}} = t;
            super(`Unable to create ${n} as it is not situated on a byte boundary: ${e}`);
        }
    }
    class ReadOnly extends TypeError {
        constructor() {
            super("Unable to modify read-only object");
        }
    }
    class ReadOnlyTarget extends TypeError {
        constructor(t) {
            const {name: e} = t;
            super(`${e} cannot point to a read-only object`);
        }
    }
    class AccessingOpaque extends TypeError {
        constructor(t) {
            const {name: e} = t;
            super(`Unable to access opaque structure ${e}`);
        }
    }
    class CreatingOpaque extends TypeError {
        constructor(t) {
            const {name: e} = t;
            super(`Unable to create instance of ${e}, as it is opaque`);
        }
    }
    class InvalidVariadicArgument extends TypeError {
        constructor() {
            super("Arguments passed to variadic function must be casted to a Zig type");
        }
    }
    class UnexpectedGenerator extends TypeError {
        constructor() {
            super("Unexpected async generator");
        }
    }
    class ZigError extends Error {
        constructor(t, e = 0) {
            if (t instanceof Error) return super(t.message), t.stack = je(this.stack, e), t;
            super(t ?? "Error encountered in Zig code");
        }
    }
    function Be(t, e) {
        const n = n => {
            e -= n, t.message = `args[${e}]: ${t.message}`, t.stack = je(t.stack, "new Arg(");
        };
        return n(0), se(t, _t, {
            value: n,
            enumerable: !1
        }), t;
    }
    function je(t, e) {
        if ("string" == typeof t) {
            const n = t.split("\n"), r = n.findIndex((t => t.includes(e)));
            -1 !== r && (n.splice(1, r), t = n.join("\n"));
        }
        return t;
    }
    function ke() {
        throw new ReadOnly;
    }
    function Fe(t, e, n) {
        if (void 0 === t.bytes && (t.bytes = t.calls = 0), t.bytes += n, t.calls++, 100 === t.calls) {
            const n = t.bytes / t.calls;
            if (n < 8) {
                throw new Error(`Inefficient ${e} access. Each call is only reading ${n} byte${n > 1 ? "s" : ""}. Please use std.io.BufferedReader.`);
            }
        }
    }
    function Ne(t) {
        return "object" == typeof t && "string" == typeof t.error && 1 === Object.keys(t).length;
    }
    function Pe(t) {
        const e = typeof t;
        let n;
        return n = "object" === e ? t ? Object.prototype.toString.call(t) : "null" : e, 
        Le(n);
    }
    function Le(t) {
        return `${De(t)} ${t}`;
    }
    function De(t) {
        return /^\W*[aeiou]/i.test(t) ? "an" : "a";
    }
    function Re(t, e = "or") {
        const n = ` ${e} `;
        return t.length > 2 ? t.slice(0, -1).join(", ") + n + t[t.length - 1] : t.join(n);
    }
    function Ze(t) {
        let n, r = 1, i = null;
        if (t instanceof DataView) {
            n = t;
            const e = n?.[ut]?.align;
            e && (r = e);
        } else if (t instanceof ArrayBuffer) n = new DataView(t); else if (t) if (t[ct]) t.constructor[ht] === e.Pointer && (t = t["*"]), 
        n = t[ct], i = t.constructor, r = i[Ut]; else {
            "string" == typeof t && (t = fe(t));
            const {buffer: e, byteOffset: i, byteLength: s, BYTES_PER_ELEMENT: o} = t;
            e && void 0 !== i && void 0 !== s && (n = new DataView(e, i, s), r = o);
        }
        return {
            dv: n,
            align: r,
            constructor: i
        };
    }
    Te({
        defineAlloc: () => ({
            value(t, e = 1) {
                const n = Math.clz32(e);
                if (e !== 1 << 31 - n) throw new Error(`Invalid alignment: ${e}`);
                const r = 31 - n, {vtable: {alloc: i}, ptr: s} = this, o = i(s, t, r, 0);
                if (!o) throw new Error("Out of memory");
                o.length = t;
                const c = o["*"][ct];
                return c[ut].align = e, c;
            }
        }),
        defineFree() {
            const t = this;
            return {
                value(e) {
                    const {dv: n, align: r} = Ze(e), i = n?.[ut];
                    if (!i) throw new TypeMismatch("object containing allocated Zig memory", e);
                    const {address: s} = i;
                    if (-1 === s) throw new PreviouslyFreed(e);
                    const {vtable: {free: o}, ptr: c} = this;
                    o(c, n, 31 - Math.clz32(r), 0), t.releaseZigView(n);
                }
            };
        },
        defineDupe() {
            const t = this.getCopyFunction();
            return {
                value(e) {
                    const {dv: n, align: r, constructor: i} = Ze(e);
                    if (!n) throw new TypeMismatch("string, DataView, typed array, or Zig object", e);
                    const s = this.alloc(n.byteLength, r);
                    return t(s, n), i ? i(s) : s;
                }
            };
        }
    }), Te({
        init() {
            this.variables = [];
        },
        getSpecialExports() {
            const t = t => {
                if (void 0 === t) throw new Error("Not a Zig type");
                return t;
            };
            return {
                init: (...t) => this.initialize?.(...t),
                abandon: () => this.abandonModule?.(),
                connect: t => this.consoleObject = t,
                sizeOf: e => t(e?.[$t]),
                alignOf: e => t(e?.[Ut]),
                typeOf: e => Ge[t(e?.[ht])]
            };
        },
        recreateStructures(t, e) {
            Object.assign(this, e);
            const n = (t, e) => {
                for (const [n, r] of Object.entries(e)) t[n] = i(r);
                return t;
            }, r = t => t.length ? t.buffer : new ArrayBuffer(0), i = t => {
                const {memory: e, structure: i, actual: s} = t;
                if (e) {
                    if (s) return s;
                    {
                        const {array: s, offset: o, length: c} = e, a = this.obtainView(r(s), o, c), {handle: l, const: u} = t, f = i?.constructor, h = t.actual = f.call(Bt, a);
                        return u && this.makeReadOnly(h), t.slots && n(h[at], t.slots), l && this.variables.push({
                            handle: l,
                            object: h
                        }), h;
                    }
                }
                return i;
            };
            this.resetGlobalErrorSet?.();
            const s = new Map;
            for (const e of t) {
                for (const t of [ e.instance, e.static ]) if (t.template) {
                    const {slots: e, memory: n, handle: i} = t.template, o = t.template = {};
                    if (n) {
                        const {array: t, offset: e, length: s} = n;
                        o[ct] = this.obtainView(r(t), e, s), i && this.variables.push({
                            handle: i,
                            object: o
                        });
                    }
                    if (e) {
                        const t = o[at] = {};
                        s.set(t, e);
                    }
                }
                this.defineStructure(e);
            }
            for (const [t, e] of s) n(t, e);
            for (const e of t) this.finalizeStructure(e);
        }
    });
    const Ge = n.map((t => t.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()));
    Te({
        init() {
            this.jsFunctionThunkMap = new Map, this.jsFunctionCallerMap = new Map, this.jsFunctionControllerMap = new Map, 
            this.jsFunctionIdMap = new WeakMap, this.jsFunctionNextId = 1;
        },
        getFunctionId(t) {
            let e = this.jsFunctionIdMap.get(t);
            return void 0 === e && (e = this.jsFunctionNextId++, this.jsFunctionIdMap.set(t, e)), 
            e;
        },
        getFunctionThunk(t, e) {
            const n = this.getFunctionId(t);
            let r = this.jsFunctionThunkMap.get(n);
            if (void 0 === r) {
                const t = this.getViewAddress(e[ct]), i = this.createJsThunk(t, n);
                if (!i) throw new Error("Unable to create function thunk");
                r = this.obtainZigView(i, 0), this.jsFunctionThunkMap.set(n, r), this.jsFunctionControllerMap.set(n, e);
            }
            return r;
        },
        createInboundCaller(t, e) {
            const n = this.getFunctionId(t);
            return this.jsFunctionCallerMap.set(n, ((n, r) => {
                let i = X, s = !1;
                try {
                    const o = e(n);
                    if (Ht in o) {
                        o[Ht]("reset");
                        const t = this.startContext();
                        this.updatePointerTargets(t, o, !0), this.updateShadowTargets(t), this.endContext();
                    }
                    const c = function(t) {
                        try {
                            if (!(e[Lt] && t instanceof Error)) throw t;
                            o[re](t);
                        } catch (e) {
                            i = K, console.error(t);
                        }
                    }, a = function(t) {
                        try {
                            o[re](t);
                        } catch (t) {
                            i = K, console.error(t);
                        }
                    };
                    try {
                        const e = t(...o), n = o.hasOwnProperty(re);
                        if ("Promise" === e?.[Symbol.toStringTag]) if (r || n) {
                            const t = e.then(a, c);
                            r && t.then((() => this.finalizeAsyncCall(r, i))), s = !0, i = X;
                        } else i = Q; else if (e?.[Symbol.asyncIterator]) {
                            if (!o.hasOwnProperty(ie)) throw new UnexpectedGenerator;
                            this.pipeContents(e, o), i = X;
                        } else null == e && n || a(e);
                    } catch (t) {
                        c(t);
                    }
                } catch (t) {
                    console.error(t), i = K;
                }
                return r && !s && this.finalizeAsyncCall(r, i), i;
            })), function(...e) {
                return t(...e);
            };
        },
        defineArgIterator(t) {
            const n = this, r = t.filter((({structure: t}) => t.type === e.Struct && t.flags & g)).length;
            return {
                value() {
                    let i, s = 0, o = 0, c = 0;
                    const a = [];
                    for (const [l, {structure: u, type: f}] of t.entries()) try {
                        let t, h, d = this[l];
                        f === Z.Object && d?.[ct]?.[ut] && (d = new d.constructor(d)), u.type === e.Struct && (u.flags & g ? (t = 1 === r ? "allocator" : "allocator" + ++s, 
                        h = this[Zt] = d) : u.flags & p ? (t = "callback", 1 == ++o && (h = n.createPromiseCallback(this, d))) : u.flags & b ? (t = "callback", 
                        1 == ++o && (h = n.createGeneratorCallback(this, d))) : u.flags & y && (t = "signal", 
                        1 == ++c && (h = n.createInboundSignal(d)))), void 0 !== t ? void 0 !== h && (i ||= {}, 
                        i[t] = h) : a.push(d);
                    } catch (t) {
                        a.push(t);
                    }
                    return i && a.push(i), a[Symbol.iterator]();
                }
            };
        },
        handleJsCall(t, e, n, r = 0) {
            const i = this.obtainZigView(e, n, !1), s = this.jsFunctionCallerMap.get(t);
            return s ? s(i, r) : K;
        },
        releaseFunction(t) {
            const e = this.jsFunctionThunkMap.get(t), n = this.jsFunctionControllerMap.get(t);
            if (e && n) {
                const r = this.getViewAddress(n[ct]), i = this.getViewAddress(e);
                this.destroyJsThunk(r, i), this.releaseZigView(e), t && (this.jsFunctionThunkMap.delete(t), 
                this.jsFunctionCallerMap.delete(t), this.jsFunctionControllerMap.delete(t));
            }
        },
        freeFunction(t) {
            this.releaseFunction(this.getFunctionId(t));
        },
        exports: {
            handleJsCall: null,
            releaseFunction: null
        },
        imports: {
            createJsThunk: null,
            destroyJsThunk: null,
            finalizeAsyncCall: null
        }
    }), Te({
        createOutboundCaller(t, e) {
            const n = this, r = function(...i) {
                const s = new e(i, this?.[Zt]);
                return n.invokeThunk(t, r, s);
            };
            return r;
        },
        copyArguments(t, n, r, i, s) {
            let o = 0, c = 0, a = 0;
            const l = t[Nt];
            for (const {type: u, structure: f} of r) {
                let r, h, d, v;
                if (f.type === e.Struct) if (f.flags & g) {
                    r = (1 == ++a ? i?.allocator ?? i?.allocator1 : i?.[`allocator${a}`]) ?? this.createDefaultAllocator(t, f);
                } else f.flags & p ? (h ||= this.createPromise(f, t, i?.callback), r = h) : f.flags & b ? (d ||= this.createGenerator(f, t, i?.callback), 
                r = d) : f.flags & y ? (v ||= this.createSignal(f, i?.signal), r = v) : f.flags & m ? r = this.createReader(n[c++]) : f.flags & w && (r = this.createWriter(n[c++]));
                if (void 0 === r && (r = n[c++], void 0 === r && u !== Z.Void)) throw new UndefinedArgument;
                try {
                    l[o++].call(t, r, s);
                } catch (t) {
                    throw Be(t, o - 1);
                }
            }
        },
        invokeThunk(t, e, n) {
            const r = this.startContext(), i = n[jt], s = this.getViewAddress(t[ct]), o = this.getViewAddress(e[ct]), c = ee in n, a = Ht in n;
            a && this.updatePointerAddresses(r, n);
            const l = this.getViewAddress(n[ct]), u = i ? this.getViewAddress(i[ct]) : 0;
            this.updateShadows(r);
            const f = () => {
                this.updateShadowTargets(r), a && this.updatePointerTargets(r, n), this.libc && this.flushStdout?.(), 
                this.flushConsole?.(), this.endContext();
            };
            c && (n[ee] = f);
            if (!(i ? this.runVariadicThunk(s, o, l, u, i.length) : this.runThunk(s, o, l))) throw f(), 
            new ZigError;
            if (c) {
                let t = null;
                try {
                    t = n.retval;
                } catch (e) {
                    t = new ZigError(e, 1);
                }
                return null != t ? (e[Jt] && t && (t = t.string), n[re](t)) : e[Jt] && (n[Jt] = !0), 
                n[Dt] ?? n[Rt];
            }
            f();
            try {
                const {retval: t} = n;
                return e[Jt] && t ? t.string : t;
            } catch (t) {
                throw new ZigError(t, 1);
            }
        },
        imports: {
            runThunk: null,
            runVariadicThunk: null
        }
    }), Te({
        init() {
            const t = {
                type: Z.Int,
                bitSize: 8,
                byteSize: 1
            }, e = {
                type: Z.Int,
                bitSize: 16,
                byteSize: 2
            }, n = {
                type: Z.Int,
                bitSize: 32,
                byteSize: 4
            }, r = this.getAccessor("get", t), i = this.getAccessor("set", t), s = this.getAccessor("get", e), o = this.getAccessor("set", e), c = this.getAccessor("get", n), a = this.getAccessor("set", n);
            this.copiers = {
                0: Ce,
                1: function(t, e) {
                    i.call(t, 0, r.call(e, 0));
                },
                2: function(t, e) {
                    o.call(t, 0, s.call(e, 0, !0), !0);
                },
                4: function(t, e) {
                    a.call(t, 0, c.call(e, 0, !0), !0);
                },
                8: function(t, e) {
                    a.call(t, 0, c.call(e, 0, !0), !0), a.call(t, 4, c.call(e, 4, !0), !0);
                },
                16: function(t, e) {
                    a.call(t, 0, c.call(e, 0, !0), !0), a.call(t, 4, c.call(e, 4, !0), !0), a.call(t, 8, c.call(e, 8, !0), !0), 
                    a.call(t, 12, c.call(e, 12, !0), !0);
                },
                any: function(t, e) {
                    let n = 0, s = t.byteLength;
                    for (;n + 4 <= s; ) a.call(t, n, c.call(e, n, !0), !0), n += 4;
                    for (;n + 1 <= s; ) i.call(t, n, r.call(e, n)), n++;
                }
            }, this.resetters = {
                0: Ce,
                1: function(t, e) {
                    i.call(t, e, 0);
                },
                2: function(t, e) {
                    o.call(t, e, 0, !0);
                },
                4: function(t, e) {
                    a.call(t, e, 0, !0);
                },
                8: function(t, e) {
                    a.call(t, e + 0, 0, !0), a.call(t, e + 4, 0, !0);
                },
                16: function(t, e) {
                    a.call(t, e + 0, 0, !0), a.call(t, e + 4, 0, !0), a.call(t, e + 8, 0, !0), a.call(t, e + 12, 0, !0);
                },
                any: function(t, e, n) {
                    let r = e;
                    for (;r + 4 <= n; ) a.call(t, r, 0, !0), r += 4;
                    for (;r + 1 <= n; ) i.call(t, r, 0), r++;
                }
            };
        },
        defineCopier(t, e) {
            const n = this.getCopyFunction(t, e);
            return {
                value(t) {
                    const e = t[ct], r = this[ct];
                    n(r, e);
                }
            };
        },
        defineResetter(t, e) {
            const n = this.getResetFunction(e);
            return {
                value() {
                    const r = this[ct];
                    n(r, t, e);
                }
            };
        },
        getCopyFunction(t, e = !1) {
            return (e ? void 0 : this.copiers[t]) ?? this.copiers.any;
        },
        getResetFunction(t) {
            return this.resetters[t] ?? this.resetters.any;
        },
        imports: {
            copyExternBytes: null
        }
    }), Te({
        init() {},
        createDefaultAllocator(t, e) {
            let n = this.defaultAllocator;
            if (!n) {
                const {constructor: t} = e, {noResize: r, noRemap: i} = t, s = {
                    alloc: (t, e, n) => this.allocateHostMemory(e, 1 << n),
                    free: (t, e, n) => {
                        const r = this.getViewAddress(e["*"][ct]), i = e.length;
                        this.freeHostMemory(r, i, 1 << n);
                    },
                    resize: r
                };
                i && (s.remap = i);
                const o = this.obtainZigView(ye, 0);
                n = this.defaultAllocator = new t({
                    ptr: o,
                    vtable: s
                }), this.destructors.push((() => this.freeFunction(s.alloc))), this.destructors.push((() => this.freeFunction(s.free)));
            }
            return n;
        },
        allocateHostMemory(t, e) {
            const n = this.allocateJSMemory(t, e);
            {
                const r = this.getViewAddress(n);
                return this.registerMemory(r, t, e, !0, n), se(n, ut, {
                    value: {
                        address: r,
                        len: t,
                        js: !0
                    },
                    enumerable: !1
                }), n;
            }
        },
        freeHostMemory(t, e, n) {
            this.unregisterMemory(t, e);
        }
    }), Te({
        init() {
            this.generatorCallbackMap = new Map, this.generatorContextMap = new Map, this.nextGeneratorContextId = me(8192);
        },
        createGenerator(t, e, n) {
            const {constructor: r} = t;
            if (n) {
                if ("function" != typeof n) throw new TypeMismatch("function", n);
            } else {
                const t = e[Rt] = new AsyncGenerator;
                n = t.push.bind(t);
            }
            const i = this.nextGeneratorContextId++, s = this.obtainZigView(i, 0, !1);
            this.generatorContextMap.set(i, {
                func: n,
                args: e
            });
            let o = this.generatorCallbackMap.get(r);
            return o || (o = async (t, e) => {
                const n = t instanceof DataView ? t : t["*"][ct], r = this.getViewAddress(n), i = this.generatorContextMap.get(r);
                if (i) {
                    const {func: t, args: n} = i, s = e instanceof Error;
                    !s && n[Jt] && e && (e = e.string);
                    return !1 !== await (2 === t.length ? t(s ? e : null, s ? null : e) : t(e)) && !s && null !== e || (n[ee](), 
                    this.generatorContextMap.delete(r), !1);
                }
            }, this.generatorCallbackMap.set(r, o), this.destructors.push((() => this.freeFunction(o)))), 
            e[re] = t => o(s, t), {
                ptr: s,
                callback: o
            };
        },
        createGeneratorCallback(t, e) {
            const {ptr: n, callback: r} = e, i = r["*"];
            return t[ie] = e => i.call(t, n, e), (...e) => {
                const n = 2 === e.length ? e[0] ?? e[1] : e[0];
                return t[ie](n);
            };
        },
        async pipeContents(t, e) {
            try {
                try {
                    const n = t[Symbol.asyncIterator]();
                    for await (const t of n) if (null !== t && !e[ie](t)) break;
                    e[ie](null);
                } catch (t) {
                    if (!e.constructor[Lt]) throw t;
                    e[ie](t);
                }
            } catch (t) {
                console.error(t);
            }
        }
    });
    class AsyncGenerator {
        result=null;
        stopped=!1;
        finished=!1;
        promises={};
        async next() {
            if (this.stopped) return {
                done: !0
            };
            for (;;) {
                const t = this.result;
                if (null !== t) return this.result = null, this.wake("space"), {
                    value: t,
                    done: !1
                };
                if (this.error) throw this.error;
                if (this.finished) return {
                    done: !0
                };
                await this.sleep("content");
            }
        }
        async return(t) {
            return await this.break(), {
                value: t,
                done: !0
            };
        }
        async throw(t) {
            throw await this.break(), t;
        }
        async break() {
            this.finished || (this.stopped = !0, await this.sleep("break"));
        }
        async push(t) {
            return this.stopped ? (this.wake("break"), !1) : (t instanceof Error ? (this.error = t, 
            this.finished = !0) : null === t ? this.finished = !0 : (null !== this.result && await this.sleep("space"), 
            this.result = t), this.wake("content"), !this.finished);
        }
        sleep(t) {
            let e;
            const n = this.promises[t] ||= new Promise((t => e = t));
            return e && (n.resolve = e), n;
        }
        wake(t) {
            const e = this.promises[t];
            e && (this.promises[t] = null, this.finished || this.stopped ? setImmediate(e.resolve) : e.resolve());
        }
        [Symbol.asyncIterator]() {
            return this;
        }
    }
    function qe(t, e) {
        return ge(t, e, (t => t.address));
    }
    function Je(t, n) {
        const {byteSize: r, type: i} = n;
        if (!(i === e.Slice ? t.byteLength % r == 0 : t.byteLength === r)) throw new BufferSizeMismatch(n, t);
    }
    function _e(t) {
        throw new BufferExpected(t);
    }
    Te({
        addIntConversion: t => function(e, n) {
            const r = t.call(this, e, n), {flags: i, bitSize: s} = n;
            if ("set" === e) return s > 32 ? function(t, e, n) {
                r.call(this, t, BigInt(e), n);
            } : function(t, e, n) {
                const i = Number(e);
                if (!isFinite(i)) throw new InvalidIntConversion(e);
                r.call(this, t, i, n);
            };
            {
                const {flags: t} = n.structure;
                if (t & c && s > 32) {
                    const t = BigInt(Number.MAX_SAFE_INTEGER), e = BigInt(Number.MIN_SAFE_INTEGER);
                    return function(n, i) {
                        const s = r.call(this, n, i);
                        return e <= s && s <= t ? Number(s) : s;
                    };
                }
            }
            return r;
        }
    }), Te({
        init() {
            this.isMemoryMapping = !0, this.memoryList = [], this.contextCount = 0, this.externBufferList = [];
        },
        startContext() {
            return ++this.contextCount, {
                shadowList: []
            };
        },
        endContext() {
            if (0 == --this.contextCount) {
                for (const {shadowDV: t} of this.memoryList) t && this.freeShadowMemory(t);
                this.memoryList.splice(0);
            }
        },
        getShadowAddress(t, e, n, r) {
            const i = e[ct];
            if (n) {
                if (void 0 === n.address) {
                    const {start: e, end: s, targets: o} = n;
                    let c, a = 0;
                    for (const t of o) {
                        const e = t[ct], n = e.byteOffset, r = t.constructor[Ut] ?? e[Ut];
                        (void 0 === a || r > a) && (a = r, c = n);
                    }
                    const l = s - e, u = this.allocateShadowMemory(l + a, 1), f = this.getViewAddress(u), h = be(we(f, c - e), a), d = we(h, e - c);
                    for (const t of o) {
                        const n = t[ct], r = n.byteOffset;
                        if (r !== c) {
                            const i = t.constructor[Ut] ?? n[Ut];
                            if (pe(we(d, r - e), i)) throw new AlignmentConflict(i, a);
                        }
                    }
                    const g = u.byteOffset + Number(d - f), p = new DataView(u.buffer, g, l), b = new DataView(i.buffer, Number(e), l), y = this.registerMemory(d, l, 1, r, b, p);
                    t.shadowList.push(y), n.address = d;
                }
                return we(n.address, i.byteOffset - n.start);
            }
            {
                const n = e.constructor[Ut] ?? i[Ut], s = i.byteLength, o = this.allocateShadowMemory(s, n), c = this.getViewAddress(o), a = this.registerMemory(c, s, 1, r, i, o);
                return t.shadowList.push(a), c;
            }
        },
        updateShadows(t) {
            const e = this.getCopyFunction();
            for (let {targetDV: n, shadowDV: r} of t.shadowList) e(r, n);
        },
        updateShadowTargets(t) {
            const e = this.getCopyFunction();
            for (let {targetDV: n, shadowDV: r, writable: i} of t.shadowList) i && e(n, r);
        },
        registerMemory(t, e, n, r, i, s) {
            const o = qe(this.memoryList, t);
            let c = this.memoryList[o - 1];
            return c?.address === t && c.len === e ? c.writable ||= r : (c = {
                address: t,
                len: e,
                align: n,
                writable: r,
                targetDV: i,
                shadowDV: s
            }, this.memoryList.splice(o, 0, c)), c;
        },
        unregisterMemory(t, e) {
            const n = qe(this.memoryList, t), r = this.memoryList[n - 1];
            if (r?.address === t && r.len === e) return this.memoryList.splice(n - 1, 1), r;
        },
        findMemory(t, e, n, r) {
            let i = n * (r ?? 0);
            const s = qe(this.memoryList, e), o = this.memoryList[s - 1];
            let c;
            if (o?.address === e && o.len === i) c = o.targetDV; else if (o?.address <= e && we(e, i) <= we(o.address, o.len)) {
                const t = Number(e - o.address), n = void 0 === r, {targetDV: s} = o;
                n && (i = s.byteLength - t), c = this.obtainView(s.buffer, s.byteOffset + t, i), 
                n && (c[Ut] = o.align);
            }
            if (c) {
                let {targetDV: e, shadowDV: n} = o;
                if (n && t && !t.shadowList.includes(o)) {
                    this.getCopyFunction()(e, n);
                }
            } else c = this.obtainZigView(e, i);
            return c;
        },
        findShadowView(t) {
            for (const {shadowDV: e, targetDV: n} of this.memoryList) if (n === t) return e;
        },
        releaseZigView(t) {
            const e = t[ut], n = e?.address;
            n && -1 !== n && (e.address = -1, this.unregisterBuffer(we(n, -t.byteOffset)));
        },
        getViewAddress(t) {
            const e = t[ut];
            if (e) return e.address;
            {
                const e = this.getBufferAddress(t.buffer);
                return we(e, t.byteOffset);
            }
        },
        ...{
            imports: {
                getBufferAddress: null,
                obtainExternBuffer: null
            },
            exports: {
                getViewAddress: null
            },
            allocateShadowMemory(t, e) {
                return this.allocateJSMemory(t, e);
            },
            freeShadowMemory(t) {},
            obtainZigView(t, e, n = !0) {
                if (function(t) {
                    return 2863311530 === t || -1431655766 === t;
                }(t) && (t = e > 0 ? 0 : ye), !t && e) return null;
                let r, i;
                if (n) {
                    const n = qe(this.externBufferList, t), s = this.externBufferList[n - 1];
                    s?.address <= t && we(t, e) <= we(s.address, s.len) ? (r = s.buffer, i = Number(t - s.address)) : (r = e > 0 ? this.obtainExternBuffer(t, e, Gt) : new ArrayBuffer(0), 
                    this.externBufferList.splice(n, 0, {
                        address: t,
                        len: e,
                        buffer: r
                    }), i = 0);
                } else r = e > 0 ? this.obtainExternBuffer(t, e, Gt) : new ArrayBuffer(0), i = 0;
                return r[ut] = {
                    address: t,
                    len: e
                }, this.obtainView(r, i, e);
            },
            unregisterBuffer(t) {
                const e = qe(this.externBufferList, t), n = this.externBufferList[e - 1];
                n?.address === t && this.externBufferList.splice(e - 1, 1);
            },
            getTargetAddress(t, e, n, r) {
                const i = e[ct];
                if (n) {
                    if (void 0 === n.misaligned) {
                        const t = this.getBufferAddress(i.buffer);
                        for (const e of n.targets) {
                            const r = e[ct].byteOffset, i = e.constructor[Ut], s = we(t, r);
                            if (pe(s, i)) {
                                n.misaligned = !0;
                                break;
                            }
                        }
                        void 0 === n.misaligned && (n.misaligned = !1, n.address = t);
                    }
                    if (!n.misaligned) return we(n.address, i.byteOffset);
                } else {
                    const t = e.constructor[Ut], n = this.getViewAddress(i);
                    if (!pe(n, t)) {
                        const e = i.byteLength;
                        return this.registerMemory(n, e, t, r, i), n;
                    }
                }
                return this.getShadowAddress(t, e, n, r);
            }
        }
    }), Te({
        init() {
            this.abandoned = !1, this.destructors = [];
        },
        abandonModule() {
            if (!this.abandoned) {
                for (const t of this.destructors.reverse()) t();
                this.abandoned = !0;
            }
        },
        ...{
            imports: {
                loadModule: null
            },
            exportFunctions() {
                const t = {};
                for (const [e, n] of Object.entries(this.exports)) {
                    const r = this[n ?? e];
                    r && (t[e] = r.bind(this));
                }
                return t;
            },
            importFunctions(t) {
                for (const [e, n] of Object.entries(this.imports)) {
                    const r = t[n ?? e];
                    r && (this[e] = r);
                }
            }
        }
    }), Te({
        linkVariables(t) {
            const e = this.getCopyFunction();
            for (const {object: n, handle: r} of this.variables) {
                const i = n[ct], s = this.recreateAddress(r);
                let o = n[ct] = this.obtainZigView(s, i.byteLength);
                t && e(o, i), n.constructor[Ct]?.save?.(o, n), this.destructors.push((() => {
                    const t = n[ct] = this.allocateMemory(o.bytelength);
                    e(t, o);
                }));
                const c = t => {
                    const e = t[at];
                    if (e) {
                        const t = o.byteOffset;
                        for (const n of Object.values(e)) if (n) {
                            const e = n[ct];
                            if (e.buffer === i.buffer) {
                                const r = t + e.byteOffset - i.byteOffset;
                                n[ct] = this.obtainView(o.buffer, r, e.byteLength), n.constructor[Ct]?.save?.(o, n), 
                                c(n);
                            }
                        }
                    }
                };
                c(n), n[Ht]?.((function() {
                    this[_t]();
                }), rt.IgnoreInactive);
            }
        },
        imports: {
            recreateAddress: null
        }
    }), Te({
        updatePointerAddresses(t, e) {
            const n = new Map, r = new Map, i = [], s = function(t) {
                const e = this[yt];
                if (void 0 === n.get(e)) {
                    const t = e[at][0];
                    if (t) {
                        const o = {
                            target: t,
                            writable: !e.constructor.const
                        }, c = t[ct];
                        if (c[ut]) n.set(e, null); else {
                            n.set(e, t);
                            const a = r.get(c.buffer);
                            if (a) {
                                const t = Array.isArray(a) ? a : [ a ], e = ge(t, c.byteOffset, (t => t.target[ct].byteOffset));
                                t.splice(e, 0, o), Array.isArray(a) || (r.set(c.buffer, t), i.push(t));
                            } else r.set(c.buffer, o);
                            t[Ht]?.(s, 0);
                        }
                    }
                }
            }, o = rt.IgnoreRetval | rt.IgnoreInactive;
            e[Ht](s, o);
            const c = this.findTargetClusters(i), a = new Map;
            for (const t of c) for (const e of t.targets) a.set(e, t);
            for (const [e, r] of n) if (r) {
                const n = a.get(r), i = n?.writable ?? !e.constructor.const;
                e[Mt] = this.getTargetAddress(t, r, n, i), xt in e && (e[xt] = r.length);
            }
        },
        updatePointerTargets(t, e, n = !1) {
            const r = new Map, i = function(e) {
                const n = this[yt];
                if (!r.get(n)) {
                    r.set(n, !0);
                    const s = n[at][0], o = s && e & rt.IsImmutable ? s : n[_t](t, !0, !(e & rt.IsInactive)), c = n.constructor.const ? rt.IsImmutable : 0;
                    c & rt.IsImmutable || s && !s[ct][ut] && s[Ht]?.(i, c), o !== s && o && !o[ct][ut] && o?.[Ht]?.(i, c);
                }
            }, s = n ? rt.IgnoreRetval : 0;
            e[Ht](i, s);
        },
        findTargetClusters(t) {
            const e = [];
            for (const n of t) {
                let t = null, r = 0, i = 0, s = null;
                for (const {target: o, writable: c} of n) {
                    const n = o[ct], {byteOffset: a, byteLength: l} = n, u = a + l;
                    let f = !0;
                    t && (i > a ? (s ? s.writable ||= c : (s = {
                        targets: [ t ],
                        start: r,
                        end: i,
                        address: void 0,
                        misaligned: void 0,
                        writable: c
                    }, e.push(s)), s.targets.push(o), u > i ? s.end = u : f = !1) : s = null), f && (t = o, 
                    r = a, i = u);
                }
            }
            return e;
        }
    }), Te({
        init() {
            this.promiseCallbackMap = new Map, this.promiseContextMap = new Map, this.nextPromiseContextId = me(4096);
        },
        createPromise(t, e, n) {
            const {constructor: r} = t;
            if (n) {
                if ("function" != typeof n) throw new TypeMismatch("function", n);
            } else e[Dt] = new Promise(((t, r) => {
                n = n => {
                    n?.[ct]?.[ut] && (n = new n.constructor(n)), n instanceof Error ? r(n) : (e[Jt] && n && (n = n.string), 
                    t(n));
                };
            }));
            const i = this.nextPromiseContextId++, s = this.obtainZigView(i, 0, !1);
            this.promiseContextMap.set(i, {
                func: n,
                args: e
            });
            let o = this.promiseCallbackMap.get(r);
            return o || (o = (t, e) => {
                const n = t instanceof DataView ? t : t["*"][ct], r = this.getViewAddress(n), i = this.promiseContextMap.get(r);
                if (i) {
                    const {func: t, args: n} = i;
                    if (2 === t.length) {
                        const n = e instanceof Error;
                        t(n ? e : null, n ? null : e);
                    } else t(e);
                    n[ee](), this.promiseContextMap.delete(r);
                }
            }, this.promiseCallbackMap.set(r, o), this.destructors.push((() => this.freeFunction(o)))), 
            e[re] = t => o(s, t), {
                ptr: s,
                callback: o
            };
        },
        createPromiseCallback(t, e) {
            const {ptr: n, callback: r} = e, i = r["*"];
            return t[re] = e => i.call(t, n, e), (...e) => {
                const n = 2 === e.length ? e[0] ?? e[1] : e[0];
                return t[re](n);
            };
        }
    }), Te({
        init() {
            this.readerCallback = null, this.readerContextMap = new Map, this.nextReaderContextId = me(4096);
        },
        createReader(t) {
            if (t instanceof ReadableStreamDefaultReader || t instanceof ReadableStreamBYOBReader) {
                const e = this.nextReaderContextId++, n = this.obtainZigView(e, 0, !1);
                this.readerContextMap.set(e, {
                    reader: t,
                    leftover: null,
                    finished: !1
                });
                let r = this.readerCallback;
                return r || (r = this.readerCallback = async (t, e) => {
                    const n = this.getViewAddress(t["*"][ct]), r = this.readerContextMap.get(n);
                    if (!r) return 0;
                    try {
                        const t = e["*"][ct], i = new Uint8Array(t.buffer, t.byteOffset, t.byteLength);
                        Fe(r, "reader", i.length);
                        let {reader: s, finished: o, leftover: c} = r, a = 0;
                        if (s instanceof ReadableStreamBYOBReader) {
                            const {done: t, value: e} = await s.read(i);
                            a = e.byteLength, o = t;
                        } else {
                            for (;a < i.length && !o; ) {
                                if (!c) {
                                    const {done: t, value: e} = await s.read();
                                    o = t, c = new Uint8Array(e);
                                }
                                const t = Math.min(c.length, i.length - a);
                                for (let e = 0; e < t; e++) i[a + e] = c[e];
                                if (a += t, c.length > t) c = c.slice(t); else if (c = null, o) break;
                            }
                            r.leftover = c, r.finished = o;
                        }
                        return o && this.readerContextMap.delete(n), a;
                    } catch (t) {
                        throw console.error(t), this.readerContextMap.delete(n), t;
                    }
                }, this.destructors.push((() => this.freeFunction(r)))), {
                    context: n,
                    readFn: r
                };
            }
            if ("object" == typeof t && "context" in t && "readFn" in t) return t;
            throw new TypeMismatch("ReadableStreamDefaultReader or ReadableStreamBYOBReader", t);
        }
    }), Te({
        addRuntimeCheck: t => function(e, n) {
            const r = t.call(this, e, n);
            if ("set" === e) {
                const {min: t, max: e} = function(t) {
                    const {type: e, bitSize: n} = t, r = e === Z.Int;
                    let i = r ? n - 1 : n;
                    if (n <= 32) {
                        return {
                            min: r ? -(2 ** i) : 0,
                            max: 2 ** i - 1
                        };
                    }
                    i = BigInt(i);
                    return {
                        min: r ? -(2n ** i) : 0n,
                        max: 2n ** i - 1n
                    };
                }(n);
                return function(i, s, o) {
                    if (s < t || s > e) throw new Overflow(n, s);
                    r.call(this, i, s, o);
                };
            }
            return r;
        }
    }), Te({
        init() {
            this.consoleObject = null, this.consolePending = [], this.consoleTimeout = 0;
        },
        writeToConsole(t) {
            try {
                const e = new Uint8Array(t.buffer, t.byteOffset, t.byteLength).slice(), n = e.lastIndexOf(10);
                if (-1 === n) this.consolePending.push(e); else {
                    const t = e.subarray(0, n), r = e.subarray(n + 1);
                    this.writeToConsoleNow([ ...this.consolePending, t ]), this.consolePending.splice(0), 
                    r.length > 0 && this.consolePending.push(r);
                }
                return clearTimeout(this.consoleTimeout), this.consoleTimeout = 0, this.consolePending.length > 0 && (this.consoleTimeout = setTimeout((() => {
                    this.writeToConsoleNow(this.consolePending), this.consolePending.splice(0);
                }), 250)), !0;
            } catch (t) {
                return console.error(t), !1;
            }
        },
        writeToConsoleNow(t) {
            const e = this.consoleObject ?? globalThis.console;
            e.log?.call?.(e, ue(t));
        },
        flushConsole() {
            this.consolePending.length > 0 && (this.writeToConsoleNow(this.consolePending), 
            this.consolePending.splice(0), clearTimeout(this.consoleTimeout));
        },
        ...{
            exports: {
                writeBytes: null
            },
            imports: {
                flushStdout: null
            },
            writeBytes(t, e) {
                const n = this.obtainZigView(t, e, !1);
                return n && this.writeToConsole(n) ? X : K;
            }
        }
    }), Te({
        init() {
            this.comptime = !1, this.slots = {}, this.structures = [], this.structureCounters = {
                struct: 0,
                union: 0,
                errorSet: 0,
                enum: 0,
                opaque: 0
            }, this.littleEndian = !0, this.runtimeSafety = !1, this.libc = !1;
        },
        readSlot(t, e) {
            const n = t ? t[at] : this.slots;
            return n?.[e];
        },
        writeSlot(t, e, n) {
            const r = t ? t[at] : this.slots;
            r && (r[e] = n);
        },
        createTemplate: t => ({
            [ct]: t,
            [at]: {}
        }),
        beginStructure(t) {
            const {type: e, name: n, length: r, signature: i = -1n, byteSize: s, align: o, flags: c} = t;
            return {
                constructor: null,
                type: e,
                flags: c,
                signature: i,
                name: n,
                length: r,
                byteSize: s,
                align: o,
                instance: {
                    members: [],
                    template: null
                },
                static: {
                    members: [],
                    template: null
                }
            };
        },
        attachMember(t, e, n = !1) {
            (n ? t.static : t.instance).members.push(e);
        },
        attachTemplate(t, e, n = !1) {
            (n ? t.static : t.instance).template = e;
        },
        endStructure(t) {
            t.name || this.inferTypeName(t), this.structures.push(t), this.finalizeStructure(t);
        },
        captureView(t, e, n, r) {
            if (n) {
                const n = this.allocateJSMemory(e, 0);
                return e > 0 && this.copyExternBytes(n, t, e), n;
            }
            {
                const n = this.obtainZigView(t, e);
                return n[ut].handle = r, n;
            }
        },
        castView(t, e, n, r, i) {
            const {constructor: o, flags: c} = r, a = this.captureView(t, e, n, i), l = o.call(Bt, a);
            return c & s && this.updatePointerTargets(null, l), n && e > 0 && this.makeReadOnly?.(l), 
            l;
        },
        acquireStructures() {
            const t = this.getModuleAttributes();
            this.littleEndian = !!(t & tt), this.runtimeSafety = !!(t & et), this.libc = !!(t & nt);
            const e = this.getFactoryThunk(), n = {
                [ct]: this.obtainZigView(e, 0)
            };
            this.comptime = !0, this.mixinUsage = new Map, this.invokeThunk(n, n, n), this.comptime = !1;
            for (const t of this.structures) {
                const {constructor: e, flags: n, instance: {template: r}} = t;
                if (n & s && r && r[ct]) {
                    const t = Object.create(e.prototype);
                    t[ct] = r[ct], t[at] = r[at], this.updatePointerTargets(null, t);
                }
            }
        },
        getRootModule() {
            return this.structures[this.structures.length - 1].constructor;
        },
        hasMethods() {
            return !!this.structures.find((t => t.type === e.Function));
        },
        exportStructures() {
            this.prepareObjectsForExport();
            const {structures: t, runtimeSafety: e, littleEndian: n, libc: r} = this;
            return {
                structures: t,
                settings: {
                    runtimeSafety: e,
                    littleEndian: n,
                    libc: r
                }
            };
        },
        prepareObjectsForExport() {
            const t = [];
            for (const e of Ae(this.structures, at)) {
                const n = e[ct]?.[ut];
                if (n) {
                    const {address: r, len: i, handle: s} = n, o = e[ct] = this.captureView(r, i, !0);
                    s && (o.handle = s), t.push({
                        address: r,
                        len: i,
                        owner: e,
                        replaced: !1,
                        handle: s
                    });
                }
            }
            t.sort(((t, e) => e.len - t.len));
            for (const e of t) if (!e.replaced) for (const n of t) if (e !== n && !n.replaced && !n.handle && e.address <= n.address && we(n.address, n.len) <= we(e.address, e.len)) {
                const t = e.owner[ct], r = Number(n.address - e.address) + t.byteOffset;
                n.owner[ct] = this.obtainView(t.buffer, r, n.len), n.replaced = !0;
            }
        },
        useStructures() {
            const t = this.getRootModule(), e = Ae(this.structures, at);
            for (const t of e) t[ct]?.[ut] && this.variables.push({
                object: t
            });
            return this.slots = {}, this.structures = [], t.__zigar = this.getSpecialExports(), 
            t;
        },
        inferTypeName(t) {
            const e = this[`get${n[t.type]}Name`];
            t.name = e.call(this, t);
        },
        getPrimitiveName(t) {
            const {instance: {members: [e]}, static: {template: n}, flags: r} = t;
            switch (e.type) {
              case Z.Bool:
                return "bool";

              case Z.Int:
                return r & c ? "isize" : `i${e.bitSize}`;

              case Z.Uint:
                return r & c ? "usize" : `u${e.bitSize}`;

              case Z.Float:
                return `f${e.bitSize}`;

              case Z.Void:
                return "void";

              case Z.Literal:
                return "enum_literal";

              case Z.Null:
                return "null";

              case Z.Undefined:
                return "undefined";

              case Z.Type:
                return "type";

              case Z.Object:
                return "comptime";

              default:
                return "unknown";
            }
        },
        getArrayName(t) {
            const {instance: {members: [e]}, length: n} = t;
            return `[${n}]${e.structure.name}`;
        },
        getStructName(t) {
            return "S" + this.structureCounters.struct++;
        },
        getUnionName(t) {
            return "U" + this.structureCounters.union++;
        },
        getErrorUnionName(t) {
            const {instance: {members: [e, n]}} = t;
            return `${n.structure.name}!${e.structure.name}`;
        },
        getErrorSetName(t) {
            return t.flags & k ? "anyerror" : "ES" + this.structureCounters.errorSet++;
        },
        getEnumName(t) {
            return "EN" + this.structureCounters.enum++;
        },
        getOptionalName(t) {
            const {instance: {members: [e]}} = t;
            return `?${e.structure.name}`;
        },
        getPointerName(t) {
            const {instance: {members: [n]}, flags: r} = t;
            let i = "*", s = n.structure.name;
            if (n.structure.type === e.Slice && (s = s.slice(3)), r & E && (i = r & V ? "[]" : r & O ? "[*c]" : "[*]"), 
            !(r & O)) {
                const t = n.structure.constructor?.[mt];
                t && (i = i.slice(0, -1) + `:${t.value}` + i.slice(-1));
            }
            return r & C && (i = `${i}const `), i + s;
        },
        getSliceName(t) {
            const {instance: {members: [e]}, flags: n} = t;
            return n & j ? "anyopaque" : `[_]${e.structure.name}`;
        },
        getVectorName(t) {
            const {instance: {members: [e]}, length: n} = t;
            return `@Vector(${n}, ${e.structure.name})`;
        },
        getOpaqueName(t) {
            return "O" + this.structureCounters.opaque++;
        },
        getArgStructName(t) {
            const {instance: {members: e}} = t, n = e[0], r = e.slice(1), i = n.structure.name;
            return `Arg(fn (${r.map((t => t.structure.name)).join(", ")}) ${i})`;
        },
        getVariadicStructName(t) {
            const {instance: {members: e}} = t, n = e[0], r = e.slice(1), i = n.structure.name;
            return `Arg(fn (${r.map((t => t.structure.name)).join(", ")}, ...) ${i})`;
        },
        getFunctionName(t) {
            const {instance: {members: [e]}} = t;
            return e.structure.name.slice(4, -1);
        },
        exports: {
            captureView: null,
            castView: null,
            readSlot: null,
            writeSlot: null,
            beginStructure: null,
            attachMember: null,
            createTemplate: null,
            attachTemplate: null,
            defineStructure: null,
            endStructure: null
        },
        imports: {
            getFactoryThunk: null,
            getModuleAttributes: null
        }
    }), Te({}), Te({
        init() {
            this.viewMap = new WeakMap, this.needFallback = void 0;
        },
        extractView(t, n, r = _e) {
            const {type: i, byteSize: s, constructor: o} = t;
            let c;
            const a = n?.[Symbol.toStringTag];
            if (a && ("DataView" === a ? c = this.registerView(n) : "ArrayBuffer" === a ? c = this.obtainView(n, 0, n.byteLength) : (a && a === o[Pt]?.name || "Uint8ClampedArray" === a && o[Pt] === Uint8Array || "Uint8Array" === a && n instanceof Buffer) && (c = this.obtainView(n.buffer, n.byteOffset, n.byteLength))), 
            !c) {
                const r = n?.[ct];
                if (r) {
                    const {constructor: o, instance: {members: [c]}} = t;
                    if (Me(n, o)) return r;
                    if (function(t) {
                        return t === e.Array || t === e.Vector || t === e.Slice;
                    }(i)) {
                        const {byteSize: o, structure: {constructor: a}} = c, l = Se(n, a);
                        if (void 0 !== l) {
                            if (i === e.Slice || l * o === s) return r;
                            throw new ArrayLengthMismatch(t, null, n);
                        }
                    }
                }
            }
            return c ? void 0 !== s && Je(c, t) : r?.(t, n), c;
        },
        assignView(t, n, r, i, s) {
            const {byteSize: o, type: c} = r, a = o ?? 1;
            if (t[ct]) {
                const i = c === e.Slice ? a * t.length : a;
                if (n.byteLength !== i) throw new BufferSizeMismatch(r, n, t);
                const s = {
                    [ct]: n
                };
                t.constructor[mt]?.validateData?.(s, t.length), t[Xt](s);
            } else {
                void 0 !== o && Je(n, r);
                const e = n.byteLength / a, c = {
                    [ct]: n
                };
                t.constructor[mt]?.validateData?.(c, e), s && (i = !0), t[Kt](i ? null : n, e, s), 
                i && t[Xt](c);
            }
            if (this.usingBufferFallback()) {
                const e = t[ct], n = e.buffer[Gt];
                void 0 !== n && this.syncExternalBuffer(e.buffer, n, !0);
            }
        },
        findViewAt(t, e, n) {
            let r, i = this.viewMap.get(t);
            if (i) if (i instanceof DataView) if (i.byteOffset === e && i.byteLength === n) r = i, 
            i = null; else {
                const e = i, n = `${e.byteOffset}:${e.byteLength}`;
                i = new Map([ [ n, e ] ]), this.viewMap.set(t, i);
            } else r = i.get(`${e}:${n}`);
            return {
                existing: r,
                entry: i
            };
        },
        obtainView(t, e, n) {
            const {existing: r, entry: i} = this.findViewAt(t, e, n);
            let s;
            if (r) return r;
            s = new DataView(t, e, n), i ? i.set(`${e}:${n}`, s) : this.viewMap.set(t, s);
            {
                const r = t[ut];
                r && (s[ut] = {
                    address: we(r.address, e),
                    len: n
                });
            }
            return s;
        },
        registerView(t) {
            if (!t[ut]) {
                const {buffer: e, byteOffset: n, byteLength: r} = t, {existing: i, entry: s} = this.findViewAt(e, n, r);
                if (i) return i;
                s ? s.set(`${n}:${r}`, t) : this.viewMap.set(e, t);
            }
            return t;
        },
        allocateMemory(t, e = 0, n = null) {
            return n?.alloc?.(t, e) ?? this.allocateJSMemory(t, e);
        },
        ...{
            imports: {
                requireBufferFallback: null,
                syncExternalBuffer: null
            },
            usingBufferFallback() {
                return void 0 === this.needFallback && (this.needFallback = this.requireBufferFallback?.()), 
                this.needFallback;
            },
            allocateJSMemory(t, e) {
                const n = e > We && this.getBufferAddress ? e : 0, r = new ArrayBuffer(t + n);
                let i = 0;
                if (n) {
                    const t = this.getBufferAddress(r);
                    i = be(t, e) - t;
                }
                return this.obtainView(r, Number(i), t);
            }
        }
    });
    const We = [ "arm64", "ppc64", "x64", "s390x" ].includes(process.arch) ? 16 : 8;
    Te({}), Te({
        makeReadOnly(t) {
            Xe(t);
        }
    });
    const Ye = Object.getOwnPropertyDescriptors, He = Object.defineProperty;
    function Xe(t) {
        const e = t[yt];
        if (e) Ke(e, [ "length" ]); else {
            const e = t[wt];
            e ? (Ke(e), function(t) {
                He(t, "set", {
                    value: ke
                });
                const e = t.get;
                He(t, "get", {
                    value: function(t) {
                        const n = e.call(this, t);
                        return null === n?.[zt] && Xe(n), n;
                    }
                });
            }(e)) : Ke(t);
        }
    }
    function Ke(t, e = []) {
        const n = Ye(t.constructor.prototype);
        for (const [r, i] of Object.entries(n)) i.set && !e.includes(r) && (i.set = ke, 
        He(t, r, i));
        He(t, zt, {
            value: t
        });
    }
    function Qe() {
        const t = this[wt] ?? this, e = this.length;
        let n = 0;
        return {
            next() {
                let r, i;
                if (n < e) {
                    const e = n++;
                    r = t.get(e), i = !1;
                } else i = !0;
                return {
                    value: r,
                    done: i
                };
            }
        };
    }
    function tn(t) {
        const e = ae(t), n = this[wt] ?? this, r = this.length;
        let i = 0;
        return {
            next() {
                let t, s;
                if (i < r) {
                    const r = i++;
                    t = [ r, e((() => n.get(r))) ], s = !1;
                } else s = !0;
                return {
                    value: t,
                    done: s
                };
            }
        };
    }
    function en(t) {
        return {
            [Symbol.iterator]: tn.bind(this, t),
            length: this.length
        };
    }
    function nn(t) {
        return {
            [Symbol.iterator]: sn.bind(this, t),
            length: this[bt].length
        };
    }
    function rn(t) {
        return nn.call(this, t)[Symbol.iterator]();
    }
    function sn(t) {
        const e = ae(t), n = this, r = this[bt];
        let i = 0;
        return {
            next() {
                let t, s;
                if (i < r.length) {
                    const o = r[i++];
                    t = [ o, e((() => n[o])) ], s = !1;
                } else s = !0;
                return {
                    value: t,
                    done: s
                };
            }
        };
    }
    function on(t) {
        return {
            [Symbol.iterator]: an.bind(this, t),
            length: this[bt].length
        };
    }
    function cn(t) {
        return on.call(this, t)[Symbol.iterator]();
    }
    function an(t) {
        const e = ae(t), n = this, r = this[bt], i = this[Ft];
        let s = 0;
        return {
            next() {
                let t, o;
                if (s < r.length) {
                    const c = r[s++];
                    t = [ c, e((() => i[c].call(n))) ], o = !1;
                } else o = !0;
                return {
                    value: t,
                    done: o
                };
            }
        };
    }
    function ln() {
        const t = this, e = this.length;
        let n = 0;
        return {
            next() {
                let r, i;
                if (n < e) {
                    const e = n++;
                    r = t[e], i = !1;
                } else i = !0;
                return {
                    value: r,
                    done: i
                };
            }
        };
    }
    function un() {
        const t = this, e = this.length;
        let n = 0;
        return {
            next() {
                let r, i;
                if (n < e) {
                    const e = n++;
                    r = [ e, t[e] ], i = !1;
                } else i = !0;
                return {
                    value: r,
                    done: i
                };
            }
        };
    }
    function fn() {
        return {
            [Symbol.iterator]: un.bind(this),
            length: this.length
        };
    }
    function hn(t = {}) {
        const e = this, n = 1 === e.next.length ? [ t ] : [];
        return {
            next() {
                const t = e.next(...n);
                return {
                    value: t,
                    done: null === t
                };
            }
        };
    }
    function dn(t, {get: e, set: n}) {
        return void 0 !== t ? {
            get: function() {
                return e.call(this, t);
            },
            set: n ? function(e, r) {
                return n.call(this, t, e, r);
            } : void 0
        } : {
            get: e,
            set: n
        };
    }
    function gn(t) {
        return pn.call(this, t).$;
    }
    function pn(t) {
        return this[at][t] ?? this[Yt](t);
    }
    function bn(t) {
        const e = pn.call(this, t).$;
        return e ? e.string : e;
    }
    function yn(t, e, n) {
        pn.call(this, t)[Qt](e, n);
    }
    Te({
        init() {
            this.writerCallback = null, this.writerContextMap = new Map, this.nextWriterContextId = me(8192);
        },
        createWriter(t) {
            if (t instanceof WritableStreamDefaultWriter) {
                const e = this.nextWriterContextId++, n = this.obtainZigView(e, 0, !1);
                this.writerContextMap.set(e, {
                    writer: t
                }), t.closed.catch(Ce).then((() => this.writeMap.delete(e)));
                let r = this.writerCallback;
                return r || (r = this.writerCallback = async (t, e) => {
                    const n = this.getViewAddress(t["*"][ct]), r = this.writerContextMap.get(n);
                    if (!r) return 0;
                    try {
                        const t = e["*"][ct], n = new Uint8Array(t.buffer, t.byteOffset, t.byteLength);
                        Fe(r, "writer", n.length);
                        const {writer: i} = r;
                        return await i.write(n), n.length;
                    } catch (t) {
                        throw console.error(t), this.writeMap.delete(n), t;
                    }
                }, this.destructors.push((() => this.freeFunction(r)))), {
                    context: n,
                    writeFn: r
                };
            }
            if ("context" in t && "writeFn" in t) return t;
            throw new TypeMismatch("WritableStreamDefaultWriter", t);
        }
    }), Te({
        defineArrayEntries: () => ce(en),
        defineArrayIterator: () => ce(Qe)
    }), Te({
        defineStructEntries: () => ce(nn),
        defineStructIterator: () => ce(rn)
    }), Te({
        defineUnionEntries: () => ce(on),
        defineUnionIterator: () => ce(cn)
    }), Te({
        defineVectorEntries: () => ce(fn),
        defineVectorIterator: () => ce(ln)
    }), Te({
        defineZigIterator: () => ce(hn)
    }), Te({
        defineMember(t, e = !0) {
            if (!t) return {};
            const {type: r, structure: i} = t, s = this[`defineMember${G[r]}`].call(this, t);
            if (e && i) {
                const {type: e} = i, r = this[`transformDescriptor${n[e]}`];
                if (r) return r.call(this, s, t);
            }
            return s;
        }
    }), Te({
        defineBase64(t) {
            const e = this;
            return xe({
                get() {
                    return function(t) {
                        if ("function" == typeof Buffer && Buffer.prototype instanceof Uint8Array) return Buffer.from(t.buffer, t.byteOffset, t.byteLength).toString("base64");
                        const e = new Uint8Array(t.buffer, t.byteOffset, t.byteLength), n = String.fromCharCode.apply(null, e);
                        return btoa(n);
                    }(this.dataView);
                },
                set(n, r) {
                    if ("string" != typeof n) throw new TypeMismatch("string", n);
                    const i = function(t) {
                        if ("function" == typeof Buffer && Buffer.prototype instanceof Uint8Array) {
                            const e = Buffer.from(t, "base64");
                            return new DataView(e.buffer, e.byteOffset, e.byteLength);
                        }
                        const e = atob(t), n = new Uint8Array(e.length);
                        for (let t = 0; t < n.byteLength; t++) n[t] = e.charCodeAt(t);
                        return new DataView(n.buffer);
                    }(n);
                    e.assignView(this, i, t, !1, r);
                }
            });
        }
    }), Te({
        defineMemberBool(t) {
            return this.defineMemberUsing(t, this.getAccessor);
        }
    }), Te({
        defineClampedArray(t) {
            const e = this, n = Uint8ClampedArray;
            return xe({
                get() {
                    const t = this.typedArray;
                    return new n(t.buffer, t.byteOffset, t.length);
                },
                set(r, i) {
                    if (r?.[Symbol.toStringTag] !== n.name) throw new TypeMismatch(n.name, r);
                    const s = new DataView(r.buffer, r.byteOffset, r.byteLength);
                    e.assignView(this, s, t, !0, i);
                }
            });
        }
    }), Te({
        defineDataView(t) {
            const e = this;
            return xe({
                get() {
                    const t = this[ct];
                    if (e.usingBufferFallback()) {
                        const n = t.buffer[Gt];
                        void 0 !== n && e.syncExternalBuffer(t.buffer, n, !1);
                    }
                    return t;
                },
                set(n, r) {
                    if ("DataView" !== n?.[Symbol.toStringTag]) throw new TypeMismatch("DataView", n);
                    e.assignView(this, n, t, !0, r);
                }
            });
        },
        imports: {
            syncExternalBuffer: null
        }
    }), Te({
        defineMemberFloat(t) {
            return this.defineMemberUsing(t, this.getAccessor);
        }
    }), Te({
        defineMemberInt(t) {
            let e = this.getAccessor;
            return this.runtimeSafety && (e = this.addRuntimeCheck(e)), e = this.addIntConversion(e), 
            this.defineMemberUsing(t, e);
        }
    }), Te({
        defineMemberLiteral(t) {
            const {slot: e} = t;
            return dn(e, {
                get(t) {
                    return this[at][t].string;
                },
                set: ke
            });
        }
    }), Te({
        defineMemberNull: t => ({
            get: function() {
                return null;
            },
            set: ke
        })
    }), Te({
        defineMemberObject: t => dn(t.slot, {
            get: t.flags & H ? bn : t.structure.flags & r ? gn : pn,
            set: t.flags & J ? ke : yn
        })
    }), Te({
        ...{
            defineMemberUsing(t, e) {
                const {littleEndian: n} = this, {bitOffset: r, byteSize: i} = t, s = e.call(this, "get", t), o = e.call(this, "set", t);
                if (void 0 !== r) {
                    const t = r >> 3;
                    return {
                        get: function() {
                            return s.call(this[ct], t, n);
                        },
                        set: function(e) {
                            return o.call(this[ct], t, e, n);
                        }
                    };
                }
                return {
                    get: function(e) {
                        try {
                            return s.call(this[ct], e * i, n);
                        } catch (n) {
                            throw function(t, e, n) {
                                return n instanceof RangeError && !(n instanceof OutOfBound) && (n = new OutOfBound(t, e)), 
                                n;
                            }(t, e, n);
                        }
                    },
                    set: function(t, e) {
                        return o.call(this[ct], t * i, e, n);
                    }
                };
            }
        }
    }), Te({
        defineSentinel(t) {
            const {byteSize: e, instance: {members: [n, r], template: i}} = t, {get: s} = this.defineMember(r), {get: o} = this.defineMember(n), c = s.call(i, 0), a = !!(r.flags & q), {runtimeSafety: l} = this;
            return ce({
                value: c,
                bytes: i[ct],
                validateValue(e, n, r) {
                    if (a) {
                        if (l && e === c && n !== r - 1) throw new MisplacedSentinel(t, e, n, r);
                        if (e !== c && n === r - 1) throw new MissingSentinel(t, c, r);
                    }
                },
                validateData(n, r) {
                    if (a) if (l) for (let e = 0; e < r; e++) {
                        const i = o.call(n, e);
                        if (i === c && e !== r - 1) throw new MisplacedSentinel(t, c, e, r);
                        if (i !== c && e === r - 1) throw new MissingSentinel(t, c, r);
                    } else if (r > 0 && r * e === n[ct].byteLength) {
                        if (o.call(n, r - 1) !== c) throw new MissingSentinel(t, c, r);
                    }
                },
                isRequired: a
            });
        },
        imports: {
            findSentinel: null
        }
    }), Te({
        defineString(t) {
            const e = this, {byteSize: n} = t.instance.members[0], r = "utf-" + 8 * n;
            return xe({
                get() {
                    let t = ue(this.typedArray, r);
                    const e = this.constructor[mt]?.value;
                    return void 0 !== e && t.charCodeAt(t.length - 1) === e && (t = t.slice(0, -1)), 
                    t;
                },
                set(n, i) {
                    if ("string" != typeof n) throw new TypeMismatch("string", n);
                    const s = this.constructor[mt]?.value;
                    void 0 !== s && n.charCodeAt(n.length - 1) !== s && (n += String.fromCharCode(s));
                    const o = fe(n, r), c = new DataView(o.buffer);
                    e.assignView(this, c, t, !1, i);
                }
            });
        }
    }), Te({
        defineValueOf: () => ({
            value() {
                return vn(this, !1);
            }
        })
    });
    const mn = BigInt(Number.MAX_SAFE_INTEGER), wn = BigInt(Number.MIN_SAFE_INTEGER);
    function vn(t, n) {
        const r = {
            error: n ? "return" : "throw"
        }, i = ae(r), s = new Map, o = function(t) {
            const c = "function" == typeof t ? e.Struct : t?.constructor?.[ht];
            if (void 0 === c) {
                if (n) {
                    if ("bigint" == typeof t && wn <= t && t <= mn) return Number(t);
                    if (t instanceof Error) return {
                        error: t.message
                    };
                }
                return t;
            }
            let a = s.get(t);
            if (void 0 === a) {
                let n;
                switch (c) {
                  case e.Struct:
                    n = t[St](r), a = t.constructor[dt] & d ? [] : {};
                    break;

                  case e.Union:
                    n = t[St](r), a = {};
                    break;

                  case e.Array:
                  case e.Vector:
                  case e.Slice:
                    n = t[St](), a = [];
                    break;

                  case e.Pointer:
                    try {
                        a = t["*"];
                    } catch (t) {
                        a = Symbol.for("inaccessible");
                    }
                    break;

                  case e.Enum:
                    a = i((() => String(t)));
                    break;

                  case e.Opaque:
                    a = {};
                    break;

                  default:
                    a = i((() => t.$));
                }
                if (a = o(a), s.set(t, a), n) for (const [t, e] of n) a[t] = o(e);
            }
            return a;
        };
        return o(t);
    }
    Te({
        defineToJSON: () => ({
            value() {
                return vn(this, !0);
            }
        })
    }), Te({
        defineMemberType(t, e) {
            const {slot: n} = t;
            return dn(n, {
                get(t) {
                    const e = this[at][t];
                    return e?.constructor;
                },
                set: ke
            });
        }
    }), Te({
        defineTypedArray(t) {
            const e = this, n = this.getTypedArray(t);
            return xe({
                get() {
                    const t = this.dataView, e = t.byteLength / n.BYTES_PER_ELEMENT;
                    return new n(t.buffer, t.byteOffset, e);
                },
                set(r, i) {
                    if (r?.[Symbol.toStringTag] !== n.name) throw new TypeMismatch(n.name, r);
                    const s = new DataView(r.buffer, r.byteOffset, r.byteLength);
                    e.assignView(this, s, t, !0, i);
                }
            });
        }
    }), Te({
        defineMemberUint(t) {
            let e = this.getAccessor;
            return this.runtimeSafety && (e = this.addRuntimeCheck(e)), e = this.addIntConversion(e), 
            this.defineMemberUsing(t, e);
        }
    }), Te({
        defineMemberUndefined: t => ({
            get: function() {},
            set: ke
        })
    }), Te({
        defineMemberUnsupported(t) {
            const e = function() {
                throw new Unsupported;
            };
            return {
                get: e,
                set: e
            };
        }
    }), Te({
        defineMemberVoid(t, e) {
            const {bitOffset: n} = t;
            return {
                get() {},
                set: void 0 !== n ? function(e) {
                    if (void 0 !== e) throw new NotUndefined(t);
                } : function(e, n) {
                    if (void 0 !== n) throw new NotUndefined(t);
                    if (e < 0 || e >= this.length) throw new OutOfBound(t, e);
                }
            };
        }
    }), Te({
        defineStructure(t) {
            const {type: e, byteSize: r} = t, i = this[`define${n[e]}`], s = [], o = {}, c = {
                dataView: this.defineDataView(t),
                base64: this.defineBase64(t),
                toJSON: this.defineToJSON(),
                valueOf: this.defineValueOf(),
                [zt]: {
                    value: null
                },
                [Nt]: ce(o),
                [It]: ce(s),
                [Xt]: this.defineCopier(r)
            }, a = t.constructor = i.call(this, t, c);
            for (const [t, e] of Object.entries(c)) {
                const n = e?.set;
                n && !o[t] && "$" !== t && (o[t] = n, s.push(t));
            }
            return oe(a.prototype, c), a;
        },
        finalizeStructure(t) {
            const {name: r, type: i, constructor: s, align: o, byteSize: c, flags: a, signature: l, static: {members: u, template: f}} = t, h = [], d = {
                name: ce(r),
                toJSON: this.defineToJSON(),
                valueOf: this.defineValueOf(),
                [qt]: ce(l),
                [Bt]: ce(this),
                [Ut]: ce(o),
                [$t]: ce(c),
                [ht]: ce(i),
                [dt]: ce(a),
                [bt]: ce(h),
                [Pt]: ce(this.getTypedArray(t)),
                [Symbol.iterator]: this.defineStructIterator(),
                [St]: this.defineStructEntries(),
                [bt]: ce(h)
            }, g = {
                [Symbol.toStringTag]: ce(r)
            };
            for (const t of u) {
                const {name: n, slot: r, flags: i} = t;
                if (t.structure.type === e.Function) {
                    let e = f[at][r];
                    i & H && (e[Jt] = !0), d[n] = ce(e), e.name || se(e, "name", ce(n));
                    const [s, o] = /^(get|set)\s+([\s\S]+)/.exec(n)?.slice(1) ?? [], c = "get" === s ? 0 : 1;
                    if (s && e.length === c) {
                        d[o] ||= {};
                        d[o][s] = e;
                    }
                    if (t.flags & W) {
                        const t = function(...t) {
                            try {
                                return e(this, ...t);
                            } catch (t) {
                                throw t[_t]?.(1), t;
                            }
                        };
                        if (oe(t, {
                            name: ce(n),
                            length: ce(e.length - 1)
                        }), g[n] = ce(t), s && t.length === c) {
                            (g[o] ||= {})[s] = t;
                        }
                    }
                } else d[n] = this.defineMember(t), h.push(n);
            }
            d[at] = h.length > 0 && ce(f[at]);
            const p = this[`finalize${n[i]}`];
            !1 !== p?.call(this, t, d, g) && (oe(s.prototype, g), oe(s, d));
        },
        createConstructor(t, n = {}) {
            const {type: r, byteSize: i, align: s, flags: c, instance: {members: a, template: l}} = t, {onCastError: u} = n;
            let f;
            if (l?.[at]) {
                const t = a.filter((t => t.flags & J));
                t.length > 0 && (f = t.map((t => t.slot)));
            }
            const h = new ObjectCache, d = this, g = function(n, a = {}) {
                const {allocator: p} = a, b = this instanceof g;
                let y, m;
                if (b) {
                    if (0 === arguments.length) throw new NoInitializer(t);
                    if (y = this, c & o && (y[at] = {}), Kt in y) y[Qt](n, p), m = y[ct]; else {
                        const t = r !== e.Pointer ? p : null;
                        y[ct] = m = d.allocateMemory(i, s, t);
                    }
                } else {
                    if (ne in g && (y = g[ne].call(this, n, a), !1 !== y)) return y;
                    if (m = d.extractView(t, n, u), y = h.find(m)) return y;
                    y = Object.create(g.prototype), Kt in y ? d.assignView(y, m, t, !1, !1) : y[ct] = m, 
                    c & o && (y[at] = {});
                }
                if (f) for (const t of f) y[at][t] = l[at][t];
                return y[te]?.(), b && (Kt in y || y[Qt](n, p)), ee in y && (y = y[ee]()), h.save(m, y);
            };
            return se(g, Ct, ce(h)), g;
        },
        createApplier(t) {
            const {instance: {template: e}} = t;
            return function(n, r) {
                const i = Object.keys(n), s = this[It], o = this[Nt];
                for (const e of i) if (!(e in o)) throw new NoProperty(t, e);
                let c = 0, a = 0, l = 0, u = 0;
                for (const t of s) {
                    const e = o[t];
                    e.special ? t in n && u++ : (c++, t in n ? a++ : e.required && l++);
                }
                if (0 !== l && 0 === u) {
                    const e = s.filter((t => o[t].required && !(t in n)));
                    throw new MissingInitializers(t, e);
                }
                if (u + a > i.length) for (const t of s) t in n && (i.includes(t) || i.push(t));
                a < c && 0 === u && e && e[ct] && this[Xt](e);
                for (const t of i) {
                    o[t].call(this, n[t], r);
                }
                return i.length;
            };
        },
        getTypedArray(t) {
            const {type: n, instance: r} = t;
            if (void 0 !== n && r) {
                const [t] = r.members;
                switch (n) {
                  case e.Enum:
                  case e.ErrorSet:
                  case e.Primitive:
                    {
                        const {byteSize: e, type: n} = t;
                        return globalThis[(e > 4 && n !== Z.Float ? "Big" : "") + (n === Z.Float ? "Float" : n === Z.Int ? "Int" : "Uint") + 8 * e + "Array"];
                    }

                  case e.Array:
                  case e.Slice:
                  case e.Vector:
                    return this.getTypedArray(t.structure);
                }
            }
        }
    }), Te({
        defineArgStruct(t, e) {
            const {flags: n, byteSize: r, align: c, length: a, instance: {members: l}} = t, u = this, f = l.slice(1), h = function(t, e) {
                const i = this instanceof h;
                let s, l;
                if (i ? (s = this, l = u.allocateMemory(r, c)) : (s = Object.create(h.prototype), 
                l = t), s[ct] = l, n & o && (s[at] = {}), !i) return s;
                {
                    let r;
                    if (n & L && t.length === a + 1 && (r = t.pop()), t.length !== a) throw new ArgumentCountMismatch(a, t.length);
                    n & R && (s[ee] = null), u.copyArguments(s, t, f, r, e);
                }
            };
            for (const t of l) e[t.name] = this.defineMember(t);
            const d = e.retval.set;
            return e.length = ce(f.length), e[Yt] = n & i && this.defineVivificatorStruct(t), 
            e[Ht] = n & s && this.defineVisitorArgStruct(l), e[re] = ce((function(t) {
                d.call(this, t, this[Zt]);
            })), e[Symbol.iterator] = this.defineArgIterator?.(f), h;
        },
        finalizeArgStruct(t, e) {
            const {flags: n} = t;
            e[Lt] = ce(!!(n & D));
        }
    }), Te({
        defineFinalizerArray: ({get: t, set: e}) => ({
            value() {
                const n = new Proxy(this, Sn);
                return oe(this, {
                    [Ot]: {
                        value: n
                    },
                    get: {
                        value: t.bind(this)
                    },
                    set: e && {
                        value: e.bind(this)
                    }
                }), n;
            }
        }),
        defineVivificatorArray(t) {
            const {instance: {members: [e]}} = t, {byteSize: n, structure: r} = e, i = this;
            return {
                value: function(t) {
                    const {constructor: e} = r, s = this[ct], o = s.byteOffset + n * t, c = i.obtainView(s.buffer, o, n);
                    return this[at][t] = e.call(lt, c);
                }
            };
        }
    });
    const Sn = {
        get(t, e) {
            const n = "symbol" == typeof e ? 0 : 0 | e;
            return 0 !== n || n == e ? t.get(n) : e === wt ? t : t[e];
        },
        set(t, e, n) {
            const r = "symbol" == typeof e ? 0 : 0 | e;
            return 0 !== r || r == e ? t.set(r, n) : t[e] = n, !0;
        },
        deleteProperty(t, e) {
            const n = "symbol" == typeof e ? 0 : 0 | e;
            return 0 === n && n != e && (delete t[e], !0);
        },
        has(t, e) {
            const n = "symbol" == typeof e ? 0 : 0 | e;
            return 0 !== n || n == e ? n >= 0 && n < t.length : t[e];
        },
        ownKeys(t) {
            const e = [];
            for (let n = 0, r = t.length; n < r; n++) e.push(`${n}`);
            return e.push("length", Ot), e;
        },
        getOwnPropertyDescriptor(t, e) {
            const n = "symbol" == typeof e ? 0 : 0 | e;
            return 0 === n && n != e ? Object.getOwnPropertyDescriptor(t, e) : n >= 0 && n < t.length ? {
                value: t.get(n),
                enumerable: !0,
                writable: !0,
                configurable: !0
            } : void 0;
        }
    };
    Te({
        defineArray(t, e) {
            const {length: n, instance: {members: [r]}, flags: o} = t, c = this.createApplier(t), a = this.defineMember(r), {set: h} = a, d = this.createConstructor(t), g = function(e, r) {
                if (Me(e, d)) this[Xt](e), o & s && this[Ht]("copy", rt.Vivificate, e); else if ("string" == typeof e && o & l && (e = {
                    string: e
                }), e?.[Symbol.iterator]) {
                    if ((e = ve(e)).length !== n) throw new ArrayLengthMismatch(t, this, e);
                    let i = 0;
                    for (const t of e) h.call(this, i++, t, r);
                } else if (e && "object" == typeof e) {
                    if (0 === c.call(this, e)) throw new InvalidArrayInitializer(t, e);
                } else if (void 0 !== e) throw new InvalidArrayInitializer(t, e);
            };
            return e.$ = {
                get: Ee,
                set: g
            }, e.length = ce(n), e.entries = e[St] = this.defineArrayEntries(), o & u && (e.typedArray = this.defineTypedArray(t), 
            o & l && (e.string = this.defineString(t)), o & f && (e.clampedArray = this.defineClampedArray(t))), 
            e[Symbol.iterator] = this.defineArrayIterator(), e[Qt] = ce(g), e[ee] = this.defineFinalizerArray(a), 
            e[Yt] = o & i && this.defineVivificatorArray(t), e[Ht] = o & s && this.defineVisitorArray(), 
            d;
        },
        finalizeArray(t, e) {
            const {flags: n, instance: {members: [r]}} = t;
            e.child = ce(r.structure.constructor), e[mt] = n & a && this.defineSentinel(t);
        }
    }), Te({
        defineEnum(t, e) {
            const {instance: {members: [n]}} = t, r = this.defineMember(n), {get: i, set: s} = r, {get: o} = this.defineMember(n, !1), c = this.createApplier(t), a = [ "string", "number", "tagged union" ], l = this.createConstructor(t, {
                onCastError(t, e) {
                    throw new InvalidInitializer(t, a, e);
                }
            });
            return e.$ = r, e.toString = ce(Oe), e[Symbol.toPrimitive] = {
                value(t) {
                    switch (t) {
                      case "string":
                      case "default":
                        return this.$[ft];

                      default:
                        return o.call(this);
                    }
                }
            }, e[Qt] = ce((function(e) {
                if (e && "object" == typeof e) {
                    if (0 === c.call(this, e)) throw new InvalidInitializer(t, a, e);
                } else void 0 !== e && s.call(this, e);
            })), l;
        },
        finalizeEnum(t, e) {
            const {flags: n, constructor: r, instance: {members: [i]}, static: {members: s, template: o}} = t, c = o[at], {get: a, set: l} = this.defineMember(i, !1), u = {};
            for (const {name: t, flags: n, slot: r} of s) if (n & _) {
                const n = c[r];
                se(n, ft, ce(t));
                const i = a.call(n);
                e[t] = {
                    value: n,
                    writable: !1
                }, u[i] = n;
            }
            e[ne] = {
                value(t) {
                    if ("string" == typeof t) return r[t];
                    if ("number" == typeof t || "bigint" == typeof t) {
                        let e = u[t];
                        if (!e && n & M) {
                            e = new r(void 0), l.call(e, t);
                            const n = `${t}`;
                            se(e, ft, ce(n)), se(r, n, ce(e)), u[t] = e;
                        }
                        return e;
                    }
                    return t instanceof r ? t : t?.[pt] instanceof r && t[pt];
                }
            }, e[Pt] = ce(this.getTypedArray(t));
        },
        transformDescriptorEnum(t, e) {
            const {type: n, structure: r} = e;
            if (n === Z.Object) return t;
            const i = function(t) {
                const {constructor: e} = r, n = e(t);
                if (!n) throw new EnumExpected(r, t);
                return n;
            }, {get: s, set: o} = t;
            return {
                get: 0 === s.length ? function() {
                    const t = s.call(this);
                    return i(t);
                } : function(t) {
                    const e = s.call(this, t);
                    return i(e);
                },
                set: 1 === o.length ? function(t) {
                    t = i(t)[Symbol.toPrimitive](), o.call(this, t);
                } : function(t, e) {
                    const n = i(e);
                    o.call(this, t, n[Symbol.toPrimitive]());
                }
            };
        }
    }), Te({
        currentGlobalSet: void 0,
        currentErrorClass: void 0,
        defineErrorSet(t, n) {
            const {instance: {members: [r]}, flags: i} = t;
            if (!this.currentErrorClass) {
                this.currentErrorClass = class Error extends ZigErrorBase {};
                const t = {
                    type: e.ErrorSet,
                    name: "anyerror",
                    instance: {
                        members: [ r ]
                    },
                    static: {
                        members: [],
                        template: {
                            SLOTS: {}
                        }
                    }
                };
                this.currentGlobalSet = this.defineStructure(t), this.finalizeStructure(t);
            }
            if (this.currentGlobalSet && i & k) return this.currentGlobalSet;
            const s = this.defineMember(r), {set: o} = s, c = [ "string", "number" ], a = this.createApplier(t), l = this.createConstructor(t, {
                onCastError(t, e) {
                    throw new InvalidInitializer(t, c, e);
                }
            });
            return n.$ = s, n[Qt] = ce((function(e) {
                if (e instanceof l[gt]) o.call(this, e); else if (e && "object" == typeof e && !Ne(e)) {
                    if (0 === a.call(this, e)) throw new InvalidInitializer(t, c, e);
                } else void 0 !== e && o.call(this, e);
            })), l;
        },
        finalizeErrorSet(t, e) {
            const {constructor: n, flags: r, instance: {members: [i]}, static: {members: s, template: o}} = t;
            if (this.currentGlobalSet && r & k) return !1;
            const c = o?.[at] ?? {}, {get: a} = this.defineMember(i, !1);
            for (const {name: t, slot: n} of s) {
                const r = c[n], i = a.call(r);
                let s = this.currentGlobalSet[i], o = !0;
                s || (s = new this.currentErrorClass(t, i), o = !1);
                const l = ce(s), u = String(s);
                e[t] = e[u] = e[i] = l, o || (oe(this.currentGlobalSet, {
                    [i]: l,
                    [u]: l,
                    [t]: l
                }), this.currentGlobalSet[bt].push(t));
            }
            e[ne] = {
                value: t => "number" == typeof t || "string" == typeof t ? n[t] : t instanceof n[gt] ? n[Number(t)] : Ne(t) ? n[`Error: ${t.error}`] : t instanceof Error && void 0
            }, e[gt] = ce(this.currentErrorClass);
        },
        transformDescriptorErrorSet(t, e) {
            const {type: n, structure: r} = e;
            if (n === Z.Object) return t;
            const i = function(t) {
                const {constructor: e} = r, n = e(t);
                if (!n) throw t instanceof Error ? new NotInErrorSet(r) : new ErrorExpected(r, t);
                return n;
            }, {get: s, set: o} = t;
            return {
                get: 0 === s.length ? function() {
                    const t = s.call(this);
                    return i(t);
                } : function(t) {
                    const e = s.call(this, t);
                    return i(e);
                },
                set: 1 === o.length ? function(t) {
                    const e = i(t);
                    t = Number(e), o.call(this, t);
                } : function(t, e) {
                    const n = i(e);
                    e = Number(n), o.call(this, t, e);
                }
            };
        },
        resetGlobalErrorSet() {
            this.currentErrorClass = this.currentGlobalSet = void 0;
        }
    });
    class ZigErrorBase extends Error {
        constructor(t, e) {
            super(function(t) {
                let e = t.replace(/_/g, " ");
                try {
                    e = e.replace(/(\p{Uppercase}+)(\p{Lowercase}*)/gu, ((t, e, n) => 1 === e.length ? ` ${e.toLocaleLowerCase()}${n}` : n ? t : ` ${e}`)).trimStart();
                } catch (t) {}
                return e.charAt(0).toLocaleUpperCase() + e.substring(1);
            }(t)), this.number = e, this.stack = void 0;
        }
        [Symbol.toPrimitive](t) {
            switch (t) {
              case "string":
              case "default":
                return Error.prototype.toString.call(this, t);

              default:
                return this.number;
            }
        }
        toJSON() {
            return {
                error: this.message
            };
        }
    }
    function An(t, e) {
        return Ie(t?.constructor?.child, e) && t["*"];
    }
    function In(t, e, n) {
        if (n & E) {
            if (t?.constructor?.child?.child === e.child && t["*"]) return !0;
            if (n & O && An(t, e.child)) return !0;
        }
        return !1;
    }
    Te({
        defineErrorUnion(t, e) {
            const {instance: {members: [n, r]}, flags: o} = t, {get: c, set: a} = this.defineMember(n), {get: l, set: u} = this.defineMember(r), {get: f, set: h} = this.defineMember(r, !1), d = n.type === Z.Void, g = r.structure.constructor, p = function() {
                this[Wt](), this[Ht]?.("clear");
            }, b = this.createApplier(t), y = function(e, n) {
                if (Me(e, v)) this[Xt](e), o & s && (f.call(this) || this[Ht]("copy", 0, e)); else if (e instanceof g[gt] && g(e)) u.call(this, e), 
                p.call(this); else if (void 0 !== e || d) try {
                    a.call(this, e, n), h.call(this, 0);
                } catch (n) {
                    if (e instanceof Error) {
                        const n = g[e] ?? g.Unexpected;
                        if (!n) throw new NotInErrorSet(t);
                        u.call(this, n), p.call(this);
                    } else if (Ne(e)) u.call(this, e), p.call(this); else {
                        if (!e || "object" != typeof e) throw n;
                        if (0 === b.call(this, e)) throw n;
                    }
                }
            }, {bitOffset: m, byteSize: w} = n, v = this.createConstructor(t);
            return e.$ = {
                get: function() {
                    if (f.call(this)) throw l.call(this);
                    return c.call(this);
                },
                set: y
            }, e[Qt] = ce(y), e[Yt] = o & i && this.defineVivificatorStruct(t), e[Wt] = this.defineResetter(m / 8, w), 
            e[Ht] = o & s && this.defineVisitorErrorUnion(n, f), v;
        }
    }), Te({
        defineFunction(t, n) {
            const {instance: {members: [r], template: i}, static: {template: s}} = t, o = new ObjectCache, {structure: {constructor: c}} = r, a = this, l = function(n) {
                const r = this instanceof l;
                let u, f;
                if (r) {
                    if (0 === arguments.length) throw new NoInitializer(t);
                    if ("function" != typeof n) throw new TypeMismatch("function", n);
                    if (c[ht] === e.VariadicStruct || !s) throw new Unsupported;
                    u = a.getFunctionThunk(n, s);
                } else {
                    if (this !== Bt) throw new NoCastingToFunction;
                    u = n;
                }
                if (f = o.find(u)) return f;
                const h = c.prototype.length, d = r ? a.createInboundCaller(n, c) : a.createOutboundCaller(i, c);
                return oe(d, {
                    length: ce(h),
                    name: ce(r ? n.name : "")
                }), Object.setPrototypeOf(d, l.prototype), d[ct] = u, o.save(u, d), d;
            };
            return Object.setPrototypeOf(l.prototype, Function.prototype), n.valueOf = n.toJSON = ce(Ve), 
            l;
        },
        finalizeFunction(t, e, n) {
            n[Symbol.toStringTag] = void 0;
        }
    }), Te({
        defineOpaque(t, e) {
            const {flags: n} = t, r = () => {
                throw new AccessingOpaque(t);
            }, i = this.createConstructor(t);
            return e.$ = {
                get: r,
                set: r
            }, e[Symbol.iterator] = n & F && this.defineZigIterator(), e[Symbol.toPrimitive] = {
                value(e) {
                    const {name: n} = t;
                    return `[opaque ${n}]`;
                }
            }, e[Qt] = ce((() => {
                throw new CreatingOpaque(t);
            })), i;
        }
    }), Te({
        defineOptional(t, e) {
            const {instance: {members: [n, r]}, flags: o} = t, {get: c, set: a} = this.defineMember(n), {get: l, set: u} = this.defineMember(r), f = n.type === Z.Void, h = function(t, e) {
                Me(t, d) ? (this[Xt](t), o & s && l.call(this) && this[Ht]("copy", rt.Vivificate, t)) : null === t ? (u.call(this, 0), 
                this[Wt]?.(), this[Ht]?.("clear")) : (void 0 !== t || f) && (a.call(this, t, e), 
                o & x ? u.call(this, 1) : o & s && (l.call(this) || u.call(this, 13)));
            }, d = t.constructor = this.createConstructor(t), {bitOffset: g, byteSize: p} = n;
            return e.$ = {
                get: function() {
                    return l.call(this) ? c.call(this) : (this[Ht]?.("clear"), null);
                },
                set: h
            }, e[Qt] = ce(h), e[Wt] = o & x && this.defineResetter(g / 8, p), e[Yt] = o & i && this.defineVivificatorStruct(t), 
            e[Ht] = o & s && this.defineVisitorOptional(n, l), d;
        }
    }), Te({
        definePointer(t, n) {
            const {flags: i, byteSize: s, instance: {members: [o]}} = t, {structure: a} = o, {type: l, flags: u, byteSize: f = 1} = a, h = i & V ? s / 2 : s, {get: d, set: g} = this.defineMember({
                type: Z.Uint,
                bitOffset: 0,
                bitSize: 8 * h,
                byteSize: h,
                structure: {
                    byteSize: h
                }
            }), {get: p, set: b} = i & V ? this.defineMember({
                type: Z.Uint,
                bitOffset: 8 * h,
                bitSize: 8 * h,
                byteSize: h,
                structure: {
                    flags: c,
                    byteSize: h
                }
            }) : {}, y = function(t, n = !0, r = !0) {
                if (n || this[ct][ut]) {
                    if (!r) return this[at][0] = void 0;
                    {
                        const n = U.child, r = d.call(this), s = i & V ? p.call(this) : l === e.Slice && u & T ? M.findSentinel(r, n[mt].bytes) + 1 : 1;
                        if (r !== this[Vt] || s !== this[Et]) {
                            const e = M.findMemory(t, r, s, n[$t]), o = e ? n.call(Bt, e) : null;
                            return this[at][0] = o, this[Vt] = r, this[Et] = s, i & V && (this[At] = null), 
                            o;
                        }
                    }
                }
                return this[at][0];
            }, m = function(t) {
                g.call(this, t), this[Vt] = t;
            }, w = u & T ? 1 : 0, v = i & V || u & T ? function(t) {
                b?.call?.(this, t - w), this[Et] = t;
            } : null, S = function() {
                const t = this[yt] ?? this, e = !t[at][0], n = y.call(t, null, e);
                if (!n) {
                    if (i & $) return null;
                    throw new NullPointer;
                }
                return i & C ? xn(n) : n;
            }, A = u & r ? function() {
                return S.call(this).$;
            } : S, I = i & C ? ke : function(t) {
                return S.call(this).$ = t;
            }, M = this, x = function(n, r) {
                const s = a.constructor;
                if (An(n, s)) {
                    if (!(i & C) && n.constructor.const) throw new ConstantConstraint(t, n);
                    n = n[at][0];
                } else if (i & E) In(n, s, i) && (n = s(n[at][0][ct])); else if (l === e.Slice && u & j && n) if (n.constructor[ht] === e.Pointer) n = n[vt]?.[ct]; else if (n[ct]) n = n[ct]; else if (n?.buffer instanceof ArrayBuffer && !(n instanceof Uint8Array || n instanceof DataView)) {
                    const {byteOffset: t, byteLength: e} = n;
                    void 0 !== t && void 0 !== e && (n = new DataView(n.buffer, t, e));
                }
                if (n instanceof s) {
                    const e = n[zt];
                    if (e) {
                        if (!(i & C)) throw new ReadOnlyTarget(t);
                        n = e;
                    }
                } else if (Me(n, s)) n = s.call(Bt, n[ct]); else if (i & O && i & E && n instanceof s.child) n = s(n[ct]); else if (function(t, e) {
                    const n = t?.[Symbol.toStringTag];
                    if (n) {
                        const r = e[Pt];
                        if (r) switch (n) {
                          case r.name:
                          case "DataView":
                            return !0;

                          case "ArrayBuffer":
                            return r === Uint8Array || r === Int8Array;

                          case "Uint8ClampedArray":
                            return r === Uint8Array;
                        }
                        if (e.child && void 0 !== Se(t, e.child)) return !0;
                    }
                    return !1;
                }(n, s)) {
                    n = s(M.extractView(a, n));
                } else if (null == n || n[ct]) {
                    if (!(void 0 === n || i & $ && null === n)) throw new InvalidPointerTarget(t, n);
                } else {
                    if (i & O && i & E && "object" == typeof n && !n[Symbol.iterator]) {
                        let t = !0;
                        const e = s.prototype[Nt];
                        for (const r of Object.keys(n)) {
                            const n = e[r];
                            if (n?.special) {
                                t = !1;
                                break;
                            }
                        }
                        t && (n = [ n ]);
                    }
                    if (Pt in s && n?.buffer && n[Symbol.iterator]) throw new InvalidPointerTarget(t, n);
                    n = new s(n, {
                        allocator: r
                    });
                }
                const o = n?.[ct]?.[ut];
                if (-1 === o?.address) throw new PreviouslyFreed(n);
                this[vt] = n;
            }, U = this.createConstructor(t);
            return n["*"] = {
                get: A,
                set: I
            }, n.$ = {
                get: Ee,
                set: x
            }, n.length = {
                get: function() {
                    const t = S.call(this);
                    return t ? t.length : 0;
                },
                set: function(t) {
                    t |= 0;
                    const e = S.call(this);
                    if (!e) {
                        if (0 !== t) throw new InvalidSliceLength(t, 0);
                        return;
                    }
                    if (e.length === t) return;
                    const n = e[ct], r = n[ut];
                    let s;
                    if (!r) if (i & V) this[At] ||= e.length, s = this[At]; else {
                        s = (n.buffer.byteLength - n.byteOffset) / f | 0;
                    }
                    if (t < 0 || t > s) throw new InvalidSliceLength(t, s);
                    const o = t * f, c = r ? M.obtainZigView(r.address, o) : M.obtainView(n.buffer, n.byteOffset, o), l = a.constructor;
                    this[at][0] = l.call(Bt, c), v?.call?.(this, t);
                }
            }, n.slice = l === e.Slice && {
                value(t, e) {
                    const n = this[vt].slice(t, e);
                    return new U(n);
                }
            }, n.subarray = l === e.Slice && {
                value(t, e, n) {
                    const r = this[vt].subarray(t, e, n);
                    return new U(r);
                }
            }, n[Symbol.toPrimitive] = l === e.Primitive && {
                value(t) {
                    return this[vt][Symbol.toPrimitive](t);
                }
            }, n[Qt] = ce(x), n[ee] = {
                value() {
                    const t = l !== e.Pointer ? Vn : {};
                    let n;
                    l === e.Function ? (n = function() {}, n[ct] = this[ct], n[at] = this[at], Object.setPrototypeOf(n, U.prototype)) : n = this;
                    const r = new Proxy(n, t);
                    return Object.defineProperty(n, Ot, {
                        value: r
                    }), r;
                }
            }, n[vt] = {
                get: S,
                set: function(t) {
                    if (void 0 === t) return;
                    const e = this[yt] ?? this;
                    if (t) {
                        const n = t[ct][ut];
                        if (n) {
                            const {address: e, js: r} = n;
                            m.call(this, e), v?.call?.(this, t.length), r && (t[ct][ut] = void 0);
                        } else if (e[ct][ut]) throw new ZigMemoryTargetRequired;
                    } else e[ct][ut] && (m.call(this, 0), v?.call?.(this, 0));
                    e[at][0] = t ?? null, i & V && (e[At] = null);
                }
            }, n[_t] = ce(y), n[Mt] = {
                set: m
            }, n[xt] = {
                set: v
            }, n[Ht] = this.defineVisitor(), n[Vt] = ce(0), n[Et] = ce(0), n[At] = i & V && ce(null), 
            n.dataView = n.base64 = void 0, U;
        },
        finalizePointer(t, n) {
            const {flags: r, constructor: i, instance: {members: [s]}} = t, {structure: o} = s, {type: c, constructor: a} = o;
            n.child = a ? ce(a) : {
                get: () => o.constructor
            }, n.const = ce(!!(r & C)), n[ne] = {
                value(n, s) {
                    if (this === Bt || this === lt || n instanceof i) return !1;
                    if (An(n, a)) return new i(a(n["*"]), s);
                    if (In(n, a, r)) return new i(n);
                    if (c === e.Slice) return new i(a(n), s);
                    throw new NoCastingToPointer(t);
                }
            };
        }
    });
    const Mn = new WeakMap;
    function xn(t) {
        let e = Mn.get(t);
        if (!e) {
            const n = t[yt];
            e = n ? new Proxy(n, En) : new Proxy(t, On), Mn.set(t, e);
        }
        return e;
    }
    const Vn = {
        get(t, e) {
            if (e === yt) return t;
            if (e in t) return t[e];
            return t[vt][e];
        },
        set(t, e, n) {
            if (e in t) t[e] = n; else {
                t[vt][e] = n;
            }
            return !0;
        },
        deleteProperty(t, e) {
            if (e in t) delete t[e]; else {
                delete t[vt][e];
            }
            return !0;
        },
        has(t, e) {
            if (e in t) return !0;
            return e in t[vt];
        },
        apply: (t, e, n) => t["*"].apply(e, n)
    }, En = {
        ...Vn,
        set(t, e, n) {
            if (e in t) ke(); else {
                t[vt][e] = n;
            }
            return !0;
        }
    }, On = {
        get(t, e) {
            if (e === zt) return t;
            {
                const n = t[e];
                return n?.[ct] ? xn(n) : n;
            }
        },
        set(t, e, n) {
            ke();
        }
    };
    function Cn() {
        return this[xt];
    }
    function $n(t, e) {
        return (t |= 0) < 0 ? (t = e + t) < 0 && (t = 0) : t > e && (t = e), t;
    }
    function Tn() {
        throw new InaccessiblePointer;
    }
    function Un() {
        const t = {
            get: Tn,
            set: Tn
        };
        oe(this[yt], {
            "*": t,
            $: t,
            [yt]: t,
            [vt]: t
        });
    }
    function zn(t, e, n, r) {
        let i, s = this[at][t];
        if (!s) {
            if (n & rt.IgnoreUncreated) return;
            s = this[Yt](t);
        }
        r && (i = r[at][t], !i) || s[Ht](e, n, i);
    }
    Te({
        definePrimitive(t, e) {
            const {instance: {members: [n]}} = t, r = this.createApplier(t), {get: i, set: s} = this.defineMember(n), o = function(e) {
                if (Me(e, c)) this[Xt](e); else if (e && "object" == typeof e) {
                    if (0 === r.call(this, e)) {
                        const r = le(n);
                        throw new InvalidInitializer(t, r, e);
                    }
                } else void 0 !== e && s.call(this, e);
            }, c = this.createConstructor(t);
            return e.$ = {
                get: i,
                set: o
            }, e[Qt] = ce(o), e[Symbol.toPrimitive] = ce(i), c;
        },
        finalizePrimitive(t, e) {
            const {instance: {members: [n]}} = t;
            e[Tt] = ce(n.bitSize), e[kt] = ce(n.type);
        }
    }), Te({
        defineSlice(t, e) {
            const {align: n, flags: r, byteSize: o, name: c, instance: {members: [a]}} = t, {byteSize: l, structure: u} = a, f = this, h = function(t, e, r) {
                t || (t = f.allocateMemory(e * l, n, r)), this[ct] = t, this[xt] = e;
            }, d = function(e, n) {
                if (n !== this[xt]) throw new ArrayLengthMismatch(t, this, e);
            }, g = this.defineMember(a), {set: p} = g, b = this.createApplier(t), y = function(e, n) {
                if (Me(e, w)) this[ct] ? d.call(this, e, e.length) : h.call(this, null, e.length, n), 
                this[Xt](e), r & s && this[Ht]("copy", rt.Vivificate, e); else if ("string" == typeof e && r & U) y.call(this, {
                    string: e
                }, n); else if (e?.[Symbol.iterator]) {
                    e = ve(e), this[ct] ? d.call(this, e, e.length) : h.call(this, null, e.length, n);
                    let t = 0;
                    for (const r of e) w[mt]?.validateValue(r, t, e.length), p.call(this, t++, r, n);
                } else if ("number" == typeof e) {
                    if (!(!this[ct] && e >= 0 && isFinite(e))) throw new InvalidArrayInitializer(t, e, !this[ct]);
                    h.call(this, null, e, n);
                } else if (e && "object" == typeof e) {
                    if (0 === b.call(this, e, n)) throw new InvalidArrayInitializer(t, e);
                } else if (void 0 !== e) throw new InvalidArrayInitializer(t, e);
            }, m = function(t, e) {
                const n = this[xt], r = this[ct];
                t = void 0 === t ? 0 : $n(t, n), e = void 0 === e ? n : $n(e, n);
                const i = t * l, s = e * l - i;
                return f.obtainView(r.buffer, r.byteOffset + i, s);
            }, w = this.createConstructor(t);
            return e.$ = {
                get: Ee,
                set: y
            }, e.length = {
                get: Cn
            }, r & z && (e.typedArray = this.defineTypedArray(t), r & U && (e.string = this.defineString(t)), 
            r & B && (e.clampedArray = this.defineClampedArray(t))), e.entries = e[St] = this.defineArrayEntries(), 
            e.subarray = {
                value(t, e) {
                    const n = m.call(this, t, e);
                    return w(n);
                }
            }, e.slice = {
                value(t, e, r = {}) {
                    const {zig: i = !1} = r, s = m.call(this, t, e), o = f.allocateMemory(s.byteLength, n, i), c = w(o);
                    return c[Xt]({
                        [ct]: s
                    }), c;
                }
            }, e[Symbol.iterator] = this.defineArrayIterator(), e[Kt] = ce(h), e[Xt] = this.defineCopier(o, !0), 
            e[Qt] = ce(y), e[ee] = this.defineFinalizerArray(g), e[Yt] = r & i && this.defineVivificatorArray(t), 
            e[Ht] = r & s && this.defineVisitorArray(), w;
        },
        finalizeSlice(t, e) {
            const {flags: n, instance: {members: [r]}} = t;
            e.child = ce(r.structure.constructor), e[mt] = n & T && this.defineSentinel(t);
        }
    }), Te({
        defineVivificatorStruct(t) {
            const {instance: {members: e}} = t, n = {};
            for (const t of e.filter((t => t.type === Z.Object))) n[t.slot] = t;
            const r = this;
            return {
                value(t) {
                    const e = n[t], {bitOffset: i, byteSize: s, structure: {constructor: o}} = e, c = this[ct], a = c.byteOffset + (i >> 3);
                    let l = s;
                    if (void 0 === l) {
                        if (7 & i) throw new NotOnByteBoundary(e);
                        l = e.bitSize >> 3;
                    }
                    const u = r.obtainView(c.buffer, a, l);
                    return this[at][t] = o.call(lt, u);
                }
            };
        }
    }), Te({
        defineStruct(t, e) {
            const {flags: n, length: r, instance: {members: o}} = t, c = o.find((t => t.flags & Y)), a = c && this.defineMember(c), l = this.createApplier(t), u = function(e, r) {
                if (Me(e, f)) this[Xt](e), n & s && this[Ht]("copy", 0, e); else if (e && "object" == typeof e) l.call(this, e, r); else if ("number" != typeof e && "bigint" != typeof e || !a) {
                    if (void 0 !== e) throw new InvalidInitializer(t, "object", e);
                } else a.set.call(this, e);
            }, f = this.createConstructor(t), p = e[Nt].value, b = e[It].value, y = [];
            for (const t of o.filter((t => !!t.name))) {
                const {name: n, flags: r} = t, {set: i} = e[n] = this.defineMember(t);
                i && (r & q && (i.required = !0), p[n] = i, b.push(n)), y.push(n);
            }
            return e.$ = {
                get: Ve,
                set: u
            }, e.length = ce(r), e.entries = n & d && this.defineVectorEntries(), e[Symbol.toPrimitive] = a && {
                value(t) {
                    return "string" === t ? Object.prototype.toString.call(this) : a.get.call(this);
                }
            }, e[Symbol.iterator] = n & h ? this.defineZigIterator() : n & d ? this.defineVectorIterator() : this.defineStructIterator(), 
            e[Qt] = ce(u), e[Yt] = n & i && this.defineVivificatorStruct(t), e[Ht] = n & s && this.defineVisitorStruct(o), 
            e[St] = n & d ? this.defineVectorEntries() : this.defineStructEntries(), e[bt] = ce(y), 
            n & g && (e.alloc = this.defineAlloc(), e.free = this.defineFree(), e.dupe = this.defineDupe()), 
            f;
        }
    }), Te({
        defineUnion(t, e) {
            const {flags: n, instance: {members: r}} = t, o = !!(n & v), c = o ? r.slice(0, -1) : r, a = o ? r[r.length - 1] : null, {get: l, set: u} = this.defineMember(a), {get: f} = this.defineMember(a, !1), h = n & S ? function() {
                return l.call(this)[ft];
            } : function() {
                const t = l.call(this);
                return c[t].name;
            }, d = n & S ? function(t) {
                const {constructor: e} = a.structure;
                u.call(this, e[t]);
            } : function(t) {
                const e = c.findIndex((e => e.name === t));
                u.call(this, e);
            }, g = this.createApplier(t), p = function(e, r) {
                if (Me(e, b)) this[Xt](e), n & s && this[Ht]("copy", rt.Vivificate, e); else if (e && "object" == typeof e) {
                    let n = 0;
                    for (const t of M) t in e && n++;
                    if (n > 1) throw new MultipleUnionInitializers(t);
                    if (0 === g.call(this, e, r)) throw new MissingUnionInitializer(t, e, o);
                } else if (void 0 !== e) throw new InvalidInitializer(t, "object with a single property", e);
            }, b = this.createConstructor(t), y = {}, m = e[Nt].value, w = e[It].value, M = [];
            for (const r of c) {
                const {name: i} = r, {get: s, set: c} = this.defineMember(r), a = o ? function() {
                    const e = h.call(this);
                    if (i !== e) {
                        if (n & S) return null;
                        throw new InactiveUnionProperty(t, i, e);
                    }
                    return this[Ht]?.("clear"), s.call(this);
                } : s, l = o && c ? function(e) {
                    const n = h.call(this);
                    if (i !== n) throw new InactiveUnionProperty(t, i, n);
                    c.call(this, e);
                } : c, u = o && c ? function(t) {
                    d.call(this, i), c.call(this, t), this[Ht]?.("clear");
                } : c;
                e[i] = {
                    get: a,
                    set: l
                }, m[i] = u, y[i] = s, w.push(i), M.push(i);
            }
            e.$ = {
                get: function() {
                    return this;
                },
                set: p
            }, e[Symbol.iterator] = n & I ? this.defineZigIterator() : this.defineUnionIterator(), 
            e[Symbol.toPrimitive] = n & S && {
                value(t) {
                    switch (t) {
                      case "string":
                      case "default":
                        return h.call(this);

                      default:
                        return f.call(this);
                    }
                }
            };
            const {comptime: x} = this;
            return e[te] = n & A && {
                value() {
                    return x || this[Ht](Un), this[Ht] = Ce, this;
                }
            }, e[Qt] = ce(p), e[pt] = n & S && {
                get: l,
                set: u
            }, e[Yt] = n & i && this.defineVivificatorStruct(t), e[Ht] = n & s && this.defineVisitorUnion(c, n & S ? f : null), 
            e[St] = this.defineUnionEntries(), e[bt] = n & S ? {
                get() {
                    return [ h.call(this) ];
                }
            } : ce(M), e[Ft] = ce(y), b;
        },
        finalizeUnion(t, e) {
            const {flags: n, instance: {members: r}} = t;
            n & S && (e.tag = ce(r[r.length - 1].structure.constructor));
        }
    }), Te({
        defineVariadicStruct(t, e) {
            const {byteSize: n, align: r, flags: s, length: o, instance: {members: c}} = t, a = this, l = c.slice(1);
            for (const t of c) e[t.name] = this.defineMember(t);
            const u = e.retval.set, f = function(t) {
                this[ct] = a.allocateMemory(8 * t, 4), this.length = t, this.littleEndian = a.littleEndian;
            };
            return oe(f, {
                [Ut]: {
                    value: 4
                }
            }), oe(f.prototype, {
                set: ce((function(t, e, n, r, i) {
                    const s = this[ct], o = a.littleEndian;
                    s.setUint16(8 * t, e, o), s.setUint16(8 * t + 2, n, o), s.setUint16(8 * t + 4, r, o), 
                    s.setUint8(8 * t + 6, i == Z.Float), s.setUint8(8 * t + 7, i == Z.Int || i == Z.Float);
                }))
            }), e[Yt] = s & i && this.defineVivificatorStruct(t), e[Ht] = this.defineVisitorVariadicStruct(c), 
            e[re] = ce((function(t) {
                u.call(this, t, this[Zt]);
            })), function(t) {
                if (t.length < o) throw new ArgumentCountMismatch(o, t.length, !0);
                let e = n, i = r;
                const s = t.slice(o), c = {};
                for (const [t, n] of s.entries()) {
                    const r = n?.[ct], s = n?.constructor?.[Ut];
                    if (!r || !s) {
                        throw Be(new InvalidVariadicArgument, o + t);
                    }
                    s > i && (i = s);
                    e = (c[t] = e + (s - 1) & ~(s - 1)) + r.byteLength;
                }
                const u = new f(t.length), h = a.allocateMemory(e, i);
                h[Ut] = i, this[ct] = h, this[at] = {}, a.copyArguments(this, t, l);
                let d = -1;
                for (const [t, {bitOffset: e, bitSize: n, type: r, slot: i, structure: {align: s}}] of l.entries()) u.set(t, e / 8, n, s, r), 
                i > d && (d = i);
                for (const [t, e] of s.entries()) {
                    const n = d + t + 1, {byteLength: r} = e[ct], i = c[t], s = a.obtainView(h.buffer, i, r), l = this[at][n] = e.constructor.call(lt, s), f = e.constructor[Tt] ?? 8 * r, g = e.constructor[Ut], p = e.constructor[kt];
                    l.$ = e, u.set(o + t, i, f, g, p);
                }
                this[jt] = u;
            };
        },
        finalizeVariadicStruct(t, e) {
            const {flags: n} = t;
            e[Lt] = ce(!!(n & D)), e[Ut] = ce(void 0);
        }
    }), Te({
        defineVector(t, e) {
            const {flags: n, length: r, instance: {members: [o]}} = t, c = this.createApplier(t), a = function(e) {
                if (Me(e, l)) this[Xt](e), n & s && this[Ht]("copy", rt.Vivificate, e); else if (e?.[Symbol.iterator]) {
                    let n = e.length;
                    if ("number" != typeof n && (n = (e = [ ...e ]).length), n !== r) throw new ArrayLengthMismatch(t, this, e);
                    let i = 0;
                    for (const t of e) this[i++] = t;
                } else if (e && "object" == typeof e) {
                    if (0 === c.call(this, e)) throw new InvalidArrayInitializer(t, e);
                } else if (void 0 !== e) throw new InvalidArrayInitializer(t, e);
            }, l = this.createConstructor(t, {
                initializer: a
            }), {bitSize: u} = o;
            for (let t = 0, i = 0; t < r; t++, i += u) e[t] = n & s ? this.defineMember({
                ...o,
                slot: t
            }) : this.defineMember({
                ...o,
                bitOffset: i
            });
            return e.$ = {
                get: Ve,
                set: a
            }, e.length = ce(r), n & N && (e.typedArray = this.defineTypedArray(t), n & P && (e.clampedArray = this.defineClampedArray(t))), 
            e.entries = e[St] = this.defineVectorEntries(), e[Symbol.iterator] = this.defineVectorIterator(), 
            e[Qt] = ce(a), e[Yt] = n & i && this.defineVivificatorArray(t), e[Ht] = n & s && this.defineVisitorArray(), 
            l;
        },
        finalizeVector(t, e) {
            const {instance: {members: [n]}} = t;
            e.child = ce(n.structure.constructor);
        }
    }), Te({
        defineVisitor: () => ({
            value(t, e, n) {
                let r;
                r = "string" == typeof t ? Bn[t] : t, r.call(this, e, n);
            }
        })
    });
    const Bn = {
        copy(t, e) {
            const n = e[at][0];
            if (this[ct][ut] && n && !n[ct][ut]) throw new ZigMemoryTargetRequired;
            this[at][0] = n;
        },
        clear(t) {
            t & rt.IsInactive && (this[at][0] = void 0);
        },
        reset() {
            this[at][0] = void 0, this[Vt] = void 0;
        }
    };
    return Te({
        defineVisitorArgStruct(t) {
            const e = [];
            let n;
            for (const [r, {slot: i, structure: o}] of t.entries()) o.flags & s && (0 === r ? n = i : e.push(i));
            return {
                value(t, r, i) {
                    if (!(r & rt.IgnoreArguments) && e.length > 0) for (const n of e) zn.call(this, n, t, r | rt.IsImmutable, i);
                    r & rt.IgnoreRetval || void 0 === n || zn.call(this, n, t, r, i);
                }
            };
        }
    }), Te({
        defineVisitorArray: () => ({
            value(t, e, n) {
                for (let r = 0, i = this.length; r < i; r++) zn.call(this, r, t, e, n);
            }
        })
    }), Te({
        defineVisitorErrorUnion(t, e) {
            const {slot: n} = t;
            return {
                value(t, r, i) {
                    e.call(this) && (r |= rt.IsInactive), r & rt.IsInactive && r & rt.IgnoreInactive || zn.call(this, n, t, r, i);
                }
            };
        }
    }), Te({
        defineVisitorOptional(t, e) {
            const {slot: n} = t;
            return {
                value(t, r, i) {
                    e.call(this) || (r |= rt.IsInactive), r & rt.IsInactive && r & rt.IgnoreInactive || zn.call(this, n, t, r, i);
                }
            };
        }
    }), Te({
        defineVisitorStruct(t) {
            const e = t.filter((t => t.structure?.flags & s)).map((t => t.slot));
            return {
                value(t, n, r) {
                    for (const i of e) zn.call(this, i, t, n, r);
                }
            };
        }
    }), Te({
        defineVisitorUnion(t, e) {
            const n = [];
            for (const [e, {slot: r, structure: i}] of t.entries()) i?.flags & s && n.push({
                index: e,
                slot: r
            });
            return {
                value(t, r, i) {
                    const s = e?.call(this);
                    for (const {index: e, slot: o} of n) {
                        let n = r;
                        e !== s && (n |= rt.IsInactive), n & rt.IsInactive && n & rt.IgnoreInactive || zn.call(this, o, t, n, i);
                    }
                }
            };
        }
    }), Te({
        defineVisitorVariadicStruct(t) {
            const e = t[0], n = e.structure.flags & s ? e.slot : void 0;
            return {
                value(t, e, r) {
                    if (!(e & rt.IgnoreArguments)) for (const [i, s] of Object.entries(this[at])) i !== n && Ht in s && zn.call(this, i, t, e | rt.IsImmutable, r);
                    e & rt.IgnoreRetval || void 0 === n || zn.call(this, n, t, e, r);
                }
            };
        }
    }), t.createEnvironment = function() {
        try {
            return new (Ue());
        } catch (t) {
            throw console.error(t), t;
        }
    }, t;
}({}))
