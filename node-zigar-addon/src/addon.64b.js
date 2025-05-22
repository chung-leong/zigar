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
    }, n = Object.keys(e), r = 1, i = 2, s = 4, o = 8, c = 16, a = 16, l = 32, u = 64, f = 128, h = {
        IsExtern: 16,
        IsPacked: 32,
        IsIterator: 64,
        IsTuple: 128,
        IsAllocator: 256,
        IsPromise: 512,
        IsGenerator: 1024,
        IsAbortSignal: 2048,
        IsOptional: 4096,
        IsReader: 8192,
        IsWriter: 16384
    }, d = 16, g = 32, p = 64, b = 512, y = 16, m = 16, w = 16, v = 32, S = 64, I = 128, A = 256, x = 16, M = 32, V = 64, E = 128, O = 256, C = 16, $ = 16, T = 16, U = 32, z = 16, B = 32, F = 64, j = {
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
    }, k = Object.keys(j), N = 1, P = 2, L = 4, D = 16, R = 64, Z = 128, J = 0, q = 1, G = 2, _ = 1, W = 2, Y = 4, H = {
        IsInactive: 1,
        IsImmutable: 2,
        IgnoreUncreated: 4,
        IgnoreInactive: 8,
        IgnoreArguments: 16,
        IgnoreRetval: 32
    }, X = globalThis[Symbol.for("ZIGAR")] ||= {};
    function K(t) {
        return X[t] ||= Symbol(t);
    }
    function Q(t) {
        return K(t);
    }
    const tt = Q("memory"), et = Q("slots"), nt = Q("parent"), rt = Q("zig"), it = Q("name"), st = Q("type"), ot = Q("flags"), ct = Q("class"), at = Q("tag"), lt = Q("props"), ut = Q("pointer"), ft = Q("sentinel"), ht = Q("array"), dt = Q("target"), gt = Q("entries"), pt = Q("max length"), bt = Q("keys"), yt = Q("address"), mt = Q("length"), wt = Q("last address"), vt = Q("last length"), St = Q("proxy"), It = Q("cache"), At = Q("size"), xt = Q("bit size"), Mt = Q("align"), Vt = Q("const target"), Et = Q("environment"), Ot = Q("attributes"), Ct = Q("primitive"), $t = Q("getters"), Tt = Q("setters"), Ut = Q("typed array"), zt = Q("throwing"), Bt = Q("promise"), Ft = Q("generator"), jt = Q("allocator"), kt = Q("fallback"), Nt = Q("signature"), Pt = Q("string retval"), Lt = Q("update"), Dt = Q("reset"), Rt = Q("vivificate"), Zt = Q("visit"), Jt = Q("copy"), qt = Q("shape"), Gt = Q("initialize"), _t = Q("restrict"), Wt = Q("finalize"), Yt = Q("cast"), Ht = Q("return"), Xt = Q("yield");
    function Kt(t, e, n) {
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
    function Qt(t, e) {
        for (const [n, r] of Object.entries(e)) Kt(t, n, r);
        for (const n of Object.getOwnPropertySymbols(e)) {
            Kt(t, n, e[n]);
        }
        return t;
    }
    function te(t) {
        return void 0 !== t ? {
            value: t
        } : void 0;
    }
    function ee(t) {
        return "return" === t?.error ? t => {
            try {
                return t();
            } catch (t) {
                return t;
            }
        } : t => t();
    }
    function ne({type: t, bitSize: e}) {
        switch (t) {
          case j.Bool:
            return "boolean";

          case j.Int:
          case j.Uint:
            if (e > 32) return "bigint";

          case j.Float:
            return "number";
        }
    }
    function re(t, e = "utf-8") {
        const n = se[e] ||= new TextDecoder(e);
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
    function ie(t, e = "utf-8") {
        if ("utf-16" === e) {
            const {length: e} = t, n = new Uint16Array(e);
            for (let r = 0; r < e; r++) n[r] = t.charCodeAt(r);
            return n;
        }
        return (oe[e] ||= new TextEncoder).encode(t);
    }
    const se = {}, oe = {};
    function ce(t, e, n) {
        let r = 0, i = t.length;
        if (0 === i) return 0;
        for (;r < i; ) {
            const s = Math.floor((r + i) / 2);
            n(t[s]) <= e ? r = s + 1 : i = s;
        }
        return i;
    }
    const ae = function(t, e) {
        return !!e && !!(t & BigInt(e - 1));
    }, le = function(t, e) {
        return t + BigInt(e - 1) & ~BigInt(e - 1);
    }, ue = 0xFFFFFFFFFFFFFFFFn, fe = -1n, he = function(t) {
        return BigInt(t);
    }, de = function(t, e) {
        return t + BigInt(e);
    };
    function ge(t) {
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
    function pe(t, e) {
        const {constructor: n} = t;
        return n === e ? 1 : n.child === e ? t.length : void 0;
    }
    function be(t, e) {
        const n = [], r = new Map, i = t => {
            if (t && !r.get(t) && (r.set(t, !0), n.push(t), t[e])) for (const n of Object.values(t[e])) i(n);
        };
        for (const e of t) i(e.instance.template), i(e.static.template);
        return n;
    }
    function ye(t, e) {
        return t === e || t?.[Nt] === e[Nt] && t?.[Et] !== e?.[Et];
    }
    function me(t, e) {
        return t instanceof e || ye(t?.constructor, e);
    }
    function we({get: t, set: e}) {
        return t.special = e.special = !0, {
            get: t,
            set: e
        };
    }
    function ve() {
        return this;
    }
    function Se() {
        return this[St];
    }
    function Ie() {
        return String(this);
    }
    function Ae() {}
    class ObjectCache {
        map=new WeakMap;
        find(t) {
            return this.map.get(t);
        }
        save(t, e) {
            return this.map.set(t, e), e;
        }
    }
    const xe = {
        name: "",
        mixins: [],
        constructor: null
    };
    function Me(t) {
        return xe.constructor || xe.mixins.push(t), t;
    }
    function Ve() {
        return xe.constructor || (xe.constructor = function(t, e) {
            const n = [], r = function() {
                for (const t of n) t.call(this);
            }, {prototype: i} = r;
            Kt(r, "name", te(t));
            for (const t of e) for (let [e, r] of Object.entries(t)) if ("init" === e) n.push(r); else {
                if ("function" == typeof r) ; else {
                    let t = i[e];
                    if (void 0 !== t) if (t?.constructor === Object) r = Object.assign({
                        ...t
                    }, r); else if (t !== r) throw new Error(`Duplicate property: ${e}`);
                }
                Kt(i, e, te(r));
            }
            return r;
        }(xe.name, xe.mixins), xe.name = "", xe.mixins = []), xe.constructor;
    }
    function Ee(t, e, n) {
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
    Me({
        init() {
            this.accessorCache = new Map;
        },
        getAccessor(t, e) {
            const {type: n, bitSize: r, bitOffset: i, byteSize: s} = e, o = [], c = void 0 === s && (7 & r || 7 & i);
            c && o.push("Unaligned");
            let a = k[n];
            r > 32 && (n === j.Int || n === j.Uint) && (a = r <= 64 ? `Big${a}` : `Jumbo${a}`), 
            o.push(a, `${n === j.Bool && s ? 8 * s : r}`), c && o.push(`@${i}`);
            const l = t + o.join("");
            let u = DataView.prototype[l];
            if (u && this.usingBufferFallback()) {
                const e = this, i = u, s = function(t) {
                    const {buffer: e, byteOffset: n, byteLength: i} = this, s = e[kt];
                    if (s) {
                        if (t < 0 || t + r / 8 > i) throw new RangeError("Offset is outside the bounds of the DataView");
                        return s + he(n + t);
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
            return Kt(u, "name", te(l)), this.accessorCache.set(l, u), u;
        },
        imports: {
            getNumericValue: null,
            setNumericValue: null
        }
    }), Me({
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
    }), Me({
        getAccessorBigUint(t, e) {
            const {bitSize: n} = e, r = 2n ** BigInt(n) - 1n;
            return "get" === t ? function(t, e) {
                return this.getBigInt64(t, e) & r;
            } : function(t, e, n) {
                const i = e & r;
                this.setBigUint64(t, i, n);
            };
        }
    }), Me({
        getAccessorBool(t, e) {
            const {byteSize: n} = e, r = 8 * n, i = this.getAccessor(t, {
                type: j.Uint,
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
    }), Me({
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
    }), Me({
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
    }), Me({
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
    }), Me({
        getAccessorInt(t, e) {
            const {bitSize: n, byteSize: r} = e;
            if (r) {
                const e = this.getAccessor(t, {
                    type: j.Uint,
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
    }), Me({
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
    }), Me({
        getAccessorJumboUint(t, e) {
            const {bitSize: n} = e, r = this.getJumboAccessor(t, n), i = 2n ** BigInt(n) - 1n;
            return "get" === t ? function(t, e) {
                return r.call(this, t, e) & i;
            } : function(t, e, n) {
                const s = e & i;
                r.call(this, t, s, n);
            };
        }
    }), Me({
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
    }), Me({
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
    }), Me({
        getAccessorUnalignedBool1(t, e) {
            const {bitOffset: n} = e, r = 1 << (7 & n);
            return "get" === t ? function(t) {
                return !!(this.getInt8(t) & r);
            } : function(t, e) {
                const n = this.getInt8(t), i = e ? n | r : n & ~r;
                this.setInt8(t, i);
            };
        }
    }), Me({
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
    }), Me({
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
    }), Me({
        getAccessorUnaligned(t, e) {
            const {bitSize: n, bitOffset: r} = e, i = 7 & r, s = [ 1, 2, 4, 8 ].find((t => 8 * t >= n)) ?? 64 * Math.ceil(n / 64), o = new DataView(new ArrayBuffer(s));
            if ("get" === t) {
                const t = this.getAccessor("get", {
                    ...e,
                    byteSize: s
                }), r = Ee(i, n, !0);
                return function(e, n) {
                    return r(o, this, e), t.call(o, 0, n);
                };
            }
            {
                const t = this.getAccessor("set", {
                    ...e,
                    byteSize: s
                }), r = Ee(i, n, !1);
                return function(e, n, i) {
                    t.call(o, 0, n, i), r(this, o, e);
                };
            }
        }
    }), Me({
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
            const {type: n, byteSize: r, typedArray: i} = t, s = 1 !== r ? "s" : "", o = [ "ArrayBuffer", "DataView" ].map(Be);
            let c;
            i && o.push(Be(i.name)), c = n === e.Slice ? `Expecting ${je(o)} that can accommodate items ${r} byte${s} in length` : `Expecting ${je(o)} that is ${r} byte${s} in length`, 
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
            "string" === r || "number" === r || Ue(e) ? (Ue(e) && (e = `{ error: ${JSON.stringify(e.error)} }`), 
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
            if (Array.isArray(e)) for (const t of e) i.push(Be(t)); else i.push(Be(e));
            const s = ze(n);
            super(`${r} expects ${je(i)} as argument, received ${s}`);
        }
    }
    class InvalidArrayInitializer extends InvalidInitializer {
        constructor(t, n, r = !1) {
            const {instance: {members: [i]}, type: s, constructor: o} = t, c = [], a = ne(i);
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
            o[Ut] && c.push(o[Ut].name), s === e.Slice && r && c.push("length"), super(t, c.join(" or "), n);
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
                this.message = `Expecting ${s}${t} argument${i}, received ${e}`, this.stack = Ce(this.stack, "new Arg(");
            };
            r(0), Kt(this, Lt, {
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
            const n = ze(e);
            super(`Expected ${Be(t)}, received ${n}`);
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
                r = `${Fe(t)} ${t}`;
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
            super(`${(r > 32 ? "Big" : "") + k[n] + r} cannot represent the value given: ${e}`);
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
            if (t instanceof Error) return super(t.message), t.stack = Ce(this.stack, e), t;
            super(t ?? "Error encountered in Zig code");
        }
    }
    function Oe(t, e) {
        const n = n => {
            e -= n, t.message = `args[${e}]: ${t.message}`, t.stack = Ce(t.stack, "new Arg(");
        };
        return n(0), Kt(t, Lt, {
            value: n,
            enumerable: !1
        }), t;
    }
    function Ce(t, e) {
        if ("string" == typeof t) {
            const n = t.split("\n"), r = n.findIndex((t => t.includes(e)));
            -1 !== r && (n.splice(1, r), t = n.join("\n"));
        }
        return t;
    }
    function $e() {
        throw new ReadOnly;
    }
    function Te(t, e, n) {
        if (void 0 === t.bytes && (t.bytes = t.calls = 0), t.bytes += n, t.calls++, 100 === t.calls) {
            const n = t.bytes / t.calls;
            if (n < 8) {
                throw new Error(`Inefficient ${e} access. Each call is only ${"read" === e ? "reading" : "writing"} ${n} byte${n > 1 ? "s" : ""}. Please use std.io.Buffered${"read" === e ? "Reader" : "Writer"}.`);
            }
        }
    }
    function Ue(t) {
        return "object" == typeof t && "string" == typeof t.error && 1 === Object.keys(t).length;
    }
    function ze(t) {
        const e = typeof t;
        let n;
        return n = "object" === e ? t ? Object.prototype.toString.call(t) : "null" : e, 
        Be(n);
    }
    function Be(t) {
        return `${Fe(t)} ${t}`;
    }
    function Fe(t) {
        return /^\W*[aeiou]/i.test(t) ? "an" : "a";
    }
    function je(t, e = "or") {
        const n = ` ${e} `;
        return t.length > 2 ? t.slice(0, -1).join(", ") + n + t[t.length - 1] : t.join(n);
    }
    function ke(t) {
        let n, r = 1, i = null;
        if (t instanceof DataView) {
            n = t;
            const e = n?.[rt]?.align;
            e && (r = e);
        } else if (t instanceof ArrayBuffer) n = new DataView(t); else if (t) if (t[tt]) t.constructor[st] === e.Pointer && (t = t["*"]), 
        n = t[tt], i = t.constructor, r = i[Mt]; else {
            "string" == typeof t && (t = ie(t));
            const {buffer: e, byteOffset: i, byteLength: s, BYTES_PER_ELEMENT: o} = t;
            e && void 0 !== i && void 0 !== s && (n = new DataView(e, i, s), r = o);
        }
        return {
            dv: n,
            align: r,
            constructor: i
        };
    }
    Me({
        defineAlloc: () => ({
            value(t, e = 1) {
                const n = Math.clz32(e);
                if (e !== 1 << 31 - n) throw new Error(`Invalid alignment: ${e}`);
                const r = 31 - n, {vtable: {alloc: i}, ptr: s} = this, o = i(s, t, r, 0);
                if (!o) throw new Error("Out of memory");
                o.length = t;
                const c = o["*"][tt];
                return c[rt].align = e, c;
            }
        }),
        defineFree() {
            const t = this;
            return {
                value(e) {
                    const {dv: n, align: r} = ke(e), i = n?.[rt];
                    if (!i) throw new TypeMismatch("object containing allocated Zig memory", e);
                    const {address: s} = i;
                    if (s === fe) throw new PreviouslyFreed(e);
                    const {vtable: {free: o}, ptr: c} = this;
                    o(c, n, 31 - Math.clz32(r), 0), t.releaseZigView(n);
                }
            };
        },
        defineDupe() {
            const t = this.getCopyFunction();
            return {
                value(e) {
                    const {dv: n, align: r, constructor: i} = ke(e);
                    if (!n) throw new TypeMismatch("string, DataView, typed array, or Zig object", e);
                    const s = this.alloc(n.byteLength, r);
                    return t(s, n), i ? i(s) : s;
                }
            };
        }
    }), Me({
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
                sizeOf: e => t(e?.[At]),
                alignOf: e => t(e?.[Mt]),
                typeOf: e => Ne[t(e?.[st])]
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
                        const {array: s, offset: o, length: c} = e, a = this.obtainView(r(s), o, c), {handle: l, const: u} = t, f = i?.constructor, h = t.actual = f.call(Et, a);
                        return u && this.makeReadOnly(h), t.slots && n(h[et], t.slots), l && this.variables.push({
                            handle: l,
                            object: h
                        }), h;
                    }
                }
                return i;
            }, s = new Map;
            for (const e of t) {
                for (const t of [ e.instance, e.static ]) if (t.template) {
                    const {slots: e, memory: n, handle: i} = t.template, o = t.template = {};
                    if (n) {
                        const {array: t, offset: e, length: s} = n;
                        o[tt] = this.obtainView(r(t), e, s), i && this.variables.push({
                            handle: i,
                            object: o
                        });
                    }
                    if (e) {
                        const t = o[et] = {};
                        s.set(t, e);
                    }
                }
                this.defineStructure(e);
            }
            for (const [t, e] of s) n(t, e);
            for (const e of t) this.finalizeStructure(e);
        }
    });
    const Ne = n.map((t => t.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()));
    Me({
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
                const t = this.getViewAddress(e[tt]), i = this.createJsThunk(t, n);
                if (!i) throw new Error("Unable to create function thunk");
                r = this.obtainZigView(i, 0), this.jsFunctionThunkMap.set(n, r), this.jsFunctionControllerMap.set(n, e);
            }
            return r;
        },
        createInboundCaller(t, e) {
            const n = this.getFunctionId(t);
            return this.jsFunctionCallerMap.set(n, ((n, r) => {
                let i = J, s = !1;
                try {
                    const o = e(n);
                    if (Zt in o) {
                        o[Zt]("reset");
                        const t = this.startContext();
                        this.updatePointerTargets(t, o, !0), this.updateShadowTargets(t), this.endContext();
                    }
                    const c = function(t) {
                        try {
                            if (!(e[zt] && t instanceof Error)) throw t;
                            o[Ht](t);
                        } catch (e) {
                            i = q, console.error(t);
                        }
                    }, a = function(t) {
                        try {
                            o[Ht](t);
                        } catch (t) {
                            i = q, console.error(t);
                        }
                    };
                    try {
                        const e = t(...o), n = o.hasOwnProperty(Ht);
                        if ("Promise" === e?.[Symbol.toStringTag]) if (r || n) {
                            const t = e.then(a, c);
                            r && t.then((() => this.finalizeAsyncCall(r, i))), s = !0, i = J;
                        } else i = G; else if (e?.[Symbol.asyncIterator]) {
                            if (!o.hasOwnProperty(Xt)) throw new UnexpectedGenerator;
                            this.pipeContents(e, o), i = J;
                        } else null == e && n || a(e);
                    } catch (t) {
                        c(t);
                    }
                } catch (t) {
                    console.error(t), i = q;
                }
                return r && !s && this.finalizeAsyncCall(r, i), i;
            })), function(...e) {
                return t(...e);
            };
        },
        defineArgIterator(t) {
            const n = this, r = t.filter((({structure: t}) => t.type === e.Struct && t.flags & h.IsAllocator)).length;
            return {
                value() {
                    let i, s = 0, o = 0, c = 0;
                    const a = [];
                    for (const [l, {structure: u, type: f}] of t.entries()) try {
                        let t, d, g = this[l];
                        f === j.Object && g?.[tt]?.[rt] && (g = new g.constructor(g)), u.type === e.Struct && (u.flags & h.IsAllocator ? (t = 1 === r ? "allocator" : "allocator" + ++s, 
                        d = this[jt] = g) : u.flags & h.IsPromise ? (t = "callback", 1 == ++o && (d = n.createPromiseCallback(this, g))) : u.flags & h.IsGenerator ? (t = "callback", 
                        1 == ++o && (d = n.createGeneratorCallback(this, g))) : u.flags & h.IsAbortSignal && (t = "signal", 
                        1 == ++c && (d = n.createInboundSignal(g)))), void 0 !== t ? void 0 !== d && (i ||= {}, 
                        i[t] = d) : a.push(g);
                    } catch (t) {
                        a.push(t);
                    }
                    return i && a.push(i), a[Symbol.iterator]();
                }
            };
        },
        handleJsCall(t, e, n, r = 0) {
            const i = this.obtainZigView(e, n, !1), s = this.jsFunctionCallerMap.get(t);
            return s ? s(i, r) : q;
        },
        releaseFunction(t) {
            const e = this.jsFunctionThunkMap.get(t), n = this.jsFunctionControllerMap.get(t);
            if (e && n) {
                const r = this.getViewAddress(n[tt]), i = this.getViewAddress(e);
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
    }), Me({
        createOutboundCaller(t, e) {
            const n = this, r = function(...i) {
                const s = new e(i, this?.[jt]);
                return n.invokeThunk(t, r, s);
            };
            return r;
        },
        copyArguments(t, n, r, i, s) {
            let o = 0, c = 0, a = 0;
            const l = t[Tt];
            for (const {type: u, structure: f} of r) {
                let r, d, g, p;
                if (f.type === e.Struct) if (f.flags & h.IsAllocator) {
                    r = (1 == ++a ? i?.allocator ?? i?.allocator1 : i?.[`allocator${a}`]) ?? this.createDefaultAllocator(t, f);
                } else f.flags & h.IsPromise ? (d ||= this.createPromise(f, t, i?.callback), r = d) : f.flags & h.IsGenerator ? (g ||= this.createGenerator(f, t, i?.callback), 
                r = g) : f.flags & h.IsAbortSignal ? (p ||= this.createSignal(f, i?.signal), r = p) : f.flags & h.IsReader ? r = this.createReader(n[c++]) : f.flags & h.IsWriter && (r = this.createWriter(n[c++]));
                if (void 0 === r && (r = n[c++], void 0 === r && u !== j.Void)) throw new UndefinedArgument;
                try {
                    l[o++].call(t, r, s);
                } catch (t) {
                    throw Oe(t, o - 1);
                }
            }
        },
        invokeThunk(t, e, n) {
            const r = this.startContext(), i = n[Ot], s = this.getViewAddress(t[tt]), o = this.getViewAddress(e[tt]), c = Wt in n, a = Zt in n;
            a && this.updatePointerAddresses(r, n);
            const l = this.getViewAddress(n[tt]), u = i ? this.getViewAddress(i[tt]) : 0;
            this.updateShadows(r);
            const f = () => {
                this.updateShadowTargets(r), a && this.updatePointerTargets(r, n), this.libc && this.flushStdout?.(), 
                this.flushConsole?.(), this.endContext();
            };
            c && (n[Wt] = f);
            if (!(i ? this.runVariadicThunk(s, o, l, u, i.length) : this.runThunk(s, o, l))) throw f(), 
            new ZigError;
            if (c) {
                let t = null;
                try {
                    t = n.retval;
                } catch (e) {
                    t = new ZigError(e, 1);
                }
                return null != t ? (e[Pt] && t && (t = t.string), n[Ht](t)) : e[Pt] && (n[Pt] = !0), 
                n[Bt] ?? n[Ft];
            }
            f();
            try {
                const {retval: t} = n;
                return e[Pt] && t ? t.string : t;
            } catch (t) {
                throw new ZigError(t, 1);
            }
        },
        imports: {
            runThunk: null,
            runVariadicThunk: null
        }
    }), Me({
        init() {
            const t = {
                type: j.Int,
                bitSize: 8,
                byteSize: 1
            }, e = {
                type: j.Int,
                bitSize: 16,
                byteSize: 2
            }, n = {
                type: j.Int,
                bitSize: 32,
                byteSize: 4
            }, r = this.getAccessor("get", t), i = this.getAccessor("set", t), s = this.getAccessor("get", e), o = this.getAccessor("set", e), c = this.getAccessor("get", n), a = this.getAccessor("set", n);
            this.copiers = {
                0: Ae,
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
                0: Ae,
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
                    const e = t[tt], r = this[tt];
                    n(r, e);
                }
            };
        },
        defineResetter(t, e) {
            const n = this.getResetFunction(e);
            return {
                value() {
                    const r = this[tt];
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
    }), Me({
        init() {
            this.generatorCallbackMap = new Map, this.generatorContextMap = new Map, this.nextGeneratorContextId = he(8192);
        },
        createGenerator(t, e, n) {
            const {constructor: r, instance: {members: i}} = t;
            if (n) {
                if ("function" != typeof n) throw new TypeMismatch("function", n);
            } else {
                const t = e[Ft] = new AsyncGenerator;
                n = t.push.bind(t);
            }
            const s = this.nextGeneratorContextId++, o = this.obtainZigView(s, 0, !1);
            this.generatorContextMap.set(s, {
                func: n,
                args: e
            });
            let c = this.generatorCallbackMap.get(r);
            c || (c = async (t, e) => {
                const n = t instanceof DataView ? t : t["*"][tt], r = this.getViewAddress(n), i = this.generatorContextMap.get(r);
                if (i) {
                    const {func: t, args: n} = i, s = e instanceof Error;
                    !s && n[Pt] && e && (e = e.string);
                    const o = !1 === await (2 === t.length ? t(s ? e : null, s ? null : e) : t(e)) || s || null === e;
                    return n[Dt]?.(o), !o || (n[Wt](), this.generatorContextMap.delete(r), !1);
                }
            }, this.generatorCallbackMap.set(r, c), this.destructors.push((() => this.freeFunction(c)))), 
            e[Ht] = t => c(o, t);
            const a = {
                ptr: o,
                callback: c
            }, l = i.find((t => "allocator" === t.name));
            if (l) {
                const {structure: t} = l;
                a.allocator = this.createJsAllocator(e, t, !0);
            }
            return a;
        },
        createGeneratorCallback(t, e) {
            const {ptr: n, callback: r} = e, i = r["*"];
            return t[Xt] = e => i.call(t, n, e), (...e) => {
                const n = 2 === e.length ? e[0] ?? e[1] : e[0];
                return t[Xt](n);
            };
        },
        async pipeContents(t, e) {
            try {
                try {
                    const n = t[Symbol.asyncIterator]();
                    for await (const t of n) if (null !== t && !e[Xt](t)) break;
                    e[Xt](null);
                } catch (t) {
                    if (!e.constructor[zt]) throw t;
                    e[Xt](t);
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
    function Pe(t, e) {
        return ce(t, e, (t => t.address));
    }
    function Le(t, n) {
        const {byteSize: r, type: i} = n;
        if (!(i === e.Slice ? t.byteLength % r == 0 : t.byteLength === r)) throw new BufferSizeMismatch(n, t);
    }
    function De(t) {
        throw new BufferExpected(t);
    }
    Me({
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
    }), Me({
        init() {
            this.defaultAllocator = null, this.allocatorVtable = null, this.allocatorContextMap = new Map, 
            this.nextAllocatorContextId = he(4096);
        },
        createDefaultAllocator(t, e) {
            let n = this.defaultAllocator;
            return n || (n = this.defaultAllocator = this.createJsAllocator(t, e, !1)), n;
        },
        createJsAllocator(t, e, n) {
            const {constructor: r} = e;
            let i = this.allocatorVtable;
            if (!i) {
                const {noResize: t, noRemap: e} = r;
                i = this.allocatorVtable = {
                    alloc: this.allocateHostMemory.bind(this),
                    free: this.freeHostMemory.bind(this),
                    resize: t
                }, e && (i.remap = e), this.destructors.push((() => this.freeFunction(i.alloc))), 
                this.destructors.push((() => this.freeFunction(i.free)));
            }
            let s = ue;
            if (n) {
                const e = [];
                s = this.nextAllocatorContextId++, this.allocatorContextMap.set(s, e), t[Dt] = t => {
                    for (const {address: n, len: r} of e) this.unregisterMemory(n, r), t && this.allocatorContextMap.delete(s);
                    e.splice(0);
                };
            }
            return new r({
                ptr: this.obtainZigView(s, 0),
                vtable: i
            });
        },
        allocateHostMemory(t, e, n) {
            const r = this.getViewAddress(t["*"][tt]), i = r != ue ? this.allocatorContextMap.get(r) : null, s = 1 << n, o = this.allocateJSMemory(e, s);
            {
                const t = this.getViewAddress(o);
                return this.registerMemory(t, e, s, !0, o), Kt(o, rt, {
                    value: {
                        address: t,
                        len: e,
                        js: !0
                    },
                    enumerable: !1
                }), i?.push({
                    address: t,
                    len: e
                }), o;
            }
        },
        freeHostMemory(t, e, n) {
            const r = this.getViewAddress(e["*"][tt]), i = e.length;
            this.unregisterMemory(r, i);
        }
    }), Me({
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
            const i = e[tt];
            if (n) {
                if (void 0 === n.address) {
                    const {start: e, end: s, targets: o} = n;
                    let c, a = 0;
                    for (const t of o) {
                        const e = t[tt], n = e.byteOffset, r = t.constructor[Mt] ?? e[Mt];
                        (void 0 === a || r > a) && (a = r, c = n);
                    }
                    const l = s - e, u = this.allocateShadowMemory(l + a, 1), f = this.getViewAddress(u), h = le(de(f, c - e), a), d = de(h, e - c);
                    for (const t of o) {
                        const n = t[tt], r = n.byteOffset;
                        if (r !== c) {
                            const i = t.constructor[Mt] ?? n[Mt];
                            if (ae(de(d, r - e), i)) throw new AlignmentConflict(i, a);
                        }
                    }
                    const g = u.byteOffset + Number(d - f), p = new DataView(u.buffer, g, l), b = new DataView(i.buffer, Number(e), l), y = this.registerMemory(d, l, 1, r, b, p);
                    t.shadowList.push(y), n.address = d;
                }
                return de(n.address, i.byteOffset - n.start);
            }
            {
                const n = e.constructor[Mt] ?? i[Mt], s = i.byteLength, o = this.allocateShadowMemory(s, n), c = this.getViewAddress(o), a = this.registerMemory(c, s, 1, r, i, o);
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
            const o = Pe(this.memoryList, t);
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
            const n = Pe(this.memoryList, t), r = this.memoryList[n - 1];
            if (r?.address === t && r.len === e) return this.memoryList.splice(n - 1, 1), r;
        },
        findMemory(t, e, n, r) {
            let i = n * (r ?? 0);
            const s = Pe(this.memoryList, e), o = this.memoryList[s - 1];
            let c;
            if (o?.address === e && o.len === i) c = o.targetDV; else if (o?.address <= e && de(e, i) <= de(o.address, o.len)) {
                const t = Number(e - o.address), n = void 0 === r, {targetDV: s} = o;
                n && (i = s.byteLength - t), c = this.obtainView(s.buffer, s.byteOffset + t, i), 
                n && (c[Mt] = o.align);
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
            const e = t[rt], n = e?.address;
            n && n !== fe && (e.address = fe, this.unregisterBuffer(de(n, -t.byteOffset)));
        },
        getViewAddress(t) {
            const e = t[rt];
            if (e) return e.address;
            {
                const e = this.getBufferAddress(t.buffer);
                return de(e, t.byteOffset);
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
                    return 0xaaaaaaaaaaaaaaaan === t;
                }(t) && (t = e > 0 ? 0 : ue), !t && e) return null;
                let r, i;
                if (n) {
                    const n = Pe(this.externBufferList, t), s = this.externBufferList[n - 1];
                    s?.address <= t && de(t, e) <= de(s.address, s.len) ? (r = s.buffer, i = Number(t - s.address)) : (r = e > 0 ? this.obtainExternBuffer(t, e, kt) : new ArrayBuffer(0), 
                    this.externBufferList.splice(n, 0, {
                        address: t,
                        len: e,
                        buffer: r
                    }), i = 0);
                } else r = e > 0 ? this.obtainExternBuffer(t, e, kt) : new ArrayBuffer(0), i = 0;
                return r[rt] = {
                    address: t,
                    len: e
                }, this.obtainView(r, i, e);
            },
            unregisterBuffer(t) {
                const e = Pe(this.externBufferList, t), n = this.externBufferList[e - 1];
                n?.address === t && this.externBufferList.splice(e - 1, 1);
            },
            getTargetAddress(t, e, n, r) {
                const i = e[tt];
                if (n) {
                    if (void 0 === n.misaligned) {
                        const t = this.getBufferAddress(i.buffer);
                        for (const e of n.targets) {
                            const r = e[tt].byteOffset, i = e.constructor[Mt], s = de(t, r);
                            if (ae(s, i)) {
                                n.misaligned = !0;
                                break;
                            }
                        }
                        void 0 === n.misaligned && (n.misaligned = !1, n.address = t);
                    }
                    if (!n.misaligned) return de(n.address, i.byteOffset);
                } else {
                    const t = e.constructor[Mt], n = this.getViewAddress(i);
                    if (!ae(n, t)) {
                        const e = i.byteLength;
                        return this.registerMemory(n, e, t, r, i), n;
                    }
                }
                return this.getShadowAddress(t, e, n, r);
            }
        }
    }), Me({
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
    }), Me({
        linkVariables(t) {
            const e = this.getCopyFunction();
            for (const {object: n, handle: r} of this.variables) {
                const i = n[tt], s = this.recreateAddress(r);
                let o = n[tt] = this.obtainZigView(s, i.byteLength);
                t && e(o, i), n.constructor[It]?.save?.(o, n), this.destructors.push((() => {
                    const t = n[tt] = this.allocateMemory(o.bytelength);
                    e(t, o);
                }));
                const c = t => {
                    const e = t[et];
                    if (e) {
                        const t = o.byteOffset;
                        for (const n of Object.values(e)) if (n) {
                            const e = n[tt];
                            if (e.buffer === i.buffer) {
                                const r = t + e.byteOffset - i.byteOffset;
                                n[tt] = this.obtainView(o.buffer, r, e.byteLength), n.constructor[It]?.save?.(o, n), 
                                c(n);
                            }
                        }
                    }
                };
                c(n), n[Zt]?.((function() {
                    this[Lt]();
                }), H.IgnoreInactive);
            }
        },
        imports: {
            recreateAddress: null
        }
    }), Me({
        updatePointerAddresses(t, e) {
            const n = new Map, r = new Map, i = [], s = function(t) {
                const e = this[ut];
                if (void 0 === n.get(e)) {
                    const t = e[et][0];
                    if (t) {
                        const o = {
                            target: t,
                            writable: !e.constructor.const
                        }, c = t[tt];
                        if (c[rt]) n.set(e, null); else {
                            n.set(e, t);
                            const a = r.get(c.buffer);
                            if (a) {
                                const t = Array.isArray(a) ? a : [ a ], e = ce(t, c.byteOffset, (t => t.target[tt].byteOffset));
                                t.splice(e, 0, o), Array.isArray(a) || (r.set(c.buffer, t), i.push(t));
                            } else r.set(c.buffer, o);
                            t[Zt]?.(s, 0);
                        }
                    }
                }
            }, o = H.IgnoreRetval | H.IgnoreInactive;
            e[Zt](s, o);
            const c = this.findTargetClusters(i), a = new Map;
            for (const t of c) for (const e of t.targets) a.set(e, t);
            for (const [e, r] of n) if (r) {
                const n = a.get(r), i = n?.writable ?? !e.constructor.const;
                e[yt] = this.getTargetAddress(t, r, n, i), mt in e && (e[mt] = r.length);
            }
        },
        updatePointerTargets(t, e, n = !1) {
            const r = new Map, i = function(e) {
                const n = this[ut];
                if (!r.get(n)) {
                    r.set(n, !0);
                    const s = n[et][0], o = s && e & H.IsImmutable ? s : n[Lt](t, !0, !(e & H.IsInactive)), c = n.constructor.const ? H.IsImmutable : 0;
                    c & H.IsImmutable || s && !s[tt][rt] && s[Zt]?.(i, c), o !== s && o && !o[tt][rt] && o?.[Zt]?.(i, c);
                }
            }, s = n ? H.IgnoreRetval : 0;
            e[Zt](i, s);
        },
        findTargetClusters(t) {
            const e = [];
            for (const n of t) {
                let t = null, r = 0, i = 0, s = null;
                for (const {target: o, writable: c} of n) {
                    const n = o[tt], {byteOffset: a, byteLength: l} = n, u = a + l;
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
    }), Me({
        init() {
            this.promiseCallbackMap = new Map, this.promiseContextMap = new Map, this.nextPromiseContextId = he(4096);
        },
        createPromise(t, e, n) {
            const {constructor: r} = t;
            if (n) {
                if ("function" != typeof n) throw new TypeMismatch("function", n);
            } else e[Bt] = new Promise(((t, r) => {
                n = n => {
                    n?.[tt]?.[rt] && (n = new n.constructor(n)), n instanceof Error ? r(n) : (e[Pt] && n && (n = n.string), 
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
                const n = t instanceof DataView ? t : t["*"][tt], r = this.getViewAddress(n), i = this.promiseContextMap.get(r);
                if (i) {
                    const {func: t, args: n} = i;
                    if (2 === t.length) {
                        const n = e instanceof Error;
                        t(n ? e : null, n ? null : e);
                    } else t(e);
                    n[Wt](), this.promiseContextMap.delete(r);
                }
            }, this.promiseCallbackMap.set(r, o), this.destructors.push((() => this.freeFunction(o)))), 
            e[Ht] = t => o(s, t), {
                ptr: s,
                callback: o
            };
        },
        createPromiseCallback(t, e) {
            const {ptr: n, callback: r} = e, i = r["*"];
            return t[Ht] = e => i.call(t, n, e), (...e) => {
                const n = 2 === e.length ? e[0] ?? e[1] : e[0];
                return t[Ht](n);
            };
        }
    }), Me({
        init() {
            this.readerCallback = null, this.readerContextMap = new Map, this.nextReaderContextId = he(4096);
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
                    const n = this.getViewAddress(t["*"][tt]), r = this.readerContextMap.get(n);
                    if (!r) return 0;
                    try {
                        const t = e["*"][tt], i = new Uint8Array(t.buffer, t.byteOffset, t.byteLength);
                        Te(r, "read", i.length);
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
                        throw this.readerContextMap.delete(n), t;
                    }
                }, this.destructors.push((() => this.freeFunction(r)))), {
                    context: n,
                    readFn: r
                };
            }
            if ("object" == typeof t && "context" in t && "readFn" in t) return t;
            throw new TypeMismatch("ReadableStreamDefaultReader or ReadableStreamBYOBReader", t);
        }
    }), Me({
        addRuntimeCheck: t => function(e, n) {
            const r = t.call(this, e, n);
            if ("set" === e) {
                const {min: t, max: e} = function(t) {
                    const {type: e, bitSize: n} = t, r = e === j.Int;
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
    }), Me({
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
            e.log?.call?.(e, re(t));
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
                return n && this.writeToConsole(n) ? J : q;
            }
        }
    }), Me({
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
            const n = t ? t[et] : this.slots;
            return n?.[e];
        },
        writeSlot(t, e, n) {
            const r = t ? t[et] : this.slots;
            r && (r[e] = n);
        },
        createTemplate: t => ({
            [tt]: t,
            [et]: {}
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
                return n[rt].handle = r, n;
            }
        },
        castView(t, e, n, r, i) {
            const {constructor: o, flags: c} = r, a = this.captureView(t, e, n, i), l = o.call(Et, a);
            return c & s && this.updatePointerTargets(null, l), n && e > 0 && this.makeReadOnly?.(l), 
            l;
        },
        acquireStructures() {
            const t = this.getModuleAttributes();
            this.littleEndian = !!(t & _), this.runtimeSafety = !!(t & W), this.libc = !!(t & Y);
            const e = this.getFactoryThunk(), n = {
                [tt]: this.obtainZigView(e, 0)
            };
            this.comptime = !0, this.mixinUsage = new Map, this.invokeThunk(n, n, n), this.comptime = !1;
            for (const t of this.structures) {
                const {constructor: e, flags: n, instance: {template: r}} = t;
                if (n & s && r && r[tt]) {
                    const t = Object.create(e.prototype);
                    t[tt] = r[tt], t[et] = r[et], this.updatePointerTargets(null, t);
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
            for (const e of be(this.structures, et)) {
                const n = e[tt]?.[rt];
                if (n) {
                    const {address: r, len: i, handle: s} = n, o = e[tt] = this.captureView(r, i, !0);
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
            for (const e of t) if (!e.replaced) for (const n of t) if (e !== n && !n.replaced && !n.handle && e.address <= n.address && de(n.address, n.len) <= de(e.address, e.len)) {
                const t = e.owner[tt], r = Number(n.address - e.address) + t.byteOffset;
                n.owner[tt] = this.obtainView(t.buffer, r, n.len), n.replaced = !0;
            }
        },
        useStructures() {
            const t = this.getRootModule(), e = be(this.structures, et);
            for (const t of e) t[tt]?.[rt] && this.variables.push({
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
              case j.Bool:
                return "bool";

              case j.Int:
                return r & c ? "isize" : `i${e.bitSize}`;

              case j.Uint:
                return r & c ? "usize" : `u${e.bitSize}`;

              case j.Float:
                return `f${e.bitSize}`;

              case j.Void:
                return "void";

              case j.Literal:
                return "enum_literal";

              case j.Null:
                return "null";

              case j.Undefined:
                return "undefined";

              case j.Type:
                return "type";

              case j.Object:
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
            for (const e of [ "Allocator", "Promise", "Generator", "Read", "Writer" ]) if (t.flags & h[`Is${e}`]) return e;
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
            return t.flags & C ? "anyerror" : "ES" + this.structureCounters.errorSet++;
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
            if (n.structure.type === e.Slice && (s = s.slice(3)), r & v && (i = r & w ? "[]" : r & S ? "[*c]" : "[*]"), 
            !(r & S)) {
                const t = n.structure.constructor?.[ft];
                t && (i = i.slice(0, -1) + `:${t.value}` + i.slice(-1));
            }
            return r & I && (i = `${i}const `), i + s;
        },
        getSliceName(t) {
            const {instance: {members: [e]}, flags: n} = t;
            return n & O ? "anyopaque" : `[_]${e.structure.name}`;
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
    }), Me({}), Me({
        init() {
            this.viewMap = new WeakMap, this.needFallback = void 0;
        },
        extractView(t, n, r = De) {
            const {type: i, byteSize: s, constructor: o} = t;
            let c;
            const a = n?.[Symbol.toStringTag];
            if (a && ("DataView" === a ? c = this.registerView(n) : "ArrayBuffer" === a ? c = this.obtainView(n, 0, n.byteLength) : (a && a === o[Ut]?.name || "Uint8ClampedArray" === a && o[Ut] === Uint8Array || "Uint8Array" === a && n instanceof Buffer) && (c = this.obtainView(n.buffer, n.byteOffset, n.byteLength))), 
            !c) {
                const r = n?.[tt];
                if (r) {
                    const {constructor: o, instance: {members: [c]}} = t;
                    if (me(n, o)) return r;
                    if (function(t) {
                        return t === e.Array || t === e.Vector || t === e.Slice;
                    }(i)) {
                        const {byteSize: o, structure: {constructor: a}} = c, l = pe(n, a);
                        if (void 0 !== l) {
                            if (i === e.Slice || l * o === s) return r;
                            throw new ArrayLengthMismatch(t, null, n);
                        }
                    }
                }
            }
            return c ? void 0 !== s && Le(c, t) : r?.(t, n), c;
        },
        assignView(t, n, r, i, s) {
            const {byteSize: o, type: c} = r, a = o ?? 1;
            if (t[tt]) {
                const i = c === e.Slice ? a * t.length : a;
                if (n.byteLength !== i) throw new BufferSizeMismatch(r, n, t);
                const s = {
                    [tt]: n
                };
                t.constructor[ft]?.validateData?.(s, t.length), t[Jt](s);
            } else {
                void 0 !== o && Le(n, r);
                const e = n.byteLength / a, c = {
                    [tt]: n
                };
                t.constructor[ft]?.validateData?.(c, e), s && (i = !0), t[qt](i ? null : n, e, s), 
                i && t[Jt](c);
            }
            if (this.usingBufferFallback()) {
                const e = t[tt], n = e.buffer[kt];
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
                const r = t[rt];
                r && (s[rt] = {
                    address: de(r.address, e),
                    len: n
                });
            }
            return s;
        },
        registerView(t) {
            if (!t[rt]) {
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
                const n = e > Re && this.getBufferAddress ? e : 0, r = new ArrayBuffer(t + n);
                let i = 0;
                if (n) {
                    const t = this.getBufferAddress(r);
                    i = le(t, e) - t;
                }
                return this.obtainView(r, Number(i), t);
            }
        }
    });
    const Re = [ "arm64", "ppc64", "x64", "s390x" ].includes(process.arch) ? 16 : 8;
    Me({}), Me({
        makeReadOnly(t) {
            qe(t);
        }
    });
    const Ze = Object.getOwnPropertyDescriptors, Je = Object.defineProperty;
    function qe(t) {
        const e = t[ut];
        if (e) Ge(e, [ "length" ]); else {
            const e = t[ht];
            e ? (Ge(e), function(t) {
                Je(t, "set", {
                    value: $e
                });
                const e = t.get;
                Je(t, "get", {
                    value: function(t) {
                        const n = e.call(this, t);
                        return null === n?.[Vt] && qe(n), n;
                    }
                });
            }(e)) : Ge(t);
        }
    }
    function Ge(t, e = []) {
        const n = Ze(t.constructor.prototype);
        for (const [r, i] of Object.entries(n)) i.set && !e.includes(r) && (i.set = $e, 
        Je(t, r, i));
        Je(t, Vt, {
            value: t
        });
    }
    function _e() {
        const t = this[ht] ?? this, e = this.length;
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
    function We(t) {
        const e = ee(t), n = this[ht] ?? this, r = this.length;
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
    function Ye(t) {
        return {
            [Symbol.iterator]: We.bind(this, t),
            length: this.length
        };
    }
    function He(t) {
        return {
            [Symbol.iterator]: Ke.bind(this, t),
            length: this[lt].length
        };
    }
    function Xe(t) {
        return He.call(this, t)[Symbol.iterator]();
    }
    function Ke(t) {
        const e = ee(t), n = this, r = this[lt];
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
    function Qe(t) {
        return {
            [Symbol.iterator]: en.bind(this, t),
            length: this[lt].length
        };
    }
    function tn(t) {
        return Qe.call(this, t)[Symbol.iterator]();
    }
    function en(t) {
        const e = ee(t), n = this, r = this[lt], i = this[$t];
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
    function nn() {
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
    function rn() {
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
    function sn() {
        return {
            [Symbol.iterator]: rn.bind(this),
            length: this.length
        };
    }
    function on(t = {}) {
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
    function cn(t, {get: e, set: n}) {
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
    function an(t) {
        return ln.call(this, t).$;
    }
    function ln(t) {
        return this[et][t] ?? this[Rt](t);
    }
    function un(t) {
        const e = ln.call(this, t).$;
        return e ? e.string : e;
    }
    function fn(t, e, n) {
        ln.call(this, t)[Gt](e, n);
    }
    Me({
        init() {
            this.writerCallback = null, this.writerContextMap = new Map, this.nextWriterContextId = he(8192);
        },
        createWriter(t) {
            if (t instanceof WritableStreamDefaultWriter) {
                const e = this.nextWriterContextId++, n = this.obtainZigView(e, 0, !1);
                this.writerContextMap.set(e, {
                    writer: t
                }), t.closed.catch(Ae).then((() => this.writerContextMap.delete(e)));
                let r = this.writerCallback;
                return r || (r = this.writerCallback = async (t, e) => {
                    const n = this.getViewAddress(t["*"][tt]), r = this.writerContextMap.get(n);
                    if (!r) return 0;
                    try {
                        const t = e["*"][tt], n = new Uint8Array(t.buffer, t.byteOffset, t.byteLength);
                        Te(r, "write", n.length);
                        const {writer: i} = r;
                        return await i.write(new Uint8Array(n)), n.length;
                    } catch (t) {
                        throw this.writerContextMap.delete(n), t;
                    }
                }, this.destructors.push((() => this.freeFunction(r)))), {
                    context: n,
                    writeFn: r
                };
            }
            if ("context" in t && "writeFn" in t) return t;
            throw new TypeMismatch("WritableStreamDefaultWriter", t);
        }
    }), Me({
        defineArrayEntries: () => te(Ye),
        defineArrayIterator: () => te(_e)
    }), Me({
        defineStructEntries: () => te(He),
        defineStructIterator: () => te(Xe)
    }), Me({
        defineUnionEntries: () => te(Qe),
        defineUnionIterator: () => te(tn)
    }), Me({
        defineVectorEntries: () => te(sn),
        defineVectorIterator: () => te(nn)
    }), Me({
        defineZigIterator: () => te(on)
    }), Me({
        defineMember(t, e = !0) {
            if (!t) return {};
            const {type: r, structure: i} = t, s = this[`defineMember${k[r]}`].call(this, t);
            if (e && i) {
                const {type: e} = i, r = this[`transformDescriptor${n[e]}`];
                if (r) return r.call(this, s, t);
            }
            return s;
        }
    }), Me({
        defineBase64(t) {
            const e = this;
            return we({
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
    }), Me({
        defineMemberBool(t) {
            return this.defineMemberUsing(t, this.getAccessor);
        }
    }), Me({
        defineClampedArray(t) {
            const e = this, n = Uint8ClampedArray;
            return we({
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
    }), Me({
        defineDataView(t) {
            const e = this;
            return we({
                get() {
                    const t = this[tt];
                    if (e.usingBufferFallback()) {
                        const n = t.buffer[kt];
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
    }), Me({
        defineMemberFloat(t) {
            return this.defineMemberUsing(t, this.getAccessor);
        }
    }), Me({
        defineMemberInt(t) {
            let e = this.getAccessor;
            return this.runtimeSafety && (e = this.addRuntimeCheck(e)), e = this.addIntConversion(e), 
            this.defineMemberUsing(t, e);
        }
    }), Me({
        defineMemberLiteral(t) {
            const {slot: e} = t;
            return cn(e, {
                get(t) {
                    return this[et][t].string;
                },
                set: $e
            });
        }
    }), Me({
        defineMemberNull: t => ({
            get: function() {
                return null;
            },
            set: $e
        })
    }), Me({
        defineMemberObject: t => cn(t.slot, {
            get: t.flags & Z ? un : t.structure.flags & r ? an : ln,
            set: t.flags & P ? $e : fn
        })
    }), Me({
        ...{
            defineMemberUsing(t, e) {
                const {littleEndian: n} = this, {bitOffset: r, byteSize: i} = t, s = e.call(this, "get", t), o = e.call(this, "set", t);
                if (void 0 !== r) {
                    const t = r >> 3;
                    return {
                        get: function() {
                            return s.call(this[tt], t, n);
                        },
                        set: function(e) {
                            return o.call(this[tt], t, e, n);
                        }
                    };
                }
                return {
                    get: function(e) {
                        try {
                            return s.call(this[tt], e * i, n);
                        } catch (n) {
                            throw function(t, e, n) {
                                return n instanceof RangeError && !(n instanceof OutOfBound) && (n = new OutOfBound(t, e)), 
                                n;
                            }(t, e, n);
                        }
                    },
                    set: function(t, e) {
                        return o.call(this[tt], t * i, e, n);
                    }
                };
            }
        }
    }), Me({
        defineSentinel(t) {
            const {byteSize: e, instance: {members: [n, r], template: i}} = t, {get: s} = this.defineMember(r), {get: o} = this.defineMember(n), c = s.call(i, 0), a = !!(r.flags & N), {runtimeSafety: l} = this;
            return te({
                value: c,
                bytes: i[tt],
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
                    } else if (r > 0 && r * e === n[tt].byteLength) {
                        if (o.call(n, r - 1) !== c) throw new MissingSentinel(t, c, r);
                    }
                },
                isRequired: a
            });
        },
        imports: {
            findSentinel: null
        }
    }), Me({
        defineString(t) {
            const e = this, {byteSize: n} = t.instance.members[0], r = "utf-" + 8 * n;
            return we({
                get() {
                    let t = re(this.typedArray, r);
                    const e = this.constructor[ft]?.value;
                    return void 0 !== e && t.charCodeAt(t.length - 1) === e && (t = t.slice(0, -1)), 
                    t;
                },
                set(n, i) {
                    if ("string" != typeof n) throw new TypeMismatch("string", n);
                    const s = this.constructor[ft]?.value;
                    void 0 !== s && n.charCodeAt(n.length - 1) !== s && (n += String.fromCharCode(s));
                    const o = ie(n, r), c = new DataView(o.buffer);
                    e.assignView(this, c, t, !1, i);
                }
            });
        }
    }), Me({
        defineValueOf: () => ({
            value() {
                return gn(this, !1);
            }
        })
    });
    const hn = BigInt(Number.MAX_SAFE_INTEGER), dn = BigInt(Number.MIN_SAFE_INTEGER);
    function gn(t, n) {
        const r = {
            error: n ? "return" : "throw"
        }, i = ee(r), s = new Map, o = function(t) {
            const c = "function" == typeof t ? e.Struct : t?.constructor?.[st];
            if (void 0 === c) {
                if (n) {
                    if ("bigint" == typeof t && dn <= t && t <= hn) return Number(t);
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
                    n = t[gt](r), a = t.constructor[ot] & h.IsTuple ? [] : {};
                    break;

                  case e.Union:
                    n = t[gt](r), a = {};
                    break;

                  case e.Array:
                  case e.Vector:
                  case e.Slice:
                    n = t[gt](), a = [];
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
    Me({
        defineToJSON: () => ({
            value() {
                return gn(this, !0);
            }
        })
    }), Me({
        defineMemberType(t, e) {
            const {slot: n} = t;
            return cn(n, {
                get(t) {
                    const e = this[et][t];
                    return e?.constructor;
                },
                set: $e
            });
        }
    }), Me({
        defineTypedArray(t) {
            const e = this, n = this.getTypedArray(t);
            return we({
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
    }), Me({
        defineMemberUint(t) {
            let e = this.getAccessor;
            return this.runtimeSafety && (e = this.addRuntimeCheck(e)), e = this.addIntConversion(e), 
            this.defineMemberUsing(t, e);
        }
    }), Me({
        defineMemberUndefined: t => ({
            get: function() {},
            set: $e
        })
    }), Me({
        defineMemberUnsupported(t) {
            const e = function() {
                throw new Unsupported;
            };
            return {
                get: e,
                set: e
            };
        }
    }), Me({
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
    }), Me({
        defineStructure(t) {
            const {type: e, byteSize: r} = t, i = this[`define${n[e]}`], s = [], o = {}, c = {
                dataView: this.defineDataView(t),
                base64: this.defineBase64(t),
                toJSON: this.defineToJSON(),
                valueOf: this.defineValueOf(),
                [Vt]: {
                    value: null
                },
                [Tt]: te(o),
                [bt]: te(s),
                [Jt]: this.defineCopier(r)
            }, a = t.constructor = i.call(this, t, c);
            for (const [t, e] of Object.entries(c)) {
                const n = e?.set;
                n && !o[t] && "$" !== t && (o[t] = n, s.push(t));
            }
            return Qt(a.prototype, c), a;
        },
        finalizeStructure(t) {
            const {name: r, type: i, constructor: s, align: o, byteSize: c, flags: a, signature: l, static: {members: u, template: f}} = t, h = [], d = {
                name: te(r),
                toJSON: this.defineToJSON(),
                valueOf: this.defineValueOf(),
                [Nt]: te(l),
                [Et]: te(this),
                [Mt]: te(o),
                [At]: te(c),
                [st]: te(i),
                [ot]: te(a),
                [lt]: te(h),
                [Ut]: te(this.getTypedArray(t)),
                [Symbol.iterator]: this.defineStructIterator(),
                [gt]: this.defineStructEntries(),
                [lt]: te(h)
            }, g = {
                [Symbol.toStringTag]: te(r)
            };
            for (const t of u) {
                const {name: n, slot: r, flags: i} = t;
                if (t.structure.type === e.Function) {
                    let e = f[et][r];
                    i & Z && (e[Pt] = !0), d[n] = te(e), e.name || Kt(e, "name", te(n));
                    const [s, o] = /^(get|set)\s+([\s\S]+)/.exec(n)?.slice(1) ?? [], c = "get" === s ? 0 : 1;
                    if (s && e.length === c) {
                        d[o] ||= {};
                        d[o][s] = e;
                    }
                    if (t.flags & D) {
                        const t = function(...t) {
                            try {
                                return e(this, ...t);
                            } catch (t) {
                                throw t[Lt]?.(1), t;
                            }
                        };
                        if (Qt(t, {
                            name: te(n),
                            length: te(e.length - 1)
                        }), g[n] = te(t), s && t.length === c) {
                            (g[o] ||= {})[s] = t;
                        }
                    }
                } else d[n] = this.defineMember(t), h.push(n);
            }
            d[et] = h.length > 0 && te(f[et]);
            const p = this[`finalize${n[i]}`];
            !1 !== p?.call(this, t, d, g) && (Qt(s.prototype, g), Qt(s, d));
        },
        createConstructor(t, n = {}) {
            const {type: r, byteSize: i, align: s, flags: c, instance: {members: a, template: l}} = t, {onCastError: u} = n;
            let f;
            if (l?.[et]) {
                const t = a.filter((t => t.flags & P));
                t.length > 0 && (f = t.map((t => t.slot)));
            }
            const h = new ObjectCache, d = this, g = function(n, a = {}) {
                const {allocator: p} = a, b = this instanceof g;
                let y, m;
                if (b) {
                    if (0 === arguments.length) throw new NoInitializer(t);
                    if (y = this, c & o && (y[et] = {}), qt in y) y[Gt](n, p), m = y[tt]; else {
                        const t = r !== e.Pointer ? p : null;
                        y[tt] = m = d.allocateMemory(i, s, t);
                    }
                } else {
                    if (Yt in g && (y = g[Yt].call(this, n, a), !1 !== y)) return y;
                    if (m = d.extractView(t, n, u), y = h.find(m)) return y;
                    y = Object.create(g.prototype), qt in y ? d.assignView(y, m, t, !1, !1) : y[tt] = m, 
                    c & o && (y[et] = {});
                }
                if (f) for (const t of f) y[et][t] = l[et][t];
                return y[_t]?.(), b && (qt in y || y[Gt](n, p)), Wt in y && (y = y[Wt]()), h.save(m, y);
            };
            return Kt(g, It, te(h)), g;
        },
        createApplier(t) {
            const {instance: {template: e}} = t;
            return function(n, r) {
                const i = Object.keys(n), s = this[bt], o = this[Tt];
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
                a < c && 0 === u && e && e[tt] && this[Jt](e);
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
                        return globalThis[(e > 4 && n !== j.Float ? "Big" : "") + (n === j.Float ? "Float" : n === j.Int ? "Int" : "Uint") + 8 * e + "Array"];
                    }

                  case e.Array:
                  case e.Slice:
                  case e.Vector:
                    return this.getTypedArray(t.structure);
                }
            }
        }
    }), Me({
        defineArgStruct(t, e) {
            const {flags: n, byteSize: r, align: c, length: a, instance: {members: l}} = t, u = this, f = l.slice(1), h = function(t, e) {
                const i = this instanceof h;
                let s, l;
                if (i ? (s = this, l = u.allocateMemory(r, c)) : (s = Object.create(h.prototype), 
                l = t), s[tt] = l, n & o && (s[et] = {}), !i) return s;
                {
                    let r;
                    if (n & z && t.length === a + 1 && (r = t.pop()), t.length !== a) throw new ArgumentCountMismatch(a, t.length);
                    n & F && (s[Wt] = null), u.copyArguments(s, t, f, r, e);
                }
            };
            for (const t of l) e[t.name] = this.defineMember(t);
            const d = e.retval.set;
            return e.length = te(f.length), e[Rt] = n & i && this.defineVivificatorStruct(t), 
            e[Zt] = n & s && this.defineVisitorArgStruct(l), e[Ht] = te((function(t) {
                d.call(this, t, this[jt]);
            })), e[Symbol.iterator] = this.defineArgIterator?.(f), h;
        },
        finalizeArgStruct(t, e) {
            const {flags: n} = t;
            e[zt] = te(!!(n & B));
        }
    }), Me({
        defineFinalizerArray: ({get: t, set: e}) => ({
            value() {
                const n = new Proxy(this, pn);
                return Qt(this, {
                    [St]: {
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
                    const {constructor: e} = r, s = this[tt], o = s.byteOffset + n * t, c = i.obtainView(s.buffer, o, n);
                    return this[et][t] = e.call(nt, c);
                }
            };
        }
    });
    const pn = {
        get(t, e) {
            const n = "symbol" == typeof e ? 0 : 0 | e;
            return 0 !== n || n == e ? t.get(n) : e === ht ? t : t[e];
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
            return e.push("length", St), e;
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
    Me({
        defineArray(t, e) {
            const {length: n, instance: {members: [r]}, flags: o} = t, c = this.createApplier(t), a = this.defineMember(r), {set: h} = a, d = this.createConstructor(t), g = function(e, r) {
                if (me(e, d)) this[Jt](e), o & s && this[Zt]("copy", H.Vivificate, e); else if ("string" == typeof e && o & l && (e = {
                    string: e
                }), e?.[Symbol.iterator]) {
                    if ((e = ge(e)).length !== n) throw new ArrayLengthMismatch(t, this, e);
                    let i = 0;
                    for (const t of e) h.call(this, i++, t, r);
                } else if (e && "object" == typeof e) {
                    if (0 === c.call(this, e)) throw new InvalidArrayInitializer(t, e);
                } else if (void 0 !== e) throw new InvalidArrayInitializer(t, e);
            };
            return e.$ = {
                get: Se,
                set: g
            }, e.length = te(n), e.entries = e[gt] = this.defineArrayEntries(), o & u && (e.typedArray = this.defineTypedArray(t), 
            o & l && (e.string = this.defineString(t)), o & f && (e.clampedArray = this.defineClampedArray(t))), 
            e[Symbol.iterator] = this.defineArrayIterator(), e[Gt] = te(g), e[Wt] = this.defineFinalizerArray(a), 
            e[Rt] = o & i && this.defineVivificatorArray(t), e[Zt] = o & s && this.defineVisitorArray(), 
            d;
        },
        finalizeArray(t, e) {
            const {flags: n, instance: {members: [r]}} = t;
            e.child = te(r.structure.constructor), e[ft] = n & a && this.defineSentinel(t);
        }
    }), Me({
        defineEnum(t, e) {
            const {instance: {members: [n]}} = t, r = this.defineMember(n), {get: i, set: s} = r, {get: o} = this.defineMember(n, !1), c = this.createApplier(t), a = [ "string", "number", "tagged union" ], l = this.createConstructor(t, {
                onCastError(t, e) {
                    throw new InvalidInitializer(t, a, e);
                }
            });
            return e.$ = r, e.toString = te(Ie), e[Symbol.toPrimitive] = {
                value(t) {
                    switch (t) {
                      case "string":
                      case "default":
                        return this.$[it];

                      default:
                        return o.call(this);
                    }
                }
            }, e[Gt] = te((function(e) {
                if (e && "object" == typeof e) {
                    if (0 === c.call(this, e)) throw new InvalidInitializer(t, a, e);
                } else void 0 !== e && s.call(this, e);
            })), l;
        },
        finalizeEnum(t, e) {
            const {flags: n, constructor: r, instance: {members: [i]}, static: {members: s, template: o}} = t, c = o[et], {get: a, set: l} = this.defineMember(i, !1), u = {};
            for (const {name: t, flags: n, slot: r} of s) if (n & L) {
                const n = c[r];
                Kt(n, it, te(t));
                const i = a.call(n);
                e[t] = {
                    value: n,
                    writable: !1
                }, u[i] = n;
            }
            e[Yt] = {
                value(t) {
                    if ("string" == typeof t) return r[t];
                    if ("number" == typeof t || "bigint" == typeof t) {
                        let e = u[t];
                        if (!e && n & y) {
                            e = new r(void 0), l.call(e, t);
                            const n = `${t}`;
                            Kt(e, it, te(n)), Kt(r, n, te(e)), u[t] = e;
                        }
                        return e;
                    }
                    return t instanceof r ? t : t?.[at] instanceof r && t[at];
                }
            }, e[Ut] = te(this.getTypedArray(t));
        },
        transformDescriptorEnum(t, e) {
            const {type: n, structure: r} = e;
            if (n === j.Object) return t;
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
    }), Me({
        init() {
            this.ZigError = class ZigError extends ZigErrorBase {}, this.globalItemsByIndex = {};
        },
        defineErrorSet(t, e) {
            const {instance: {members: [n]}} = t, r = this.defineMember(n), {set: i} = r, s = [ "string", "number" ], o = this.createApplier(t), c = this.createConstructor(t, {
                onCastError(t, e) {
                    throw new InvalidInitializer(t, s, e);
                }
            });
            return e.$ = r, e[Gt] = te((function(e) {
                if (e instanceof c[ct]) i.call(this, e); else if (e && "object" == typeof e && !Ue(e)) {
                    if (0 === o.call(this, e)) throw new InvalidInitializer(t, s, e);
                } else void 0 !== e && i.call(this, e);
            })), c;
        },
        finalizeErrorSet(t, e) {
            const {constructor: n, flags: r, instance: {members: [i]}, static: {members: s, template: o}} = t, c = o?.[et] ?? {}, a = r & C ? this.globalItemsByIndex : {}, {get: l} = this.defineMember(i, !1);
            for (const {name: t, slot: n} of s) {
                const r = c[n], i = l.call(r);
                let s = this.globalItemsByIndex[i];
                const o = !!s;
                s || (s = new this.ZigError(t, i));
                const u = te(s);
                e[t] = u;
                const f = `${s}`;
                e[f] = u, a[i] = s, o || (Qt(this.ZigError, {
                    [t]: u,
                    [f]: u
                }), this.globalItemsByIndex[i] = s);
            }
            e[Yt] = {
                value: t => "number" == typeof t ? a[t] : "string" == typeof t ? n[t] : t instanceof n[ct] ? a[Number(t)] : Ue(t) ? n[`Error: ${t.error}`] : t instanceof Error && n[`${t}`]
            }, e[ct] = te(this.ZigError);
        },
        transformDescriptorErrorSet(t, e) {
            const {type: n, structure: r} = e;
            if (n === j.Object) return t;
            const i = t => {
                const {constructor: e, flags: n} = r, i = e(t);
                if (!i) {
                    if (n & C && "number" == typeof t) {
                        const e = new this.ZigError(`Unknown error: ${t}`, t);
                        return this.globalItemsByIndex[t] = e, Kt(this.ZigError, `${e}`, te(e)), e;
                    }
                    throw t instanceof Error ? new NotInErrorSet(r) : new ErrorExpected(r, t);
                }
                return i;
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
    function bn(t, e) {
        return ye(t?.constructor?.child, e) && t["*"];
    }
    function yn(t, e, n) {
        if (n & v) {
            if (t?.constructor?.child?.child === e.child && t["*"]) return !0;
            if (n & S && bn(t, e.child)) return !0;
        }
        return !1;
    }
    Me({
        defineErrorUnion(t, e) {
            const {instance: {members: [n, r]}, flags: o} = t, {get: c, set: a} = this.defineMember(n), {get: l, set: u} = this.defineMember(r), {get: f, set: h} = this.defineMember(r, !1), d = n.type === j.Void, g = r.structure.constructor, p = function() {
                this[Dt](), this[Zt]?.("clear");
            }, b = this.createApplier(t), y = function(e, n) {
                if (me(e, v)) this[Jt](e), o & s && (f.call(this) || this[Zt]("copy", 0, e)); else if (e instanceof g[ct] && g(e)) u.call(this, e), 
                p.call(this); else if (void 0 !== e || d) try {
                    a.call(this, e, n), h.call(this, 0);
                } catch (n) {
                    if (e instanceof Error) {
                        const n = g[e] ?? g.Unexpected;
                        if (!n) throw new NotInErrorSet(t);
                        u.call(this, n), p.call(this);
                    } else if (Ue(e)) u.call(this, e), p.call(this); else {
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
            }, e[Gt] = te(y), e[Rt] = o & i && this.defineVivificatorStruct(t), e[Dt] = this.defineResetter(m / 8, w), 
            e[Zt] = o & s && this.defineVisitorErrorUnion(n, f), v;
        }
    }), Me({
        defineFunction(t, n) {
            const {instance: {members: [r], template: i}, static: {template: s}} = t, o = new ObjectCache, {structure: {constructor: c}} = r, a = this, l = function(n) {
                const r = this instanceof l;
                let u, f;
                if (r) {
                    if (0 === arguments.length) throw new NoInitializer(t);
                    if ("function" != typeof n) throw new TypeMismatch("function", n);
                    if (c[st] === e.VariadicStruct || !s) throw new Unsupported;
                    u = a.getFunctionThunk(n, s);
                } else {
                    if (this !== Et) throw new NoCastingToFunction;
                    u = n;
                }
                if (f = o.find(u)) return f;
                const h = c.prototype.length, d = r ? a.createInboundCaller(n, c) : a.createOutboundCaller(i, c);
                return Qt(d, {
                    length: te(h),
                    name: te(r ? n.name : "")
                }), Object.setPrototypeOf(d, l.prototype), d[tt] = u, o.save(u, d), d;
            };
            return Object.setPrototypeOf(l.prototype, Function.prototype), n.valueOf = n.toJSON = te(ve), 
            l;
        },
        finalizeFunction(t, e, n) {
            n[Symbol.toStringTag] = void 0;
        }
    }), Me({
        defineOpaque(t, e) {
            const {flags: n} = t, r = () => {
                throw new AccessingOpaque(t);
            }, i = this.createConstructor(t);
            return e.$ = {
                get: r,
                set: r
            }, e[Symbol.iterator] = n & $ && this.defineZigIterator(), e[Symbol.toPrimitive] = {
                value(e) {
                    const {name: n} = t;
                    return `[opaque ${n}]`;
                }
            }, e[Gt] = te((() => {
                throw new CreatingOpaque(t);
            })), i;
        }
    }), Me({
        defineOptional(t, e) {
            const {instance: {members: [n, r]}, flags: o} = t, {get: c, set: a} = this.defineMember(n), {get: l, set: u} = this.defineMember(r), f = n.type === j.Void, h = function(t, e) {
                me(t, d) ? (this[Jt](t), o & s && l.call(this) && this[Zt]("copy", H.Vivificate, t)) : null === t ? (u.call(this, 0), 
                this[Dt]?.(), this[Zt]?.("clear")) : (void 0 !== t || f) && (a.call(this, t, e), 
                o & m ? u.call(this, 1) : o & s && (l.call(this) || u.call(this, 13)));
            }, d = t.constructor = this.createConstructor(t), {bitOffset: g, byteSize: p} = n;
            return e.$ = {
                get: function() {
                    return l.call(this) ? c.call(this) : (this[Zt]?.("clear"), null);
                },
                set: h
            }, e[Gt] = te(h), e[Dt] = o & m && this.defineResetter(g / 8, p), e[Rt] = o & i && this.defineVivificatorStruct(t), 
            e[Zt] = o & s && this.defineVisitorOptional(n, l), d;
        }
    }), Me({
        definePointer(t, n) {
            const {flags: i, byteSize: s, instance: {members: [o]}} = t, {structure: a} = o, {type: l, flags: u, byteSize: f = 1} = a, h = i & w ? s / 2 : s, {get: d, set: g} = this.defineMember({
                type: j.Uint,
                bitOffset: 0,
                bitSize: 8 * h,
                byteSize: h,
                structure: {
                    byteSize: h
                }
            }), {get: p, set: b} = i & w ? this.defineMember({
                type: j.Uint,
                bitOffset: 8 * h,
                bitSize: 8 * h,
                byteSize: h,
                structure: {
                    flags: c,
                    byteSize: h
                }
            }) : {}, y = function(t, n = !0, r = !0) {
                if (n || this[tt][rt]) {
                    if (!r) return this[et][0] = void 0;
                    {
                        const n = z.child, r = d.call(this), s = i & w ? p.call(this) : l === e.Slice && u & x ? T.findSentinel(r, n[ft].bytes) + 1 : 1;
                        if (r !== this[wt] || s !== this[vt]) {
                            const e = T.findMemory(t, r, s, n[At]), o = e ? n.call(Et, e) : null;
                            return this[et][0] = o, this[wt] = r, this[vt] = s, i & w && (this[pt] = null), 
                            o;
                        }
                    }
                }
                return this[et][0];
            }, m = function(t) {
                g.call(this, t), this[wt] = t;
            }, M = u & x ? 1 : 0, V = i & w || u & x ? function(t) {
                b?.call?.(this, t - M), this[vt] = t;
            } : null, E = function() {
                const t = this[ut] ?? this, e = !t[et][0], n = y.call(t, null, e);
                if (!n) {
                    if (i & A) return null;
                    throw new NullPointer;
                }
                return i & I ? wn(n) : n;
            }, C = u & r ? function() {
                return E.call(this).$;
            } : E, $ = i & I ? $e : function(t) {
                return E.call(this).$ = t;
            }, T = this, U = function(n, r) {
                const s = a.constructor;
                if (bn(n, s)) {
                    if (!(i & I) && n.constructor.const) throw new ConstantConstraint(t, n);
                    n = n[et][0];
                } else if (i & v) yn(n, s, i) && (n = s(n[et][0][tt])); else if (l === e.Slice && u & O && n) if (n.constructor[st] === e.Pointer) n = n[dt]?.[tt]; else if (n[tt]) n = n[tt]; else if (n?.buffer instanceof ArrayBuffer && !(n instanceof Uint8Array || n instanceof DataView)) {
                    const {byteOffset: t, byteLength: e} = n;
                    void 0 !== t && void 0 !== e && (n = new DataView(n.buffer, t, e));
                }
                if (n instanceof s) {
                    const e = n[Vt];
                    if (e) {
                        if (!(i & I)) throw new ReadOnlyTarget(t);
                        n = e;
                    }
                } else if (me(n, s)) n = s.call(Et, n[tt]); else if (i & S && i & v && n instanceof s.child) n = s(n[tt]); else if (function(t, e) {
                    const n = t?.[Symbol.toStringTag];
                    if (n) {
                        const r = e[Ut];
                        if (r) switch (n) {
                          case r.name:
                          case "DataView":
                            return !0;

                          case "ArrayBuffer":
                            return r === Uint8Array || r === Int8Array;

                          case "Uint8ClampedArray":
                            return r === Uint8Array;
                        }
                        if (e.child && void 0 !== pe(t, e.child)) return !0;
                    }
                    return !1;
                }(n, s)) {
                    n = s(T.extractView(a, n));
                } else if (null == n || n[tt]) {
                    if (!(void 0 === n || i & A && null === n)) throw new InvalidPointerTarget(t, n);
                } else {
                    if (i & S && i & v && "object" == typeof n && !n[Symbol.iterator]) {
                        let t = !0;
                        const e = s.prototype[Tt];
                        for (const r of Object.keys(n)) {
                            const n = e[r];
                            if (n?.special) {
                                t = !1;
                                break;
                            }
                        }
                        t && (n = [ n ]);
                    }
                    if (Ut in s && n?.buffer && n[Symbol.iterator]) throw new InvalidPointerTarget(t, n);
                    n = new s(n, {
                        allocator: r
                    });
                }
                const o = n?.[tt]?.[rt];
                if (o?.address === fe) throw new PreviouslyFreed(n);
                this[dt] = n;
            }, z = this.createConstructor(t);
            return n["*"] = {
                get: C,
                set: $
            }, n.$ = {
                get: Se,
                set: U
            }, n.length = {
                get: function() {
                    const t = E.call(this);
                    return t ? t.length : 0;
                },
                set: function(t) {
                    t |= 0;
                    const e = E.call(this);
                    if (!e) {
                        if (0 !== t) throw new InvalidSliceLength(t, 0);
                        return;
                    }
                    if (e.length === t) return;
                    const n = e[tt], r = n[rt];
                    let s;
                    if (!r) if (i & w) this[pt] ||= e.length, s = this[pt]; else {
                        s = (n.buffer.byteLength - n.byteOffset) / f | 0;
                    }
                    if (t < 0 || t > s) throw new InvalidSliceLength(t, s);
                    const o = t * f, c = r ? T.obtainZigView(r.address, o) : T.obtainView(n.buffer, n.byteOffset, o), l = a.constructor;
                    this[et][0] = l.call(Et, c), V?.call?.(this, t);
                }
            }, n.slice = l === e.Slice && {
                value(t, e) {
                    const n = this[dt].slice(t, e);
                    return new z(n);
                }
            }, n.subarray = l === e.Slice && {
                value(t, e, n) {
                    const r = this[dt].subarray(t, e, n);
                    return new z(r);
                }
            }, n[Symbol.toPrimitive] = l === e.Primitive && {
                value(t) {
                    return this[dt][Symbol.toPrimitive](t);
                }
            }, n[Gt] = te(U), n[Wt] = {
                value() {
                    const t = l !== e.Pointer ? vn : {};
                    let n;
                    l === e.Function ? (n = function() {}, n[tt] = this[tt], n[et] = this[et], Object.setPrototypeOf(n, z.prototype)) : n = this;
                    const r = new Proxy(n, t);
                    return Object.defineProperty(n, St, {
                        value: r
                    }), r;
                }
            }, n[dt] = {
                get: E,
                set: function(t) {
                    if (void 0 === t) return;
                    const e = this[ut] ?? this;
                    if (t) {
                        const n = t[tt][rt];
                        if (n) {
                            const {address: e, js: r} = n;
                            m.call(this, e), V?.call?.(this, t.length), r && (t[tt][rt] = void 0);
                        } else if (e[tt][rt]) throw new ZigMemoryTargetRequired;
                    } else e[tt][rt] && (m.call(this, 0), V?.call?.(this, 0));
                    e[et][0] = t ?? null, i & w && (e[pt] = null);
                }
            }, n[Lt] = te(y), n[yt] = {
                set: m
            }, n[mt] = {
                set: V
            }, n[Zt] = this.defineVisitor(), n[wt] = te(0), n[vt] = te(0), n[pt] = i & w && te(null), 
            n.dataView = n.base64 = void 0, z;
        },
        finalizePointer(t, n) {
            const {flags: r, constructor: i, instance: {members: [s]}} = t, {structure: o} = s, {type: c, constructor: a} = o;
            n.child = a ? te(a) : {
                get: () => o.constructor
            }, n.const = te(!!(r & I)), n[Yt] = {
                value(n, s) {
                    if (this === Et || this === nt || n instanceof i) return !1;
                    if (bn(n, a)) return new i(a(n["*"]), s);
                    if (yn(n, a, r)) return new i(n);
                    if (c === e.Slice) return new i(a(n), s);
                    throw new NoCastingToPointer(t);
                }
            };
        }
    });
    const mn = new WeakMap;
    function wn(t) {
        let e = mn.get(t);
        if (!e) {
            const n = t[ut];
            e = n ? new Proxy(n, Sn) : new Proxy(t, In), mn.set(t, e);
        }
        return e;
    }
    const vn = {
        get(t, e) {
            if (e === ut) return t;
            if (e in t) return t[e];
            return t[dt][e];
        },
        set(t, e, n) {
            if (e in t) t[e] = n; else {
                t[dt][e] = n;
            }
            return !0;
        },
        deleteProperty(t, e) {
            if (e in t) delete t[e]; else {
                delete t[dt][e];
            }
            return !0;
        },
        has(t, e) {
            if (e in t) return !0;
            return e in t[dt];
        },
        apply: (t, e, n) => t["*"].apply(e, n)
    }, Sn = {
        ...vn,
        set(t, e, n) {
            if (e in t) $e(); else {
                t[dt][e] = n;
            }
            return !0;
        }
    }, In = {
        get(t, e) {
            if (e === Vt) return t;
            {
                const n = t[e];
                return n?.[tt] ? wn(n) : n;
            }
        },
        set(t, e, n) {
            $e();
        }
    };
    function An() {
        return this[mt];
    }
    function xn(t, e) {
        return (t |= 0) < 0 ? (t = e + t) < 0 && (t = 0) : t > e && (t = e), t;
    }
    function Mn() {
        throw new InaccessiblePointer;
    }
    function Vn() {
        const t = {
            get: Mn,
            set: Mn
        };
        Qt(this[ut], {
            "*": t,
            $: t,
            [ut]: t,
            [dt]: t
        });
    }
    function En(t, e, n, r) {
        let i, s = this[et][t];
        if (!s) {
            if (n & H.IgnoreUncreated) return;
            s = this[Rt](t);
        }
        r && (i = r[et][t], !i) || s[Zt](e, n, i);
    }
    Me({
        definePrimitive(t, e) {
            const {instance: {members: [n]}} = t, r = this.createApplier(t), {get: i, set: s} = this.defineMember(n), o = function(e) {
                if (me(e, c)) this[Jt](e); else if (e && "object" == typeof e) {
                    if (0 === r.call(this, e)) {
                        const r = ne(n);
                        throw new InvalidInitializer(t, r, e);
                    }
                } else void 0 !== e && s.call(this, e);
            }, c = this.createConstructor(t);
            return e.$ = {
                get: i,
                set: o
            }, e[Gt] = te(o), e[Symbol.toPrimitive] = te(i), c;
        },
        finalizePrimitive(t, e) {
            const {instance: {members: [n]}} = t;
            e[xt] = te(n.bitSize), e[Ct] = te(n.type);
        }
    }), Me({
        defineSlice(t, e) {
            const {align: n, flags: r, byteSize: o, name: c, instance: {members: [a]}} = t, {byteSize: l, structure: u} = a, f = this, h = function(t, e, r) {
                t || (t = f.allocateMemory(e * l, n, r)), this[tt] = t, this[mt] = e;
            }, d = function(e, n) {
                if (n !== this[mt]) throw new ArrayLengthMismatch(t, this, e);
            }, g = this.defineMember(a), {set: p} = g, b = this.createApplier(t), y = function(e, n) {
                if (me(e, w)) this[tt] ? d.call(this, e, e.length) : h.call(this, null, e.length, n), 
                this[Jt](e), r & s && this[Zt]("copy", H.Vivificate, e); else if ("string" == typeof e && r & M) y.call(this, {
                    string: e
                }, n); else if (e?.[Symbol.iterator]) {
                    e = ge(e), this[tt] ? d.call(this, e, e.length) : h.call(this, null, e.length, n);
                    let t = 0;
                    for (const r of e) w[ft]?.validateValue(r, t, e.length), p.call(this, t++, r, n);
                } else if ("number" == typeof e) {
                    if (!(!this[tt] && e >= 0 && isFinite(e))) throw new InvalidArrayInitializer(t, e, !this[tt]);
                    h.call(this, null, e, n);
                } else if (e && "object" == typeof e) {
                    if (0 === b.call(this, e, n)) throw new InvalidArrayInitializer(t, e);
                } else if (void 0 !== e) throw new InvalidArrayInitializer(t, e);
            }, m = function(t, e) {
                const n = this[mt], r = this[tt];
                t = void 0 === t ? 0 : xn(t, n), e = void 0 === e ? n : xn(e, n);
                const i = t * l, s = e * l - i;
                return f.obtainView(r.buffer, r.byteOffset + i, s);
            }, w = this.createConstructor(t);
            return e.$ = {
                get: Se,
                set: y
            }, e.length = {
                get: An
            }, r & V && (e.typedArray = this.defineTypedArray(t), r & M && (e.string = this.defineString(t)), 
            r & E && (e.clampedArray = this.defineClampedArray(t))), e.entries = e[gt] = this.defineArrayEntries(), 
            e.subarray = {
                value(t, e) {
                    const n = m.call(this, t, e);
                    return w(n);
                }
            }, e.slice = {
                value(t, e, r = {}) {
                    const {zig: i = !1} = r, s = m.call(this, t, e), o = f.allocateMemory(s.byteLength, n, i), c = w(o);
                    return c[Jt]({
                        [tt]: s
                    }), c;
                }
            }, e[Symbol.iterator] = this.defineArrayIterator(), e[qt] = te(h), e[Jt] = this.defineCopier(o, !0), 
            e[Gt] = te(y), e[Wt] = this.defineFinalizerArray(g), e[Rt] = r & i && this.defineVivificatorArray(t), 
            e[Zt] = r & s && this.defineVisitorArray(), w;
        },
        finalizeSlice(t, e) {
            const {flags: n, instance: {members: [r]}} = t;
            e.child = te(r.structure.constructor), e[ft] = n & x && this.defineSentinel(t);
        }
    }), Me({
        defineVivificatorStruct(t) {
            const {instance: {members: e}} = t, n = {};
            for (const t of e.filter((t => t.type === j.Object))) n[t.slot] = t;
            const r = this;
            return {
                value(t) {
                    const e = n[t], {bitOffset: i, byteSize: s, structure: {constructor: o}} = e, c = this[tt], a = c.byteOffset + (i >> 3);
                    let l = s;
                    if (void 0 === l) {
                        if (7 & i) throw new NotOnByteBoundary(e);
                        l = e.bitSize >> 3;
                    }
                    const u = r.obtainView(c.buffer, a, l);
                    return this[et][t] = o.call(nt, u);
                }
            };
        }
    }), Me({
        defineStruct(t, e) {
            const {flags: n, length: r, instance: {members: o}} = t, c = o.find((t => t.flags & R)), a = c && this.defineMember(c), l = this.createApplier(t), u = function(e, r) {
                if (me(e, f)) this[Jt](e), n & s && this[Zt]("copy", 0, e); else if (e && "object" == typeof e) l.call(this, e, r); else if ("number" != typeof e && "bigint" != typeof e || !a) {
                    if (void 0 !== e) throw new InvalidInitializer(t, "object", e);
                } else a.set.call(this, e);
            }, f = this.createConstructor(t), d = e[Tt].value, g = e[bt].value, p = [];
            for (const t of o.filter((t => !!t.name))) {
                const {name: n, flags: r} = t, {set: i} = e[n] = this.defineMember(t);
                i && (r & N && (i.required = !0), d[n] = i, g.push(n)), p.push(n);
            }
            return e.$ = {
                get: ve,
                set: u
            }, e.length = te(r), e.entries = n & h.IsTuple && this.defineVectorEntries(), e[Symbol.toPrimitive] = a && {
                value(t) {
                    return "string" === t ? Object.prototype.toString.call(this) : a.get.call(this);
                }
            }, e[Symbol.iterator] = n & h.IsIterator ? this.defineZigIterator() : n & h.IsTuple ? this.defineVectorIterator() : this.defineStructIterator(), 
            e[Gt] = te(u), e[Rt] = n & i && this.defineVivificatorStruct(t), e[Zt] = n & s && this.defineVisitorStruct(o), 
            e[gt] = n & h.IsTuple ? this.defineVectorEntries() : this.defineStructEntries(), 
            e[lt] = te(p), n & h.IsAllocator && (e.alloc = this.defineAlloc(), e.free = this.defineFree(), 
            e.dupe = this.defineDupe()), f;
        }
    }), Me({
        defineUnion(t, e) {
            const {flags: n, instance: {members: r}} = t, o = !!(n & d), c = o ? r.slice(0, -1) : r, a = o ? r[r.length - 1] : null, {get: l, set: u} = this.defineMember(a), {get: f} = this.defineMember(a, !1), h = n & g ? function() {
                return l.call(this)[it];
            } : function() {
                const t = l.call(this);
                return c[t].name;
            }, y = n & g ? function(t) {
                const {constructor: e} = a.structure;
                u.call(this, e[t]);
            } : function(t) {
                const e = c.findIndex((e => e.name === t));
                u.call(this, e);
            }, m = this.createApplier(t), w = function(e, r) {
                if (me(e, v)) this[Jt](e), n & s && this[Zt]("copy", H.Vivificate, e); else if (e && "object" == typeof e) {
                    let n = 0;
                    for (const t of x) t in e && n++;
                    if (n > 1) throw new MultipleUnionInitializers(t);
                    if (0 === m.call(this, e, r)) throw new MissingUnionInitializer(t, e, o);
                } else if (void 0 !== e) throw new InvalidInitializer(t, "object with a single property", e);
            }, v = this.createConstructor(t), S = {}, I = e[Tt].value, A = e[bt].value, x = [];
            for (const r of c) {
                const {name: i} = r, {get: s, set: c} = this.defineMember(r), a = o ? function() {
                    const e = h.call(this);
                    if (i !== e) {
                        if (n & g) return null;
                        throw new InactiveUnionProperty(t, i, e);
                    }
                    return this[Zt]?.("clear"), s.call(this);
                } : s, l = o && c ? function(e) {
                    const n = h.call(this);
                    if (i !== n) throw new InactiveUnionProperty(t, i, n);
                    c.call(this, e);
                } : c, u = o && c ? function(t) {
                    y.call(this, i), c.call(this, t), this[Zt]?.("clear");
                } : c;
                e[i] = {
                    get: a,
                    set: l
                }, I[i] = u, S[i] = s, A.push(i), x.push(i);
            }
            e.$ = {
                get: function() {
                    return this;
                },
                set: w
            }, e[Symbol.iterator] = n & b ? this.defineZigIterator() : this.defineUnionIterator(), 
            e[Symbol.toPrimitive] = n & g && {
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
            const {comptime: M} = this;
            return e[_t] = n & p && {
                value() {
                    return M || this[Zt](Vn), this[Zt] = Ae, this;
                }
            }, e[Gt] = te(w), e[at] = n & g && {
                get: l,
                set: u
            }, e[Rt] = n & i && this.defineVivificatorStruct(t), e[Zt] = n & s && this.defineVisitorUnion(c, n & g ? f : null), 
            e[gt] = this.defineUnionEntries(), e[lt] = n & g ? {
                get() {
                    return [ h.call(this) ];
                }
            } : te(x), e[$t] = te(S), v;
        },
        finalizeUnion(t, e) {
            const {flags: n, instance: {members: r}} = t;
            n & g && (e.tag = te(r[r.length - 1].structure.constructor));
        }
    }), Me({
        defineVariadicStruct(t, e) {
            const {byteSize: n, align: r, flags: s, length: o, instance: {members: c}} = t, a = this, l = c.slice(1);
            for (const t of c) e[t.name] = this.defineMember(t);
            const u = e.retval.set, f = function(t) {
                this[tt] = a.allocateMemory(8 * t, 4), this.length = t, this.littleEndian = a.littleEndian;
            };
            return Qt(f, {
                [Mt]: {
                    value: 4
                }
            }), Qt(f.prototype, {
                set: te((function(t, e, n, r, i) {
                    const s = this[tt], o = a.littleEndian;
                    s.setUint16(8 * t, e, o), s.setUint16(8 * t + 2, n, o), s.setUint16(8 * t + 4, r, o), 
                    s.setUint8(8 * t + 6, i == j.Float), s.setUint8(8 * t + 7, i == j.Int || i == j.Float);
                }))
            }), e[Rt] = s & i && this.defineVivificatorStruct(t), e[Zt] = this.defineVisitorVariadicStruct(c), 
            e[Ht] = te((function(t) {
                u.call(this, t, this[jt]);
            })), function(t) {
                if (t.length < o) throw new ArgumentCountMismatch(o, t.length, !0);
                let e = n, i = r;
                const s = t.slice(o), c = {};
                for (const [t, n] of s.entries()) {
                    const r = n?.[tt], s = n?.constructor?.[Mt];
                    if (!r || !s) {
                        throw Oe(new InvalidVariadicArgument, o + t);
                    }
                    s > i && (i = s);
                    e = (c[t] = e + (s - 1) & ~(s - 1)) + r.byteLength;
                }
                const u = new f(t.length), h = a.allocateMemory(e, i);
                h[Mt] = i, this[tt] = h, this[et] = {}, a.copyArguments(this, t, l);
                let d = -1;
                for (const [t, {bitOffset: e, bitSize: n, type: r, slot: i, structure: {align: s}}] of l.entries()) u.set(t, e / 8, n, s, r), 
                i > d && (d = i);
                for (const [t, e] of s.entries()) {
                    const n = d + t + 1, {byteLength: r} = e[tt], i = c[t], s = a.obtainView(h.buffer, i, r), l = this[et][n] = e.constructor.call(nt, s), f = e.constructor[xt] ?? 8 * r, g = e.constructor[Mt], p = e.constructor[Ct];
                    l.$ = e, u.set(o + t, i, f, g, p);
                }
                this[Ot] = u;
            };
        },
        finalizeVariadicStruct(t, e) {
            const {flags: n} = t;
            e[zt] = te(!!(n & B)), e[Mt] = te(void 0);
        }
    }), Me({
        defineVector(t, e) {
            const {flags: n, length: r, instance: {members: [o]}} = t, c = this.createApplier(t), a = function(e) {
                if (me(e, l)) this[Jt](e), n & s && this[Zt]("copy", H.Vivificate, e); else if (e?.[Symbol.iterator]) {
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
                get: ve,
                set: a
            }, e.length = te(r), n & T && (e.typedArray = this.defineTypedArray(t), n & U && (e.clampedArray = this.defineClampedArray(t))), 
            e.entries = e[gt] = this.defineVectorEntries(), e[Symbol.iterator] = this.defineVectorIterator(), 
            e[Gt] = te(a), e[Rt] = n & i && this.defineVivificatorArray(t), e[Zt] = n & s && this.defineVisitorArray(), 
            l;
        },
        finalizeVector(t, e) {
            const {instance: {members: [n]}} = t;
            e.child = te(n.structure.constructor);
        }
    }), Me({
        defineVisitor: () => ({
            value(t, e, n) {
                let r;
                r = "string" == typeof t ? On[t] : t, r.call(this, e, n);
            }
        })
    });
    const On = {
        copy(t, e) {
            const n = e[et][0];
            if (this[tt][rt] && n && !n[tt][rt]) throw new ZigMemoryTargetRequired;
            this[et][0] = n;
        },
        clear(t) {
            t & H.IsInactive && (this[et][0] = void 0);
        },
        reset() {
            this[et][0] = void 0, this[wt] = void 0;
        }
    };
    return Me({
        defineVisitorArgStruct(t) {
            const e = [];
            let n;
            for (const [r, {slot: i, structure: o}] of t.entries()) o.flags & s && (0 === r ? n = i : e.push(i));
            return {
                value(t, r, i) {
                    if (!(r & H.IgnoreArguments) && e.length > 0) for (const n of e) En.call(this, n, t, r | H.IsImmutable, i);
                    r & H.IgnoreRetval || void 0 === n || En.call(this, n, t, r, i);
                }
            };
        }
    }), Me({
        defineVisitorArray: () => ({
            value(t, e, n) {
                for (let r = 0, i = this.length; r < i; r++) En.call(this, r, t, e, n);
            }
        })
    }), Me({
        defineVisitorErrorUnion(t, e) {
            const {slot: n} = t;
            return {
                value(t, r, i) {
                    e.call(this) && (r |= H.IsInactive), r & H.IsInactive && r & H.IgnoreInactive || En.call(this, n, t, r, i);
                }
            };
        }
    }), Me({
        defineVisitorOptional(t, e) {
            const {slot: n} = t;
            return {
                value(t, r, i) {
                    e.call(this) || (r |= H.IsInactive), r & H.IsInactive && r & H.IgnoreInactive || En.call(this, n, t, r, i);
                }
            };
        }
    }), Me({
        defineVisitorStruct(t) {
            const e = t.filter((t => t.structure?.flags & s)).map((t => t.slot));
            return {
                value(t, n, r) {
                    for (const i of e) En.call(this, i, t, n, r);
                }
            };
        }
    }), Me({
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
                        e !== s && (n |= H.IsInactive), n & H.IsInactive && n & H.IgnoreInactive || En.call(this, o, t, n, i);
                    }
                }
            };
        }
    }), Me({
        defineVisitorVariadicStruct(t) {
            const e = t[0], n = e.structure.flags & s ? e.slot : void 0;
            return {
                value(t, e, r) {
                    if (!(e & H.IgnoreArguments)) for (const [i, s] of Object.entries(this[et])) i !== n && Zt in s && En.call(this, i, t, e | H.IsImmutable, r);
                    e & H.IgnoreRetval || void 0 === n || En.call(this, n, t, e, r);
                }
            };
        }
    }), t.createEnvironment = function() {
        try {
            return new (Ve());
        } catch (t) {
            throw console.error(t), t;
        }
    }, t;
}({}))
