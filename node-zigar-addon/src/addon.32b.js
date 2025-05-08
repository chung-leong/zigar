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
    }, n = Object.keys(e), r = 1, i = 2, s = 4, o = 8, c = 16, a = 16, l = 32, u = 64, f = 128, h = 64, d = 128, g = 256, b = 512, y = 1024, p = 2048, m = 16, w = 32, v = 64, S = 512, A = 16, I = 16, V = 16, E = 32, M = 64, x = 128, O = 256, $ = 16, T = 32, U = 64, z = 128, C = 256, B = 16, j = 16, F = 16, N = 32, k = 16, P = 32, L = 64, D = {
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
    }, R = Object.keys(D), Z = 1, q = 2, J = 4, G = 16, _ = 64, W = 128, H = 0, X = 1, Y = 2, K = 1, Q = 2, tt = 4, et = {
        IsInactive: 1,
        IsImmutable: 2,
        IgnoreUncreated: 4,
        IgnoreInactive: 8,
        IgnoreArguments: 16,
        IgnoreRetval: 32
    }, nt = globalThis[Symbol.for("ZIGAR")] ||= {};
    function rt(t) {
        return nt[t] ||= Symbol(t);
    }
    function it(t) {
        return rt(t);
    }
    const st = it("memory"), ot = it("slots"), ct = it("parent"), at = it("zig"), lt = it("name"), ut = it("type"), ft = it("flags"), ht = it("class"), dt = it("tag"), gt = it("props"), bt = it("pointer"), yt = it("sentinel"), pt = it("array"), mt = it("target"), wt = it("entries"), vt = it("max length"), St = it("keys"), At = it("address"), It = it("length"), Vt = it("last address"), Et = it("last length"), Mt = it("proxy"), xt = it("cache"), Ot = it("size"), $t = it("bit size"), Tt = it("align"), Ut = it("const target"), zt = it("environment"), Ct = it("attributes"), Bt = it("primitive"), jt = it("getters"), Ft = it("setters"), Nt = it("typed array"), kt = it("throwing"), Pt = it("promise"), Lt = it("generator"), Dt = it("allocator"), Rt = it("fallback"), Zt = it("signature"), qt = it("string retval"), Jt = it("update"), Gt = it("reset"), _t = it("vivificate"), Wt = it("visit"), Ht = it("copy"), Xt = it("shape"), Yt = it("initialize"), Kt = it("restrict"), Qt = it("finalize"), te = it("cast"), ee = it("return"), ne = it("yield");
    function re(t, e, n) {
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
    function ie(t, e) {
        for (const [n, r] of Object.entries(e)) re(t, n, r);
        for (const n of Object.getOwnPropertySymbols(e)) {
            re(t, n, e[n]);
        }
        return t;
    }
    function se(t) {
        return void 0 !== t ? {
            value: t
        } : void 0;
    }
    function oe(t) {
        return "return" === t?.error ? t => {
            try {
                return t();
            } catch (t) {
                return t;
            }
        } : t => t();
    }
    function ce({type: t, bitSize: e}) {
        switch (t) {
          case D.Bool:
            return "boolean";

          case D.Int:
          case D.Uint:
            if (e > 32) return "bigint";

          case D.Float:
            return "number";
        }
    }
    function ae(t, e = "utf-8") {
        const n = ue[e] ||= new TextDecoder(e);
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
    function le(t, e = "utf-8") {
        if ("utf-16" === e) {
            const {length: e} = t, n = new Uint16Array(e);
            for (let r = 0; r < e; r++) n[r] = t.charCodeAt(r);
            return n;
        }
        return (fe[e] ||= new TextEncoder).encode(t);
    }
    const ue = {}, fe = {};
    function he(t, e, n) {
        let r = 0, i = t.length;
        if (0 === i) return 0;
        for (;r < i; ) {
            const s = Math.floor((r + i) / 2);
            n(t[s]) <= e ? r = s + 1 : i = s;
        }
        return i;
    }
    const de = function(t, e) {
        return !!e && !!(t & e - 1);
    }, ge = function(t, e) {
        return t + (e - 1) & ~(e - 1);
    }, be = 4294967295, ye = function(t, e) {
        return t + e;
    };
    function pe(t) {
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
    function me(t, e) {
        const {constructor: n} = t;
        return n === e ? 1 : n.child === e ? t.length : void 0;
    }
    function we(t, e) {
        const n = [], r = new Map, i = t => {
            if (t && !r.get(t) && (r.set(t, !0), n.push(t), t[e])) for (const n of Object.values(t[e])) i(n);
        };
        for (const e of t) i(e.instance.template), i(e.static.template);
        return n;
    }
    function ve(t, e) {
        return t === e || t?.[Zt] === e[Zt] && t?.[zt] !== e?.[zt];
    }
    function Se(t, e) {
        return t instanceof e || ve(t?.constructor, e);
    }
    function Ae({get: t, set: e}) {
        return t.special = e.special = !0, {
            get: t,
            set: e
        };
    }
    function Ie() {
        return this;
    }
    function Ve() {
        return this[Mt];
    }
    function Ee() {
        return String(this);
    }
    function Me() {}
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
    function Oe(t) {
        return xe.constructor || xe.mixins.push(t), t;
    }
    function $e() {
        return xe.constructor || (xe.constructor = function(t, e) {
            const n = [], r = function() {
                for (const t of n) t.call(this);
            }, {prototype: i} = r;
            re(r, "name", se(t));
            for (const t of e) for (let [e, r] of Object.entries(t)) if ("init" === e) n.push(r); else {
                if ("function" == typeof r) ; else {
                    let t = i[e];
                    if (void 0 !== t) if (t?.constructor === Object) r = Object.assign({
                        ...t
                    }, r); else if (t !== r) throw new Error(`Duplicate property: ${e}`);
                }
                re(i, e, se(r));
            }
            return r;
        }(xe.name, xe.mixins), xe.name = "", xe.mixins = []), xe.constructor;
    }
    function Te(t, e, n) {
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
                    let a, l, u = 0, f = c, h = r.getUint8(f), d = h & s, g = t, b = e + g;
                    do {
                        b > g && (a = i.getUint8(u++), d |= a << g, g += 8), b >= 8 ? l = 255 & d : (h = r.getUint8(f), 
                        l = h & o | d & n), r.setUint8(f++, l), d >>= 8, g -= 8, b -= 8;
                    } while (b > 0);
                };
            }
        }
    }
    Oe({
        init() {
            this.accessorCache = new Map;
        },
        getAccessor(t, e) {
            const {type: n, bitSize: r, bitOffset: i, byteSize: s} = e, o = [], c = void 0 === s && (7 & r || 7 & i);
            c && o.push("Unaligned");
            let a = R[n];
            r > 32 && (n === D.Int || n === D.Uint) && (a = r <= 64 ? `Big${a}` : `Jumbo${a}`), 
            o.push(a, `${n === D.Bool && s ? 8 * s : r}`), c && o.push(`@${i}`);
            const l = t + o.join("");
            let u = DataView.prototype[l];
            if (u && this.usingBufferFallback()) {
                const e = this, i = u, s = function(t) {
                    const {buffer: e, byteOffset: n, byteLength: i} = this, s = e[Rt];
                    if (s) {
                        if (t < 0 || t + r / 8 > i) throw new RangeError("Offset is outside the bounds of the DataView");
                        return s + Number(n + t);
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
            return re(u, "name", se(l)), this.accessorCache.set(l, u), u;
        },
        imports: {
            getNumericValue: null,
            setNumericValue: null
        }
    }), Oe({
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
    }), Oe({
        getAccessorBigUint(t, e) {
            const {bitSize: n} = e, r = 2n ** BigInt(n) - 1n;
            return "get" === t ? function(t, e) {
                return this.getBigInt64(t, e) & r;
            } : function(t, e, n) {
                const i = e & r;
                this.setBigUint64(t, i, n);
            };
        }
    }), Oe({
        getAccessorBool(t, e) {
            const {byteSize: n} = e, r = 8 * n, i = this.getAccessor(t, {
                type: D.Uint,
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
    }), Oe({
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
    }), Oe({
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
    }), Oe({
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
    }), Oe({
        getAccessorInt(t, e) {
            const {bitSize: n, byteSize: r} = e;
            if (r) {
                const e = this.getAccessor(t, {
                    type: D.Uint,
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
    }), Oe({
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
    }), Oe({
        getAccessorJumboUint(t, e) {
            const {bitSize: n} = e, r = this.getJumboAccessor(t, n), i = 2n ** BigInt(n) - 1n;
            return "get" === t ? function(t, e) {
                return r.call(this, t, e) & i;
            } : function(t, e, n) {
                const s = e & i;
                r.call(this, t, s, n);
            };
        }
    }), Oe({
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
    }), Oe({
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
    }), Oe({
        getAccessorUnalignedBool1(t, e) {
            const {bitOffset: n} = e, r = 1 << (7 & n);
            return "get" === t ? function(t) {
                return !!(this.getInt8(t) & r);
            } : function(t, e) {
                const n = this.getInt8(t), i = e ? n | r : n & ~r;
                this.setInt8(t, i);
            };
        }
    }), Oe({
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
    }), Oe({
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
    }), Oe({
        getAccessorUnaligned(t, e) {
            const {bitSize: n, bitOffset: r} = e, i = 7 & r, s = [ 1, 2, 4, 8 ].find((t => 8 * t >= n)) ?? 64 * Math.ceil(n / 64), o = new DataView(new ArrayBuffer(s));
            if ("get" === t) {
                const t = this.getAccessor("get", {
                    ...e,
                    byteSize: s
                }), r = Te(i, n, !0);
                return function(e, n) {
                    return r(o, this, e), t.call(o, 0, n);
                };
            }
            {
                const t = this.getAccessor("set", {
                    ...e,
                    byteSize: s
                }), r = Te(i, n, !1);
                return function(e, n, i) {
                    t.call(o, 0, n, i), r(this, o, e);
                };
            }
        }
    }), Oe({
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
            const {type: n, byteSize: r, typedArray: i} = t, s = 1 !== r ? "s" : "", o = [ "ArrayBuffer", "DataView" ].map(Fe);
            let c;
            i && o.push(Fe(i.name)), c = n === e.Slice ? `Expecting ${ke(o)} that can accommodate items ${r} byte${s} in length` : `Expecting ${ke(o)} that is ${r} byte${s} in length`, 
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
            "string" === r || "number" === r || Be(e) ? (Be(e) && (e = `{ error: ${JSON.stringify(e.error)} }`), 
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
            if (Array.isArray(e)) for (const t of e) i.push(Fe(t)); else i.push(Fe(e));
            const s = je(n);
            super(`${r} expects ${ke(i)} as argument, received ${s}`);
        }
    }
    class InvalidArrayInitializer extends InvalidInitializer {
        constructor(t, n, r = !1) {
            const {instance: {members: [i]}, type: s, constructor: o} = t, c = [], a = ce(i);
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
            o[Nt] && c.push(o[Nt].name), s === e.Slice && r && c.push("length"), super(t, c.join(" or "), n);
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
                this.message = `Expecting ${s}${t} argument${i}, received ${e}`, this.stack = ze(this.stack, "new Arg(");
            };
            r(0), re(this, Jt, {
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
            const n = je(e);
            super(`Expected ${Fe(t)}, received ${n}`);
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
                r = `${Ne(t)} ${t}`;
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
            super(`${(r > 32 ? "Big" : "") + R[n] + r} cannot represent the value given: ${e}`);
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
            if (t instanceof Error) return super(t.message), t.stack = ze(this.stack, e), t;
            super(t ?? "Error encountered in Zig code");
        }
    }
    function Ue(t, e) {
        const n = n => {
            e -= n, t.message = `args[${e}]: ${t.message}`, t.stack = ze(t.stack, "new Arg(");
        };
        return n(0), re(t, Jt, {
            value: n,
            enumerable: !1
        }), t;
    }
    function ze(t, e) {
        if ("string" == typeof t) {
            const n = t.split("\n"), r = n.findIndex((t => t.includes(e)));
            -1 !== r && (n.splice(1, r), t = n.join("\n"));
        }
        return t;
    }
    function Ce() {
        throw new ReadOnly;
    }
    function Be(t) {
        return "object" == typeof t && "string" == typeof t.error && 1 === Object.keys(t).length;
    }
    function je(t) {
        const e = typeof t;
        let n;
        return n = "object" === e ? t ? Object.prototype.toString.call(t) : "null" : e, 
        Fe(n);
    }
    function Fe(t) {
        return `${Ne(t)} ${t}`;
    }
    function Ne(t) {
        return /^\W*[aeiou]/i.test(t) ? "an" : "a";
    }
    function ke(t, e = "or") {
        const n = ` ${e} `;
        return t.length > 2 ? t.slice(0, -1).join(", ") + n + t[t.length - 1] : t.join(n);
    }
    function Pe(t) {
        let n, r = 1, i = null;
        if (t instanceof DataView) {
            n = t;
            const e = n?.[at]?.align;
            e && (r = e);
        } else if (t instanceof ArrayBuffer) n = new DataView(t); else if (t) if (t[st]) t.constructor[ut] === e.Pointer && (t = t["*"]), 
        n = t[st], i = t.constructor, r = i[Tt]; else {
            "string" == typeof t && (t = le(t));
            const {buffer: e, byteOffset: i, byteLength: s, BYTES_PER_ELEMENT: o} = t;
            e && void 0 !== i && void 0 !== s && (n = new DataView(e, i, s), r = o);
        }
        return {
            dv: n,
            align: r,
            constructor: i
        };
    }
    Oe({
        defineAlloc: () => ({
            value(t, e = 1) {
                const n = Math.clz32(e);
                if (e !== 1 << 31 - n) throw new Error(`Invalid alignment: ${e}`);
                const r = 31 - n, {vtable: {alloc: i}, ptr: s} = this, o = i(s, t, r, 0);
                if (!o) throw new Error("Out of memory");
                o.length = t;
                const c = o["*"][st];
                return c[at].align = e, c;
            }
        }),
        defineFree() {
            const t = this;
            return {
                value(e) {
                    const {dv: n, align: r} = Pe(e), i = n?.[at];
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
                    const {dv: n, align: r, constructor: i} = Pe(e);
                    if (!n) throw new TypeMismatch("string, DataView, typed array, or Zig object", e);
                    const s = this.alloc(n.byteLength, r);
                    return t(s, n), i ? i(s) : s;
                }
            };
        }
    }), Oe({
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
                sizeOf: e => t(e?.[Ot]),
                alignOf: e => t(e?.[Tt]),
                typeOf: e => Le[t(e?.[ut])]
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
                        const {array: s, offset: o, length: c} = e, a = this.obtainView(r(s), o, c), {handle: l, const: u} = t, f = i?.constructor, h = t.actual = f.call(zt, a);
                        return u && this.makeReadOnly(h), t.slots && n(h[ot], t.slots), l && this.variables.push({
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
                        o[st] = this.obtainView(r(t), e, s), i && this.variables.push({
                            handle: i,
                            object: o
                        });
                    }
                    if (e) {
                        const t = o[ot] = {};
                        s.set(t, e);
                    }
                }
                this.defineStructure(e);
            }
            for (const [t, e] of s) n(t, e);
            for (const e of t) this.finalizeStructure(e);
        }
    });
    const Le = n.map((t => t.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()));
    Oe({
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
                const t = this.getViewAddress(e[st]), i = this.createJsThunk(t, n);
                if (!i) throw new Error("Unable to create function thunk");
                r = this.obtainZigView(i, 0), this.jsFunctionThunkMap.set(n, r), this.jsFunctionControllerMap.set(n, e);
            }
            return r;
        },
        createInboundCaller(t, e) {
            const n = this.getFunctionId(t);
            return this.jsFunctionCallerMap.set(n, ((n, r) => {
                let i = H, s = !1;
                try {
                    const o = e(n);
                    if (Wt in o) {
                        o[Wt]("reset");
                        const t = this.startContext();
                        this.updatePointerTargets(t, o, !0), this.updateShadowTargets(t), this.endContext();
                    }
                    const c = function(t) {
                        try {
                            if (!(e[kt] && t instanceof Error)) throw t;
                            o[ee](t);
                        } catch (e) {
                            i = X, console.error(t);
                        }
                    }, a = function(t) {
                        try {
                            o[ee](t);
                        } catch (t) {
                            i = X, console.error(t);
                        }
                    };
                    try {
                        const e = t(...o), n = o.hasOwnProperty(ee);
                        if ("Promise" === e?.[Symbol.toStringTag]) if (r || n) {
                            const t = e.then(a, c);
                            r && t.then((() => this.finalizeAsyncCall(r, i))), s = !0, i = H;
                        } else i = Y; else if (e?.[Symbol.asyncIterator]) {
                            if (!o.hasOwnProperty(ne)) throw new UnexpectedGenerator;
                            this.pipeContents(e, o), i = H;
                        } else null == e && n || a(e);
                    } catch (t) {
                        c(t);
                    }
                } catch (t) {
                    console.error(t), i = X;
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
                        f === D.Object && d?.[st]?.[at] && (d = new d.constructor(d)), u.type === e.Struct && (u.flags & g ? (t = 1 === r ? "allocator" : "allocator" + ++s, 
                        h = this[Dt] = d) : u.flags & b ? (t = "callback", 1 == ++o && (h = n.createPromiseCallback(this, d))) : u.flags & y ? (t = "callback", 
                        1 == ++o && (h = n.createGeneratorCallback(this, d))) : u.flags & p && (t = "signal", 
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
            return s ? s(i, r) : X;
        },
        releaseFunction(t) {
            const e = this.jsFunctionThunkMap.get(t), n = this.jsFunctionControllerMap.get(t);
            if (e && n) {
                const r = this.getViewAddress(n[st]), i = this.getViewAddress(e);
                this.destroyJsThunk(r, i), this.releaseZigView(e), t && (this.jsFunctionThunkMap.delete(t), 
                this.jsFunctionCallerMap.delete(t), this.jsFunctionControllerMap.delete(t));
            }
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
    }), Oe({
        createOutboundCaller(t, e) {
            const n = this, r = function(...i) {
                const s = new e(i, this?.[Dt]);
                return n.invokeThunk(t, r, s);
            };
            return r;
        },
        copyArguments(t, n, r, i, s) {
            let o = 0, c = 0, a = 0;
            const l = t[Ft];
            for (const {type: u, structure: f} of r) {
                let r, h, d, m;
                if (f.type === e.Struct) if (f.flags & g) {
                    r = (1 == ++a ? i?.allocator ?? i?.allocator1 : i?.[`allocator${a}`]) ?? this.createDefaultAllocator(t, f);
                } else f.flags & b ? (h ||= this.createPromise(t, i?.callback), r = h) : f.flags & y ? (d ||= this.createGenerator(t, i?.callback), 
                r = d) : f.flags & p && (m ||= this.createSignal(f, i?.signal), r = m);
                if (void 0 === r && (r = n[c++], void 0 === r && u !== D.Void)) throw new UndefinedArgument;
                try {
                    l[o++].call(t, r, s);
                } catch (t) {
                    throw Ue(t, o - 1);
                }
            }
        },
        invokeThunk(t, e, n) {
            const r = this.startContext(), i = n[Ct], s = this.getViewAddress(t[st]), o = this.getViewAddress(e[st]), c = Qt in n, a = Wt in n;
            a && this.updatePointerAddresses(r, n);
            const l = this.getViewAddress(n[st]), u = i ? this.getViewAddress(i[st]) : 0;
            this.updateShadows(r);
            const f = () => {
                this.updateShadowTargets(r), a && this.updatePointerTargets(r, n), this.libc && this.flushStdout?.(), 
                this.flushConsole?.(), this.endContext();
            };
            c && (n[Qt] = f);
            if (!(i ? this.runVariadicThunk(s, o, l, u, i.length) : this.runThunk(s, o, l))) throw f(), 
            new ZigError;
            if (c) {
                let t = null;
                try {
                    t = n.retval;
                } catch (e) {
                    t = new ZigError(e, 1);
                }
                return null != t ? (e[qt] && t && (t = t.string), n[ee](t)) : e[qt] && (n[qt] = !0), 
                n[Pt] ?? n[Lt];
            }
            f();
            try {
                const {retval: t} = n;
                return e[qt] && t ? t.string : t;
            } catch (t) {
                throw new ZigError(t, 1);
            }
        },
        imports: {
            runThunk: null,
            runVariadicThunk: null
        }
    }), Oe({
        init() {
            const t = {
                type: D.Int,
                bitSize: 8,
                byteSize: 1
            }, e = {
                type: D.Int,
                bitSize: 16,
                byteSize: 2
            }, n = {
                type: D.Int,
                bitSize: 32,
                byteSize: 4
            }, r = this.getAccessor("get", t), i = this.getAccessor("set", t), s = this.getAccessor("get", e), o = this.getAccessor("set", e), c = this.getAccessor("get", n), a = this.getAccessor("set", n);
            this.copiers = {
                0: Me,
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
                0: Me,
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
                    const e = t[st], r = this[st];
                    n(r, e);
                }
            };
        },
        defineResetter(t, e) {
            const n = this.getResetFunction(e);
            return {
                value() {
                    const r = this[st];
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
    }), Oe({
        init() {
            this.defaultAllocator = null, this.vtableFnIds = null;
        },
        createDefaultAllocator(t, e) {
            let n = this.defaultAllocator;
            if (!n) {
                const {constructor: t} = e, {noResize: r, noRemap: i} = t, s = {
                    alloc: (t, e, n) => this.allocateHostMemory(e, 1 << n),
                    free: (t, e, n) => {
                        const r = this.getViewAddress(e["*"][st]), i = e.length;
                        this.freeHostMemory(r, i, 1 << n);
                    },
                    resize: r
                };
                i && (s.remap = i);
                const o = this.obtainZigView(be, 0);
                n = this.defaultAllocator = new t({
                    ptr: o,
                    vtable: s
                }), this.vtableFnIds = [ s.alloc, s.free ].map((t => this.getFunctionId(t)));
            }
            return n;
        },
        freeDefaultAllocator() {
            if (this.vtableFnIds) {
                for (const t of this.vtableFnIds) this.releaseFunction(t);
                this.defaultAllocator = null, this.vtableFnIds = null;
            }
        },
        allocateHostMemory(t, e) {
            const n = this.allocateJSMemory(t, e);
            {
                const r = this.getViewAddress(n);
                return this.registerMemory(r, t, e, !0, n), re(n, at, {
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
    }), Oe({
        createGenerator(t, e) {
            if (e) {
                if ("function" != typeof e) throw new TypeMismatch("function", e);
            } else {
                const n = t[Lt] = new AsyncGenerator;
                e = n.push.bind(n);
            }
            const n = async (r, i) => {
                const s = i instanceof Error;
                !s && t[qt] && i && (i = i.string);
                if (!1 === await (2 === e.length ? e(s ? i : null, s ? null : i) : e(i)) || s || null === i) {
                    t[Qt]();
                    const e = this.getFunctionId(n);
                    return this.releaseFunction(e), !1;
                }
                return !0;
            };
            return t[ee] = t => n(null, t), {
                ptr: null,
                callback: n
            };
        },
        createGeneratorCallback(t, e) {
            const {ptr: n, callback: r} = e, i = r["*"];
            return t[ne] = e => i.call(t, n, e), (...e) => {
                const n = 2 === e.length ? e[0] ?? e[1] : e[0];
                return t[ne](n);
            };
        },
        async pipeContents(t, e) {
            try {
                try {
                    const n = t[Symbol.asyncIterator]();
                    for await (const t of n) if (null !== t && !e[ne](t)) break;
                    e[ne](null);
                } catch (t) {
                    if (!e.constructor[kt]) throw t;
                    e[ne](t);
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
    function De(t, e) {
        return he(t, e, (t => t.address));
    }
    function Re(t, n) {
        const {byteSize: r, type: i} = n;
        if (!(i === e.Slice ? t.byteLength % r == 0 : t.byteLength === r)) throw new BufferSizeMismatch(n, t);
    }
    function Ze(t) {
        throw new BufferExpected(t);
    }
    Oe({
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
    }), Oe({
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
            const i = e[st];
            if (n) {
                if (void 0 === n.address) {
                    const {start: e, end: s, targets: o} = n;
                    let c, a = 0;
                    for (const t of o) {
                        const e = t[st], n = e.byteOffset, r = t.constructor[Tt] ?? e[Tt];
                        (void 0 === a || r > a) && (a = r, c = n);
                    }
                    const l = s - e, u = this.allocateShadowMemory(l + a, 1), f = this.getViewAddress(u), h = ge(ye(f, c - e), a), d = ye(h, e - c);
                    for (const t of o) {
                        const n = t[st], r = n.byteOffset;
                        if (r !== c) {
                            const i = t.constructor[Tt] ?? n[Tt];
                            if (de(ye(d, r - e), i)) throw new AlignmentConflict(i, a);
                        }
                    }
                    const g = u.byteOffset + Number(d - f), b = new DataView(u.buffer, g, l), y = new DataView(i.buffer, Number(e), l), p = this.registerMemory(d, l, 1, r, y, b);
                    t.shadowList.push(p), n.address = d;
                }
                return ye(n.address, i.byteOffset - n.start);
            }
            {
                const n = e.constructor[Tt] ?? i[Tt], s = i.byteLength, o = this.allocateShadowMemory(s, n), c = this.getViewAddress(o), a = this.registerMemory(c, s, 1, r, i, o);
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
            const o = De(this.memoryList, t);
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
            const n = De(this.memoryList, t), r = this.memoryList[n - 1];
            if (r?.address === t && r.len === e) return this.memoryList.splice(n - 1, 1), r;
        },
        findMemory(t, e, n, r) {
            let i = n * (r ?? 0);
            const s = De(this.memoryList, e), o = this.memoryList[s - 1];
            let c;
            if (o?.address === e && o.len === i) c = o.targetDV; else if (o?.address <= e && ye(e, i) <= ye(o.address, o.len)) {
                const t = Number(e - o.address), n = void 0 === r, {targetDV: s} = o;
                n && (i = s.byteLength - t), c = this.obtainView(s.buffer, s.byteOffset + t, i), 
                n && (c[Tt] = o.align);
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
            const e = t[at], n = e?.address;
            n && -1 !== n && (e.address = -1, this.unregisterBuffer(ye(n, -t.byteOffset)));
        },
        getViewAddress(t) {
            const e = t[at];
            if (e) return e.address;
            {
                const e = this.getBufferAddress(t.buffer);
                return ye(e, t.byteOffset);
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
                }(t) && (t = e > 0 ? 0 : be), !t && e) return null;
                let r, i;
                if (n) {
                    const n = De(this.externBufferList, t), s = this.externBufferList[n - 1];
                    s?.address <= t && ye(t, e) <= ye(s.address, s.len) ? (r = s.buffer, i = Number(t - s.address)) : (r = e > 0 ? this.obtainExternBuffer(t, e, Rt) : new ArrayBuffer(0), 
                    this.externBufferList.splice(n, 0, {
                        address: t,
                        len: e,
                        buffer: r
                    }), i = 0);
                } else r = this.obtainExternBuffer(t, e, Rt), i = 0;
                return r[at] = {
                    address: t,
                    len: e
                }, this.obtainView(r, i, e);
            },
            unregisterBuffer(t) {
                const e = De(this.externBufferList, t), n = this.externBufferList[e - 1];
                n?.address === t && this.externBufferList.splice(e - 1, 1);
            },
            getTargetAddress(t, e, n, r) {
                const i = e[st];
                if (n) {
                    if (void 0 === n.misaligned) {
                        const t = this.getBufferAddress(i.buffer);
                        for (const e of n.targets) {
                            const r = e[st].byteOffset, i = e.constructor[Tt], s = ye(t, r);
                            if (de(s, i)) {
                                n.misaligned = !0;
                                break;
                            }
                        }
                        void 0 === n.misaligned && (n.misaligned = !1, n.address = t);
                    }
                    if (!n.misaligned) return ye(n.address, i.byteOffset);
                } else {
                    const t = e.constructor[Tt], n = this.getViewAddress(i);
                    if (!de(n, t)) {
                        const e = i.byteLength;
                        return this.registerMemory(n, e, t, r, i), n;
                    }
                }
                return this.getShadowAddress(t, e, n, r);
            }
        }
    }), Oe({
        init() {
            this.abandoned = !1;
        },
        releaseFunctions() {
            const t = () => {
                throw new Error("Module was abandoned");
            };
            for (const e of Object.keys(this.imports)) this[e] && (this[e] = t);
        },
        abandonModule() {
            this.abandoned || (this.releaseFunctions(), this.unlinkVariables?.(), this.abandoned = !0);
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
    }), Oe({
        linkVariables(t) {
            const e = this.getCopyFunction();
            for (const {object: n, handle: r} of this.variables) {
                const i = n[st], s = this.recreateAddress(r), o = n[st] = this.obtainZigView(s, i.byteLength);
                t && e(o, i), n.constructor[xt]?.save?.(o, n);
                const c = t => {
                    const e = t[ot];
                    if (e) {
                        const t = o.byteOffset;
                        for (const n of Object.values(e)) if (n) {
                            const e = n[st];
                            if (e.buffer === i.buffer) {
                                const r = t + e.byteOffset - i.byteOffset;
                                n[st] = this.obtainView(o.buffer, r, e.byteLength), n.constructor[xt]?.save?.(o, n), 
                                c(n);
                            }
                        }
                    }
                };
                c(n), n[Wt]?.((function() {
                    this[Jt]();
                }), et.IgnoreInactive);
            }
        },
        unlinkVariables() {
            const t = this.getCopyFunction();
            for (const {object: e} of this.variables) {
                const n = e[st], r = n[at];
                if (r) {
                    t(e[st] = this.allocateMemory(r.len), n);
                }
            }
        },
        imports: {
            recreateAddress: null
        }
    }), Oe({
        updatePointerAddresses(t, e) {
            const n = new Map, r = new Map, i = [], s = function(t) {
                const e = this[bt];
                if (void 0 === n.get(e)) {
                    const t = e[ot][0];
                    if (t) {
                        const o = {
                            target: t,
                            writable: !e.constructor.const
                        }, c = t[st];
                        if (c[at]) n.set(e, null); else {
                            n.set(e, t);
                            const a = r.get(c.buffer);
                            if (a) {
                                const t = Array.isArray(a) ? a : [ a ], e = he(t, c.byteOffset, (t => t.target[st].byteOffset));
                                t.splice(e, 0, o), Array.isArray(a) || (r.set(c.buffer, t), i.push(t));
                            } else r.set(c.buffer, o);
                            t[Wt]?.(s, 0);
                        }
                    }
                }
            }, o = et.IgnoreRetval | et.IgnoreInactive;
            e[Wt](s, o);
            const c = this.findTargetClusters(i), a = new Map;
            for (const t of c) for (const e of t.targets) a.set(e, t);
            for (const [e, r] of n) if (r) {
                const n = a.get(r), i = n?.writable ?? !e.constructor.const;
                e[At] = this.getTargetAddress(t, r, n, i), It in e && (e[It] = r.length);
            }
        },
        updatePointerTargets(t, e, n = !1) {
            const r = new Map, i = function(e) {
                const n = this[bt];
                if (!r.get(n)) {
                    r.set(n, !0);
                    const s = n[ot][0], o = s && e & et.IsImmutable ? s : n[Jt](t, !0, !(e & et.IsInactive)), c = n.constructor.const ? et.IsImmutable : 0;
                    c & et.IsImmutable || s && !s[st][at] && s[Wt]?.(i, c), o !== s && o && !o[st][at] && o?.[Wt]?.(i, c);
                }
            }, s = n ? et.IgnoreRetval : 0;
            e[Wt](i, s);
        },
        findTargetClusters(t) {
            const e = [];
            for (const n of t) {
                let t = null, r = 0, i = 0, s = null;
                for (const {target: o, writable: c} of n) {
                    const n = o[st], {byteOffset: a, byteLength: l} = n, u = a + l;
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
    }), Oe({
        createPromise(t, e) {
            if (e) {
                if ("function" != typeof e) throw new TypeMismatch("function", e);
            } else t[Pt] = new Promise(((n, r) => {
                e = e => {
                    e?.[st]?.[at] && (e = new e.constructor(e)), e instanceof Error ? r(e) : (t[qt] && e && (e = e.string), 
                    n(e));
                };
            }));
            const n = (r, i) => {
                if (2 === e.length) {
                    const t = i instanceof Error;
                    e(t ? i : null, t ? null : i);
                } else e(i);
                t[Qt]();
                const s = this.getFunctionId(n);
                this.releaseFunction(s);
            };
            return t[ee] = t => n(null, t), {
                ptr: null,
                callback: n
            };
        },
        createPromiseCallback(t, e) {
            const {ptr: n, callback: r} = e, i = r["*"];
            return t[ee] = e => i.call(t, n, e), (...e) => {
                const n = 2 === e.length ? e[0] ?? e[1] : e[0];
                return t[ee](n);
            };
        }
    }), Oe({
        addRuntimeCheck: t => function(e, n) {
            const r = t.call(this, e, n);
            if ("set" === e) {
                const {min: t, max: e} = function(t) {
                    const {type: e, bitSize: n} = t, r = e === D.Int;
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
    }), Oe({
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
            e.log?.call?.(e, ae(t));
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
                return n && this.writeToConsole(n) ? H : X;
            }
        }
    }), Oe({
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
            const n = t ? t[ot] : this.slots;
            return n?.[e];
        },
        writeSlot(t, e, n) {
            const r = t ? t[ot] : this.slots;
            r && (r[e] = n);
        },
        createTemplate: t => ({
            [st]: t,
            [ot]: {}
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
                return n[at].handle = r, n;
            }
        },
        castView(t, e, n, r, i) {
            const {constructor: o, flags: c} = r, a = this.captureView(t, e, n, i), l = o.call(zt, a);
            return c & s && this.updatePointerTargets(null, l), n && e > 0 && this.makeReadOnly?.(l), 
            l;
        },
        acquireStructures() {
            const t = this.getModuleAttributes();
            this.littleEndian = !!(t & K), this.runtimeSafety = !!(t & Q), this.libc = !!(t & tt);
            const e = this.getFactoryThunk(), n = {
                [st]: this.obtainZigView(e, 0)
            };
            this.comptime = !0, this.mixinUsage = new Map, this.invokeThunk(n, n, n), this.comptime = !1;
            for (const t of this.structures) {
                const {constructor: e, flags: n, instance: {template: r}} = t;
                if (n & s && r && r[st]) {
                    const t = Object.create(e.prototype);
                    t[st] = r[st], t[ot] = r[ot], this.updatePointerTargets(null, t);
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
            for (const e of we(this.structures, ot)) {
                const n = e[st]?.[at];
                if (n) {
                    const {address: r, len: i, handle: s} = n, o = e[st] = this.captureView(r, i, !0);
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
            for (const e of t) if (!e.replaced) for (const n of t) if (e !== n && !n.replaced && !n.handle && e.address <= n.address && ye(n.address, n.len) <= ye(e.address, e.len)) {
                const t = e.owner[st], r = Number(n.address - e.address) + t.byteOffset;
                n.owner[st] = this.obtainView(t.buffer, r, n.len), n.replaced = !0;
            }
        },
        useStructures() {
            const t = this.getRootModule(), e = we(this.structures, ot);
            for (const t of e) t[st]?.[at] && this.variables.push({
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
              case D.Bool:
                return "bool";

              case D.Int:
                return r & c ? "isize" : `i${e.bitSize}`;

              case D.Uint:
                return r & c ? "usize" : `u${e.bitSize}`;

              case D.Float:
                return `f${e.bitSize}`;

              case D.Void:
                return "void";

              case D.Literal:
                return "enum_literal";

              case D.Null:
                return "null";

              case D.Undefined:
                return "undefined";

              case D.Type:
                return "type";

              case D.Object:
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
            return t.flags & B ? "anyerror" : "ES" + this.structureCounters.errorSet++;
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
            if (n.structure.type === e.Slice && (s = s.slice(3)), r & E && (i = r & V ? "[]" : r & M ? "[*c]" : "[*]"), 
            !(r & M)) {
                const t = n.structure.constructor?.[yt];
                t && (i = i.slice(0, -1) + `:${t.value}` + i.slice(-1));
            }
            return r & x && (i = `${i}const `), i + s;
        },
        getSliceName(t) {
            const {instance: {members: [e]}, flags: n} = t;
            return n & C ? "anyopaque" : `[_]${e.structure.name}`;
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
    }), Oe({}), Oe({
        init() {
            this.viewMap = new WeakMap, this.needFallback = void 0;
        },
        extractView(t, n, r = Ze) {
            const {type: i, byteSize: s, constructor: o} = t;
            let c;
            const a = n?.[Symbol.toStringTag];
            if (a && ("DataView" === a ? c = this.registerView(n) : "ArrayBuffer" === a ? c = this.obtainView(n, 0, n.byteLength) : (a && a === o[Nt]?.name || "Uint8ClampedArray" === a && o[Nt] === Uint8Array || "Uint8Array" === a && n instanceof Buffer) && (c = this.obtainView(n.buffer, n.byteOffset, n.byteLength))), 
            !c) {
                const r = n?.[st];
                if (r) {
                    const {constructor: o, instance: {members: [c]}} = t;
                    if (Se(n, o)) return r;
                    if (function(t) {
                        return t === e.Array || t === e.Vector || t === e.Slice;
                    }(i)) {
                        const {byteSize: o, structure: {constructor: a}} = c, l = me(n, a);
                        if (void 0 !== l) {
                            if (i === e.Slice || l * o === s) return r;
                            throw new ArrayLengthMismatch(t, null, n);
                        }
                    }
                }
            }
            return c ? void 0 !== s && Re(c, t) : r?.(t, n), c;
        },
        assignView(t, n, r, i, s) {
            const {byteSize: o, type: c} = r, a = o ?? 1;
            if (t[st]) {
                const i = c === e.Slice ? a * t.length : a;
                if (n.byteLength !== i) throw new BufferSizeMismatch(r, n, t);
                const s = {
                    [st]: n
                };
                t.constructor[yt]?.validateData?.(s, t.length), t[Ht](s);
            } else {
                void 0 !== o && Re(n, r);
                const e = n.byteLength / a, c = {
                    [st]: n
                };
                t.constructor[yt]?.validateData?.(c, e), s && (i = !0), t[Xt](i ? null : n, e, s), 
                i && t[Ht](c);
            }
            if (this.usingBufferFallback()) {
                const e = t[st], n = e.buffer[Rt];
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
                const r = t[at];
                r && (s[at] = {
                    address: ye(r.address, e),
                    len: n
                });
            }
            return s;
        },
        registerView(t) {
            if (!t[at]) {
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
                const n = e > qe && this.getBufferAddress ? e : 0, r = new ArrayBuffer(t + n);
                let i = 0;
                if (n) {
                    const t = this.getBufferAddress(r);
                    i = ge(t, e) - t;
                }
                return this.obtainView(r, Number(i), t);
            }
        }
    });
    const qe = [ "arm64", "ppc64", "x64", "s390x" ].includes(process.arch) ? 16 : 8;
    Oe({}), Oe({
        makeReadOnly(t) {
            _e(t);
        }
    });
    const Je = Object.getOwnPropertyDescriptors, Ge = Object.defineProperty;
    function _e(t) {
        const e = t[bt];
        if (e) We(e, [ "length" ]); else {
            const e = t[pt];
            e ? (We(e), function(t) {
                Ge(t, "set", {
                    value: Ce
                });
                const e = t.get;
                Ge(t, "get", {
                    value: function(t) {
                        const n = e.call(this, t);
                        return null === n?.[Ut] && _e(n), n;
                    }
                });
            }(e)) : We(t);
        }
    }
    function We(t, e = []) {
        const n = Je(t.constructor.prototype);
        for (const [r, i] of Object.entries(n)) i.set && !e.includes(r) && (i.set = Ce, 
        Ge(t, r, i));
        Ge(t, Ut, {
            value: t
        });
    }
    function He() {
        const t = this[pt] ?? this, e = this.length;
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
    function Xe(t) {
        const e = oe(t), n = this[pt] ?? this, r = this.length;
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
            [Symbol.iterator]: Xe.bind(this, t),
            length: this.length
        };
    }
    function Ke(t) {
        return {
            [Symbol.iterator]: tn.bind(this, t),
            length: this[gt].length
        };
    }
    function Qe(t) {
        return Ke.call(this, t)[Symbol.iterator]();
    }
    function tn(t) {
        const e = oe(t), n = this, r = this[gt];
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
    function en(t) {
        return {
            [Symbol.iterator]: rn.bind(this, t),
            length: this[gt].length
        };
    }
    function nn(t) {
        return en.call(this, t)[Symbol.iterator]();
    }
    function rn(t) {
        const e = oe(t), n = this, r = this[gt], i = this[jt];
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
    function sn() {
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
    function on() {
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
    function cn() {
        return {
            [Symbol.iterator]: on.bind(this),
            length: this.length
        };
    }
    function an(t = {}) {
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
    function ln(t, {get: e, set: n}) {
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
    function un(t) {
        return fn.call(this, t).$;
    }
    function fn(t) {
        return this[ot][t] ?? this[_t](t);
    }
    function hn(t) {
        const e = fn.call(this, t).$;
        return e ? e.string : e;
    }
    function dn(t, e, n) {
        fn.call(this, t)[Yt](e, n);
    }
    Oe({
        defineArrayEntries: () => se(Ye),
        defineArrayIterator: () => se(He)
    }), Oe({
        defineStructEntries: () => se(Ke),
        defineStructIterator: () => se(Qe)
    }), Oe({
        defineUnionEntries: () => se(en),
        defineUnionIterator: () => se(nn)
    }), Oe({
        defineVectorEntries: () => se(cn),
        defineVectorIterator: () => se(sn)
    }), Oe({
        defineZigIterator: () => se(an)
    }), Oe({
        defineMember(t, e = !0) {
            if (!t) return {};
            const {type: r, structure: i} = t, s = this[`defineMember${R[r]}`].call(this, t);
            if (e && i) {
                const {type: e} = i, r = this[`transformDescriptor${n[e]}`];
                if (r) return r.call(this, s, t);
            }
            return s;
        }
    }), Oe({
        defineBase64(t) {
            const e = this;
            return Ae({
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
    }), Oe({
        defineMemberBool(t) {
            return this.defineMemberUsing(t, this.getAccessor);
        }
    }), Oe({
        defineClampedArray(t) {
            const e = this, n = Uint8ClampedArray;
            return Ae({
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
    }), Oe({
        defineDataView(t) {
            const e = this;
            return Ae({
                get() {
                    const t = this[st];
                    if (e.usingBufferFallback()) {
                        const n = t.buffer[Rt];
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
    }), Oe({
        defineMemberFloat(t) {
            return this.defineMemberUsing(t, this.getAccessor);
        }
    }), Oe({
        defineMemberInt(t) {
            let e = this.getAccessor;
            return this.runtimeSafety && (e = this.addRuntimeCheck(e)), e = this.addIntConversion(e), 
            this.defineMemberUsing(t, e);
        }
    }), Oe({
        defineMemberLiteral(t) {
            const {slot: e} = t;
            return ln(e, {
                get(t) {
                    return this[ot][t].string;
                },
                set: Ce
            });
        }
    }), Oe({
        defineMemberNull: t => ({
            get: function() {
                return null;
            },
            set: Ce
        })
    }), Oe({
        defineMemberObject: t => ln(t.slot, {
            get: t.flags & W ? hn : t.structure.flags & r ? un : fn,
            set: t.flags & q ? Ce : dn
        })
    }), Oe({
        ...{
            defineMemberUsing(t, e) {
                const {littleEndian: n} = this, {bitOffset: r, byteSize: i} = t, s = e.call(this, "get", t), o = e.call(this, "set", t);
                if (void 0 !== r) {
                    const t = r >> 3;
                    return {
                        get: function() {
                            return s.call(this[st], t, n);
                        },
                        set: function(e) {
                            return o.call(this[st], t, e, n);
                        }
                    };
                }
                return {
                    get: function(e) {
                        try {
                            return s.call(this[st], e * i, n);
                        } catch (n) {
                            throw function(t, e, n) {
                                return n instanceof RangeError && !(n instanceof OutOfBound) && (n = new OutOfBound(t, e)), 
                                n;
                            }(t, e, n);
                        }
                    },
                    set: function(t, e) {
                        return o.call(this[st], t * i, e, n);
                    }
                };
            }
        }
    }), Oe({
        defineSentinel(t) {
            const {byteSize: e, instance: {members: [n, r], template: i}} = t, {get: s} = this.defineMember(r), {get: o} = this.defineMember(n), c = s.call(i, 0), a = !!(r.flags & Z), {runtimeSafety: l} = this;
            return se({
                value: c,
                bytes: i[st],
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
                    } else if (r > 0 && r * e === n[st].byteLength) {
                        if (o.call(n, r - 1) !== c) throw new MissingSentinel(t, c, r);
                    }
                },
                isRequired: a
            });
        },
        imports: {
            findSentinel: null
        }
    }), Oe({
        defineString(t) {
            const e = this, {byteSize: n} = t.instance.members[0], r = "utf-" + 8 * n;
            return Ae({
                get() {
                    let t = ae(this.typedArray, r);
                    const e = this.constructor[yt]?.value;
                    return void 0 !== e && t.charCodeAt(t.length - 1) === e && (t = t.slice(0, -1)), 
                    t;
                },
                set(n, i) {
                    if ("string" != typeof n) throw new TypeMismatch("string", n);
                    const s = this.constructor[yt]?.value;
                    void 0 !== s && n.charCodeAt(n.length - 1) !== s && (n += String.fromCharCode(s));
                    const o = le(n, r), c = new DataView(o.buffer);
                    e.assignView(this, c, t, !1, i);
                }
            });
        }
    }), Oe({
        defineValueOf: () => ({
            value() {
                return yn(this, !1);
            }
        })
    });
    const gn = BigInt(Number.MAX_SAFE_INTEGER), bn = BigInt(Number.MIN_SAFE_INTEGER);
    function yn(t, n) {
        const r = {
            error: n ? "return" : "throw"
        }, i = oe(r), s = new Map, o = function(t) {
            const c = "function" == typeof t ? e.Struct : t?.constructor?.[ut];
            if (void 0 === c) {
                if (n) {
                    if ("bigint" == typeof t && bn <= t && t <= gn) return Number(t);
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
                    n = t[wt](r), a = t.constructor[ft] & d ? [] : {};
                    break;

                  case e.Union:
                    n = t[wt](r), a = {};
                    break;

                  case e.Array:
                  case e.Vector:
                  case e.Slice:
                    n = t[wt](), a = [];
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
    Oe({
        defineToJSON: () => ({
            value() {
                return yn(this, !0);
            }
        })
    }), Oe({
        defineMemberType(t, e) {
            const {slot: n} = t;
            return ln(n, {
                get(t) {
                    const e = this[ot][t];
                    return e?.constructor;
                },
                set: Ce
            });
        }
    }), Oe({
        defineTypedArray(t) {
            const e = this, n = this.getTypedArray(t);
            return Ae({
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
    }), Oe({
        defineMemberUint(t) {
            let e = this.getAccessor;
            return this.runtimeSafety && (e = this.addRuntimeCheck(e)), e = this.addIntConversion(e), 
            this.defineMemberUsing(t, e);
        }
    }), Oe({
        defineMemberUndefined: t => ({
            get: function() {},
            set: Ce
        })
    }), Oe({
        defineMemberUnsupported(t) {
            const e = function() {
                throw new Unsupported;
            };
            return {
                get: e,
                set: e
            };
        }
    }), Oe({
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
    }), Oe({
        defineStructure(t) {
            const {type: e, byteSize: r} = t, i = this[`define${n[e]}`], s = [], o = {}, c = {
                dataView: this.defineDataView(t),
                base64: this.defineBase64(t),
                toJSON: this.defineToJSON(),
                valueOf: this.defineValueOf(),
                [Ut]: {
                    value: null
                },
                [Ft]: se(o),
                [St]: se(s),
                [Ht]: this.defineCopier(r)
            }, a = t.constructor = i.call(this, t, c);
            for (const [t, e] of Object.entries(c)) {
                const n = e?.set;
                n && !o[t] && "$" !== t && (o[t] = n, s.push(t));
            }
            return ie(a.prototype, c), a;
        },
        finalizeStructure(t) {
            const {name: r, type: i, constructor: s, align: o, byteSize: c, flags: a, signature: l, static: {members: u, template: f}} = t, h = [], d = {
                name: se(r),
                toJSON: this.defineToJSON(),
                valueOf: this.defineValueOf(),
                [Zt]: se(l),
                [zt]: se(this),
                [Tt]: se(o),
                [Ot]: se(c),
                [ut]: se(i),
                [ft]: se(a),
                [gt]: se(h),
                [Nt]: se(this.getTypedArray(t)),
                [Symbol.iterator]: this.defineStructIterator(),
                [wt]: this.defineStructEntries(),
                [gt]: se(h)
            }, g = {
                [Symbol.toStringTag]: se(r)
            };
            for (const t of u) {
                const {name: n, slot: r, flags: i} = t;
                if (t.structure.type === e.Function) {
                    let e = f[ot][r];
                    i & W && (e[qt] = !0), d[n] = se(e), e.name || re(e, "name", se(n));
                    const [s, o] = /^(get|set)\s+([\s\S]+)/.exec(n)?.slice(1) ?? [], c = "get" === s ? 0 : 1;
                    if (s && e.length === c) {
                        d[o] ||= {};
                        d[o][s] = e;
                    }
                    if (t.flags & G) {
                        const t = function(...t) {
                            try {
                                return e(this, ...t);
                            } catch (t) {
                                throw t[Jt]?.(1), t;
                            }
                        };
                        if (ie(t, {
                            name: se(n),
                            length: se(e.length - 1)
                        }), g[n] = se(t), s && t.length === c) {
                            (g[o] ||= {})[s] = t;
                        }
                    }
                } else d[n] = this.defineMember(t), h.push(n);
            }
            d[ot] = h.length > 0 && se(f[ot]);
            const b = this[`finalize${n[i]}`];
            !1 !== b?.call(this, t, d, g) && (ie(s.prototype, g), ie(s, d));
        },
        createConstructor(t, n = {}) {
            const {type: r, byteSize: i, align: s, flags: c, instance: {members: a, template: l}} = t, {onCastError: u} = n;
            let f;
            if (l?.[ot]) {
                const t = a.filter((t => t.flags & q));
                t.length > 0 && (f = t.map((t => t.slot)));
            }
            const h = new ObjectCache, d = this, g = function(n, a = {}) {
                const {allocator: b} = a, y = this instanceof g;
                let p, m;
                if (y) {
                    if (0 === arguments.length) throw new NoInitializer(t);
                    if (p = this, c & o && (p[ot] = {}), Xt in p) p[Yt](n, b), m = p[st]; else {
                        const t = r !== e.Pointer ? b : null;
                        p[st] = m = d.allocateMemory(i, s, t);
                    }
                } else {
                    if (te in g && (p = g[te].call(this, n, a), !1 !== p)) return p;
                    if (m = d.extractView(t, n, u), p = h.find(m)) return p;
                    p = Object.create(g.prototype), Xt in p ? d.assignView(p, m, t, !1, !1) : p[st] = m, 
                    c & o && (p[ot] = {});
                }
                if (f) for (const t of f) p[ot][t] = l[ot][t];
                return p[Kt]?.(), y && (Xt in p || p[Yt](n, b)), Qt in p && (p = p[Qt]()), h.save(m, p);
            };
            return re(g, xt, se(h)), g;
        },
        createApplier(t) {
            const {instance: {template: e}} = t;
            return function(n, r) {
                const i = Object.keys(n), s = this[St], o = this[Ft];
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
                a < c && 0 === u && e && e[st] && this[Ht](e);
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
                        return globalThis[(e > 4 && n !== D.Float ? "Big" : "") + (n === D.Float ? "Float" : n === D.Int ? "Int" : "Uint") + 8 * e + "Array"];
                    }

                  case e.Array:
                  case e.Slice:
                  case e.Vector:
                    return this.getTypedArray(t.structure);
                }
            }
        }
    }), Oe({
        defineArgStruct(t, e) {
            const {flags: n, byteSize: r, align: c, length: a, instance: {members: l}} = t, u = this, f = l.slice(1), h = function(t, e) {
                const i = this instanceof h;
                let s, l;
                if (i ? (s = this, l = u.allocateMemory(r, c)) : (s = Object.create(h.prototype), 
                l = t), s[st] = l, n & o && (s[ot] = {}), !i) return s;
                {
                    let r;
                    if (n & k && t.length === a + 1 && (r = t.pop()), t.length !== a) throw new ArgumentCountMismatch(a, t.length);
                    n & L && (s[Qt] = null), u.copyArguments(s, t, f, r, e);
                }
            };
            for (const t of l) e[t.name] = this.defineMember(t);
            const d = e.retval.set;
            return e.length = se(f.length), e[_t] = n & i && this.defineVivificatorStruct(t), 
            e[Wt] = n & s && this.defineVisitorArgStruct(l), e[ee] = se((function(t) {
                d.call(this, t, this[Dt]);
            })), e[Symbol.iterator] = this.defineArgIterator?.(f), h;
        },
        finalizeArgStruct(t, e) {
            const {flags: n} = t;
            e[kt] = se(!!(n & P));
        }
    }), Oe({
        defineFinalizerArray: ({get: t, set: e}) => ({
            value() {
                const n = new Proxy(this, pn);
                return ie(this, {
                    [Mt]: {
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
                    const {constructor: e} = r, s = this[st], o = s.byteOffset + n * t, c = i.obtainView(s.buffer, o, n);
                    return this[ot][t] = e.call(ct, c);
                }
            };
        }
    });
    const pn = {
        get(t, e) {
            const n = "symbol" == typeof e ? 0 : 0 | e;
            return 0 !== n || n == e ? t.get(n) : e === pt ? t : t[e];
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
            return e.push("length", Mt), e;
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
    Oe({
        defineArray(t, e) {
            const {length: n, instance: {members: [r]}, flags: o} = t, c = this.createApplier(t), a = this.defineMember(r), {set: h} = a, d = this.createConstructor(t), g = function(e, r) {
                if (Se(e, d)) this[Ht](e), o & s && this[Wt]("copy", et.Vivificate, e); else if ("string" == typeof e && o & l && (e = {
                    string: e
                }), e?.[Symbol.iterator]) {
                    if ((e = pe(e)).length !== n) throw new ArrayLengthMismatch(t, this, e);
                    let i = 0;
                    for (const t of e) h.call(this, i++, t, r);
                } else if (e && "object" == typeof e) {
                    if (0 === c.call(this, e)) throw new InvalidArrayInitializer(t, e);
                } else if (void 0 !== e) throw new InvalidArrayInitializer(t, e);
            };
            return e.$ = {
                get: Ve,
                set: g
            }, e.length = se(n), e.entries = e[wt] = this.defineArrayEntries(), o & u && (e.typedArray = this.defineTypedArray(t), 
            o & l && (e.string = this.defineString(t)), o & f && (e.clampedArray = this.defineClampedArray(t))), 
            e[Symbol.iterator] = this.defineArrayIterator(), e[Yt] = se(g), e[Qt] = this.defineFinalizerArray(a), 
            e[_t] = o & i && this.defineVivificatorArray(t), e[Wt] = o & s && this.defineVisitorArray(), 
            d;
        },
        finalizeArray(t, e) {
            const {flags: n, instance: {members: [r]}} = t;
            e.child = se(r.structure.constructor), e[yt] = n & a && this.defineSentinel(t);
        }
    }), Oe({
        defineEnum(t, e) {
            const {instance: {members: [n]}} = t, r = this.defineMember(n), {get: i, set: s} = r, {get: o} = this.defineMember(n, !1), c = this.createApplier(t), a = [ "string", "number", "tagged union" ], l = this.createConstructor(t, {
                onCastError(t, e) {
                    throw new InvalidInitializer(t, a, e);
                }
            });
            return e.$ = r, e.toString = se(Ee), e[Symbol.toPrimitive] = {
                value(t) {
                    switch (t) {
                      case "string":
                      case "default":
                        return this.$[lt];

                      default:
                        return o.call(this);
                    }
                }
            }, e[Yt] = se((function(e) {
                if (e && "object" == typeof e) {
                    if (0 === c.call(this, e)) throw new InvalidInitializer(t, a, e);
                } else void 0 !== e && s.call(this, e);
            })), l;
        },
        finalizeEnum(t, e) {
            const {flags: n, constructor: r, instance: {members: [i]}, static: {members: s, template: o}} = t, c = o[ot], {get: a, set: l} = this.defineMember(i, !1), u = {};
            for (const {name: t, flags: n, slot: r} of s) if (n & J) {
                const n = c[r];
                re(n, lt, se(t));
                const i = a.call(n);
                e[t] = {
                    value: n,
                    writable: !1
                }, u[i] = n;
            }
            e[te] = {
                value(t) {
                    if ("string" == typeof t) return r[t];
                    if ("number" == typeof t || "bigint" == typeof t) {
                        let e = u[t];
                        if (!e && n & A) {
                            e = new r(void 0), l.call(e, t);
                            const n = `${t}`;
                            re(e, lt, se(n)), re(r, n, se(e)), u[t] = e;
                        }
                        return e;
                    }
                    return t instanceof r ? t : t?.[dt] instanceof r && t[dt];
                }
            }, e[Nt] = se(this.getTypedArray(t));
        },
        transformDescriptorEnum(t, e) {
            const {type: n, structure: r} = e;
            if (n === D.Object) return t;
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
    }), Oe({
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
            if (this.currentGlobalSet && i & B) return this.currentGlobalSet;
            const s = this.defineMember(r), {set: o} = s, c = [ "string", "number" ], a = this.createApplier(t), l = this.createConstructor(t, {
                onCastError(t, e) {
                    throw new InvalidInitializer(t, c, e);
                }
            });
            return n.$ = s, n[Yt] = se((function(e) {
                if (e instanceof l[ht]) o.call(this, e); else if (e && "object" == typeof e && !Be(e)) {
                    if (0 === a.call(this, e)) throw new InvalidInitializer(t, c, e);
                } else void 0 !== e && o.call(this, e);
            })), l;
        },
        finalizeErrorSet(t, e) {
            const {constructor: n, flags: r, instance: {members: [i]}, static: {members: s, template: o}} = t;
            if (this.currentGlobalSet && r & B) return !1;
            const c = o?.[ot] ?? {}, {get: a} = this.defineMember(i, !1);
            for (const {name: t, slot: n} of s) {
                const r = c[n], i = a.call(r);
                let s = this.currentGlobalSet[i], o = !0;
                s || (s = new this.currentErrorClass(t, i), o = !1);
                const l = se(s), u = String(s);
                e[t] = e[u] = e[i] = l, o || (ie(this.currentGlobalSet, {
                    [i]: l,
                    [u]: l,
                    [t]: l
                }), this.currentGlobalSet[gt].push(t));
            }
            e[te] = {
                value: t => "number" == typeof t || "string" == typeof t ? n[t] : t instanceof n[ht] ? n[Number(t)] : Be(t) ? n[`Error: ${t.error}`] : t instanceof Error && void 0
            }, e[ht] = se(this.currentErrorClass);
        },
        transformDescriptorErrorSet(t, e) {
            const {type: n, structure: r} = e;
            if (n === D.Object) return t;
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
    function mn(t, e) {
        return ve(t?.constructor?.child, e) && t["*"];
    }
    function wn(t, e, n) {
        if (n & E) {
            if (t?.constructor?.child?.child === e.child && t["*"]) return !0;
            if (n & M && mn(t, e.child)) return !0;
        }
        return !1;
    }
    Oe({
        defineErrorUnion(t, e) {
            const {instance: {members: [n, r]}, flags: o} = t, {get: c, set: a} = this.defineMember(n), {get: l, set: u} = this.defineMember(r), {get: f, set: h} = this.defineMember(r, !1), d = n.type === D.Void, g = r.structure.constructor, b = function() {
                this[Gt](), this[Wt]?.("clear");
            }, y = this.createApplier(t), p = function(e, n) {
                if (Se(e, v)) this[Ht](e), o & s && (f.call(this) || this[Wt]("copy", 0, e)); else if (e instanceof g[ht] && g(e)) u.call(this, e), 
                b.call(this); else if (void 0 !== e || d) try {
                    a.call(this, e, n), h.call(this, 0);
                } catch (n) {
                    if (e instanceof Error) {
                        const n = g[e] ?? g.Unexpected;
                        if (!n) throw new NotInErrorSet(t);
                        u.call(this, n), b.call(this);
                    } else if (Be(e)) u.call(this, e), b.call(this); else {
                        if (!e || "object" != typeof e) throw n;
                        if (0 === y.call(this, e)) throw n;
                    }
                }
            }, {bitOffset: m, byteSize: w} = n, v = this.createConstructor(t);
            return e.$ = {
                get: function() {
                    if (f.call(this)) throw l.call(this);
                    return c.call(this);
                },
                set: p
            }, e[Yt] = se(p), e[_t] = o & i && this.defineVivificatorStruct(t), e[Gt] = this.defineResetter(m / 8, w), 
            e[Wt] = o & s && this.defineVisitorErrorUnion(n, f), v;
        }
    }), Oe({
        defineFunction(t, n) {
            const {instance: {members: [r], template: i}, static: {template: s}} = t, o = new ObjectCache, {structure: {constructor: c}} = r, a = this, l = function(n) {
                const r = this instanceof l;
                let u, f;
                if (r) {
                    if (0 === arguments.length) throw new NoInitializer(t);
                    if ("function" != typeof n) throw new TypeMismatch("function", n);
                    if (c[ut] === e.VariadicStruct || !s) throw new Unsupported;
                    u = a.getFunctionThunk(n, s);
                } else {
                    if (this !== zt) throw new NoCastingToFunction;
                    u = n;
                }
                if (f = o.find(u)) return f;
                const h = c.prototype.length, d = r ? a.createInboundCaller(n, c) : a.createOutboundCaller(i, c);
                return ie(d, {
                    length: se(h),
                    name: se(r ? n.name : "")
                }), Object.setPrototypeOf(d, l.prototype), d[st] = u, o.save(u, d), d;
            };
            return Object.setPrototypeOf(l.prototype, Function.prototype), n.valueOf = n.toJSON = se(Ie), 
            l;
        },
        finalizeFunction(t, e, n) {
            n[Symbol.toStringTag] = void 0;
        }
    }), Oe({
        defineOpaque(t, e) {
            const {flags: n} = t, r = () => {
                throw new AccessingOpaque(t);
            }, i = this.createConstructor(t);
            return e.$ = {
                get: r,
                set: r
            }, e[Symbol.iterator] = n & j && this.defineZigIterator(), e[Symbol.toPrimitive] = {
                value(e) {
                    const {name: n} = t;
                    return `[opaque ${n}]`;
                }
            }, e[Yt] = se((() => {
                throw new CreatingOpaque(t);
            })), i;
        }
    }), Oe({
        defineOptional(t, e) {
            const {instance: {members: [n, r]}, flags: o} = t, {get: c, set: a} = this.defineMember(n), {get: l, set: u} = this.defineMember(r), f = n.type === D.Void, h = function(t, e) {
                Se(t, d) ? (this[Ht](t), o & s && l.call(this) && this[Wt]("copy", et.Vivificate, t)) : null === t ? (u.call(this, 0), 
                this[Gt]?.(), this[Wt]?.("clear")) : (void 0 !== t || f) && (a.call(this, t, e), 
                o & I ? u.call(this, 1) : o & s && (l.call(this) || u.call(this, 13)));
            }, d = t.constructor = this.createConstructor(t), {bitOffset: g, byteSize: b} = n;
            return e.$ = {
                get: function() {
                    return l.call(this) ? c.call(this) : (this[Wt]?.("clear"), null);
                },
                set: h
            }, e[Yt] = se(h), e[Gt] = o & I && this.defineResetter(g / 8, b), e[_t] = o & i && this.defineVivificatorStruct(t), 
            e[Wt] = o & s && this.defineVisitorOptional(n, l), d;
        }
    }), Oe({
        definePointer(t, n) {
            const {flags: i, byteSize: s, instance: {members: [o]}} = t, {structure: a} = o, {type: l, flags: u, byteSize: f = 1} = a, h = i & V ? s / 2 : s, {get: d, set: g} = this.defineMember({
                type: D.Uint,
                bitOffset: 0,
                bitSize: 8 * h,
                byteSize: h,
                structure: {
                    byteSize: h
                }
            }), {get: b, set: y} = i & V ? this.defineMember({
                type: D.Uint,
                bitOffset: 8 * h,
                bitSize: 8 * h,
                byteSize: h,
                structure: {
                    flags: c,
                    byteSize: h
                }
            }) : {}, p = function(t, n = !0, r = !0) {
                if (n || this[st][at]) {
                    if (!r) return this[ot][0] = void 0;
                    {
                        const n = z.child, r = d.call(this), s = i & V ? b.call(this) : l === e.Slice && u & $ ? T.findSentinel(r, n[yt].bytes) + 1 : 1;
                        if (r !== this[Vt] || s !== this[Et]) {
                            const e = T.findMemory(t, r, s, n[Ot]), o = e ? n.call(zt, e) : null;
                            return this[ot][0] = o, this[Vt] = r, this[Et] = s, i & V && (this[vt] = null), 
                            o;
                        }
                    }
                }
                return this[ot][0];
            }, m = function(t) {
                g.call(this, t), this[Vt] = t;
            }, w = u & $ ? 1 : 0, v = i & V || u & $ ? function(t) {
                y?.call?.(this, t - w), this[Et] = t;
            } : null, S = function() {
                const t = this[bt] ?? this, e = !t[ot][0], n = p.call(t, null, e);
                if (!n) {
                    if (i & O) return null;
                    throw new NullPointer;
                }
                return i & x ? Sn(n) : n;
            }, A = u & r ? function() {
                return S.call(this).$;
            } : S, I = i & x ? Ce : function(t) {
                return S.call(this).$ = t;
            }, T = this, U = function(n, r) {
                const s = a.constructor;
                if (mn(n, s)) {
                    if (!(i & x) && n.constructor.const) throw new ConstantConstraint(t, n);
                    n = n[ot][0];
                } else if (i & E) wn(n, s, i) && (n = s(n[ot][0][st])); else if (l === e.Slice && u & C && n) if (n.constructor[ut] === e.Pointer) n = n[mt]?.[st]; else if (n[st]) n = n[st]; else if (n?.buffer instanceof ArrayBuffer && !(n instanceof Uint8Array || n instanceof DataView)) {
                    const {byteOffset: t, byteLength: e} = n;
                    void 0 !== t && void 0 !== e && (n = new DataView(n.buffer, t, e));
                }
                if (n instanceof s) {
                    const e = n[Ut];
                    if (e) {
                        if (!(i & x)) throw new ReadOnlyTarget(t);
                        n = e;
                    }
                } else if (Se(n, s)) n = s.call(zt, n[st]); else if (i & M && i & E && n instanceof s.child) n = s(n[st]); else if (function(t, e) {
                    const n = t?.[Symbol.toStringTag];
                    if (n) {
                        const r = e[Nt];
                        if (r) switch (n) {
                          case r.name:
                          case "DataView":
                            return !0;

                          case "ArrayBuffer":
                            return r === Uint8Array || r === Int8Array;

                          case "Uint8ClampedArray":
                            return r === Uint8Array;
                        }
                        if (e.child && void 0 !== me(t, e.child)) return !0;
                    }
                    return !1;
                }(n, s)) {
                    n = s(T.extractView(a, n));
                } else if (null == n || n[st]) {
                    if (!(void 0 === n || i & O && null === n)) throw new InvalidPointerTarget(t, n);
                } else {
                    if (i & M && i & E && "object" == typeof n && !n[Symbol.iterator]) {
                        let t = !0;
                        const e = s.prototype[Ft];
                        for (const r of Object.keys(n)) {
                            const n = e[r];
                            if (n?.special) {
                                t = !1;
                                break;
                            }
                        }
                        t && (n = [ n ]);
                    }
                    if (Nt in s && n?.buffer && n[Symbol.iterator]) throw new InvalidPointerTarget(t, n);
                    n = new s(n, {
                        allocator: r
                    });
                }
                const o = n?.[st]?.[at];
                if (-1 === o?.address) throw new PreviouslyFreed(n);
                this[mt] = n;
            }, z = this.createConstructor(t);
            return n["*"] = {
                get: A,
                set: I
            }, n.$ = {
                get: Ve,
                set: U
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
                    const n = e[st], r = n[at];
                    let s;
                    if (!r) if (i & V) this[vt] ||= e.length, s = this[vt]; else {
                        s = (n.buffer.byteLength - n.byteOffset) / f | 0;
                    }
                    if (t < 0 || t > s) throw new InvalidSliceLength(t, s);
                    const o = t * f, c = r ? T.obtainZigView(r.address, o) : T.obtainView(n.buffer, n.byteOffset, o), l = a.constructor;
                    this[ot][0] = l.call(zt, c), v?.call?.(this, t);
                }
            }, n.slice = l === e.Slice && {
                value(t, e) {
                    const n = this[mt].slice(t, e);
                    return new z(n);
                }
            }, n.subarray = l === e.Slice && {
                value(t, e, n) {
                    const r = this[mt].subarray(t, e, n);
                    return new z(r);
                }
            }, n[Symbol.toPrimitive] = l === e.Primitive && {
                value(t) {
                    return this[mt][Symbol.toPrimitive](t);
                }
            }, n[Yt] = se(U), n[Qt] = {
                value() {
                    const t = l !== e.Pointer ? An : {};
                    let n;
                    l === e.Function ? (n = function() {}, n[st] = this[st], n[ot] = this[ot], Object.setPrototypeOf(n, z.prototype)) : n = this;
                    const r = new Proxy(n, t);
                    return Object.defineProperty(n, Mt, {
                        value: r
                    }), r;
                }
            }, n[mt] = {
                get: S,
                set: function(t) {
                    if (void 0 === t) return;
                    const e = this[bt] ?? this;
                    if (t) {
                        const n = t[st][at];
                        if (n) {
                            const {address: e, js: r} = n;
                            m.call(this, e), v?.call?.(this, t.length), r && (t[st][at] = void 0);
                        } else if (e[st][at]) throw new ZigMemoryTargetRequired;
                    } else e[st][at] && (m.call(this, 0), v?.call?.(this, 0));
                    e[ot][0] = t ?? null, i & V && (e[vt] = null);
                }
            }, n[Jt] = se(p), n[At] = {
                set: m
            }, n[It] = {
                set: v
            }, n[Wt] = this.defineVisitor(), n[Vt] = se(0), n[Et] = se(0), n[vt] = i & V && se(null), 
            n.dataView = n.base64 = void 0, z;
        },
        finalizePointer(t, n) {
            const {flags: r, constructor: i, instance: {members: [s]}} = t, {structure: o} = s, {type: c, constructor: a} = o;
            n.child = a ? se(a) : {
                get: () => o.constructor
            }, n.const = se(!!(r & x)), n[te] = {
                value(n, s) {
                    if (this === zt || this === ct || n instanceof i) return !1;
                    if (mn(n, a)) return new i(a(n["*"]), s);
                    if (wn(n, a, r)) return new i(n);
                    if (c === e.Slice) return new i(a(n), s);
                    throw new NoCastingToPointer(t);
                }
            };
        }
    });
    const vn = new WeakMap;
    function Sn(t) {
        let e = vn.get(t);
        if (!e) {
            const n = t[bt];
            e = n ? new Proxy(n, In) : new Proxy(t, Vn), vn.set(t, e);
        }
        return e;
    }
    const An = {
        get(t, e) {
            if (e === bt) return t;
            if (e in t) return t[e];
            return t[mt][e];
        },
        set(t, e, n) {
            if (e in t) t[e] = n; else {
                t[mt][e] = n;
            }
            return !0;
        },
        deleteProperty(t, e) {
            if (e in t) delete t[e]; else {
                delete t[mt][e];
            }
            return !0;
        },
        has(t, e) {
            if (e in t) return !0;
            return e in t[mt];
        },
        apply: (t, e, n) => t["*"].apply(e, n)
    }, In = {
        ...An,
        set(t, e, n) {
            if (e in t) Ce(); else {
                t[mt][e] = n;
            }
            return !0;
        }
    }, Vn = {
        get(t, e) {
            if (e === Ut) return t;
            {
                const n = t[e];
                return n?.[st] ? Sn(n) : n;
            }
        },
        set(t, e, n) {
            Ce();
        }
    };
    function En() {
        return this[It];
    }
    function Mn(t, e) {
        return (t |= 0) < 0 ? (t = e + t) < 0 && (t = 0) : t > e && (t = e), t;
    }
    function xn() {
        throw new InaccessiblePointer;
    }
    function On() {
        const t = {
            get: xn,
            set: xn
        };
        ie(this[bt], {
            "*": t,
            $: t,
            [bt]: t,
            [mt]: t
        });
    }
    function $n(t, e, n, r) {
        let i, s = this[ot][t];
        if (!s) {
            if (n & et.IgnoreUncreated) return;
            s = this[_t](t);
        }
        r && (i = r[ot][t], !i) || s[Wt](e, n, i);
    }
    Oe({
        definePrimitive(t, e) {
            const {instance: {members: [n]}} = t, r = this.createApplier(t), {get: i, set: s} = this.defineMember(n), o = function(e) {
                if (Se(e, c)) this[Ht](e); else if (e && "object" == typeof e) {
                    if (0 === r.call(this, e)) {
                        const r = ce(n);
                        throw new InvalidInitializer(t, r, e);
                    }
                } else void 0 !== e && s.call(this, e);
            }, c = this.createConstructor(t);
            return e.$ = {
                get: i,
                set: o
            }, e[Yt] = se(o), e[Symbol.toPrimitive] = se(i), c;
        },
        finalizePrimitive(t, e) {
            const {instance: {members: [n]}} = t;
            e[$t] = se(n.bitSize), e[Bt] = se(n.type);
        }
    }), Oe({
        defineSlice(t, e) {
            const {align: n, flags: r, byteSize: o, name: c, instance: {members: [a]}} = t, {byteSize: l, structure: u} = a, f = this, h = function(t, e, r) {
                t || (t = f.allocateMemory(e * l, n, r)), this[st] = t, this[It] = e;
            }, d = function(e, n) {
                if (n !== this[It]) throw new ArrayLengthMismatch(t, this, e);
            }, g = this.defineMember(a), {set: b} = g, y = this.createApplier(t), p = function(e, n) {
                if (Se(e, w)) this[st] ? d.call(this, e, e.length) : h.call(this, null, e.length, n), 
                this[Ht](e), r & s && this[Wt]("copy", et.Vivificate, e); else if ("string" == typeof e && r & T) p.call(this, {
                    string: e
                }, n); else if (e?.[Symbol.iterator]) {
                    e = pe(e), this[st] ? d.call(this, e, e.length) : h.call(this, null, e.length, n);
                    let t = 0;
                    for (const r of e) w[yt]?.validateValue(r, t, e.length), b.call(this, t++, r, n);
                } else if ("number" == typeof e) {
                    if (!(!this[st] && e >= 0 && isFinite(e))) throw new InvalidArrayInitializer(t, e, !this[st]);
                    h.call(this, null, e, n);
                } else if (e && "object" == typeof e) {
                    if (0 === y.call(this, e, n)) throw new InvalidArrayInitializer(t, e);
                } else if (void 0 !== e) throw new InvalidArrayInitializer(t, e);
            }, m = function(t, e) {
                const n = this[It], r = this[st];
                t = void 0 === t ? 0 : Mn(t, n), e = void 0 === e ? n : Mn(e, n);
                const i = t * l, s = e * l - i;
                return f.obtainView(r.buffer, r.byteOffset + i, s);
            }, w = this.createConstructor(t);
            return e.$ = {
                get: Ve,
                set: p
            }, e.length = {
                get: En
            }, r & U && (e.typedArray = this.defineTypedArray(t), r & T && (e.string = this.defineString(t)), 
            r & z && (e.clampedArray = this.defineClampedArray(t))), e.entries = e[wt] = this.defineArrayEntries(), 
            e.subarray = {
                value(t, e) {
                    const n = m.call(this, t, e);
                    return w(n);
                }
            }, e.slice = {
                value(t, e, r = {}) {
                    const {zig: i = !1} = r, s = m.call(this, t, e), o = f.allocateMemory(s.byteLength, n, i), c = w(o);
                    return c[Ht]({
                        [st]: s
                    }), c;
                }
            }, e[Symbol.iterator] = this.defineArrayIterator(), e[Xt] = se(h), e[Ht] = this.defineCopier(o, !0), 
            e[Yt] = se(p), e[Qt] = this.defineFinalizerArray(g), e[_t] = r & i && this.defineVivificatorArray(t), 
            e[Wt] = r & s && this.defineVisitorArray(), w;
        },
        finalizeSlice(t, e) {
            const {flags: n, instance: {members: [r]}} = t;
            e.child = se(r.structure.constructor), e[yt] = n & $ && this.defineSentinel(t);
        }
    }), Oe({
        defineVivificatorStruct(t) {
            const {instance: {members: e}} = t, n = {};
            for (const t of e.filter((t => t.type === D.Object))) n[t.slot] = t;
            const r = this;
            return {
                value(t) {
                    const e = n[t], {bitOffset: i, byteSize: s, structure: {constructor: o}} = e, c = this[st], a = c.byteOffset + (i >> 3);
                    let l = s;
                    if (void 0 === l) {
                        if (7 & i) throw new NotOnByteBoundary(e);
                        l = e.bitSize >> 3;
                    }
                    const u = r.obtainView(c.buffer, a, l);
                    return this[ot][t] = o.call(ct, u);
                }
            };
        }
    }), Oe({
        defineStruct(t, e) {
            const {flags: n, length: r, instance: {members: o}} = t, c = o.find((t => t.flags & _)), a = c && this.defineMember(c), l = this.createApplier(t), u = function(e, r) {
                if (Se(e, f)) this[Ht](e), n & s && this[Wt]("copy", 0, e); else if (e && "object" == typeof e) l.call(this, e, r); else if ("number" != typeof e && "bigint" != typeof e || !a) {
                    if (void 0 !== e) throw new InvalidInitializer(t, "object", e);
                } else a.set.call(this, e);
            }, f = this.createConstructor(t), b = e[Ft].value, y = e[St].value, p = [];
            for (const t of o.filter((t => !!t.name))) {
                const {name: n, flags: r} = t, {set: i} = e[n] = this.defineMember(t);
                i && (r & Z && (i.required = !0), b[n] = i, y.push(n)), p.push(n);
            }
            return e.$ = {
                get: Ie,
                set: u
            }, e.length = se(r), e.entries = n & d && this.defineVectorEntries(), e[Symbol.toPrimitive] = a && {
                value(t) {
                    return "string" === t ? Object.prototype.toString.call(this) : a.get.call(this);
                }
            }, e[Symbol.iterator] = n & h ? this.defineZigIterator() : n & d ? this.defineVectorIterator() : this.defineStructIterator(), 
            e[Yt] = se(u), e[_t] = n & i && this.defineVivificatorStruct(t), e[Wt] = n & s && this.defineVisitorStruct(o), 
            e[wt] = n & d ? this.defineVectorEntries() : this.defineStructEntries(), e[gt] = se(p), 
            n & g && (e.alloc = this.defineAlloc(), e.free = this.defineFree(), e.dupe = this.defineDupe()), 
            f;
        }
    }), Oe({
        defineUnion(t, e) {
            const {flags: n, instance: {members: r}} = t, o = !!(n & m), c = o ? r.slice(0, -1) : r, a = o ? r[r.length - 1] : null, {get: l, set: u} = this.defineMember(a), {get: f} = this.defineMember(a, !1), h = n & w ? function() {
                return l.call(this)[lt];
            } : function() {
                const t = l.call(this);
                return c[t].name;
            }, d = n & w ? function(t) {
                const {constructor: e} = a.structure;
                u.call(this, e[t]);
            } : function(t) {
                const e = c.findIndex((e => e.name === t));
                u.call(this, e);
            }, g = this.createApplier(t), b = function(e, r) {
                if (Se(e, y)) this[Ht](e), n & s && this[Wt]("copy", et.Vivificate, e); else if (e && "object" == typeof e) {
                    let n = 0;
                    for (const t of V) t in e && n++;
                    if (n > 1) throw new MultipleUnionInitializers(t);
                    if (0 === g.call(this, e, r)) throw new MissingUnionInitializer(t, e, o);
                } else if (void 0 !== e) throw new InvalidInitializer(t, "object with a single property", e);
            }, y = this.createConstructor(t), p = {}, A = e[Ft].value, I = e[St].value, V = [];
            for (const r of c) {
                const {name: i} = r, {get: s, set: c} = this.defineMember(r), a = o ? function() {
                    const e = h.call(this);
                    if (i !== e) {
                        if (n & w) return null;
                        throw new InactiveUnionProperty(t, i, e);
                    }
                    return this[Wt]?.("clear"), s.call(this);
                } : s, l = o && c ? function(e) {
                    const n = h.call(this);
                    if (i !== n) throw new InactiveUnionProperty(t, i, n);
                    c.call(this, e);
                } : c, u = o && c ? function(t) {
                    d.call(this, i), c.call(this, t), this[Wt]?.("clear");
                } : c;
                e[i] = {
                    get: a,
                    set: l
                }, A[i] = u, p[i] = s, I.push(i), V.push(i);
            }
            e.$ = {
                get: function() {
                    return this;
                },
                set: b
            }, e[Symbol.iterator] = n & S ? this.defineZigIterator() : this.defineUnionIterator(), 
            e[Symbol.toPrimitive] = n & w && {
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
            const {comptime: E} = this;
            return e[Kt] = n & v && {
                value() {
                    return E || this[Wt](On), this[Wt] = Me, this;
                }
            }, e[Yt] = se(b), e[dt] = n & w && {
                get: l,
                set: u
            }, e[_t] = n & i && this.defineVivificatorStruct(t), e[Wt] = n & s && this.defineVisitorUnion(c, n & w ? f : null), 
            e[wt] = this.defineUnionEntries(), e[gt] = n & w ? {
                get() {
                    return [ h.call(this) ];
                }
            } : se(V), e[jt] = se(p), y;
        },
        finalizeUnion(t, e) {
            const {flags: n, instance: {members: r}} = t;
            n & w && (e.tag = se(r[r.length - 1].structure.constructor));
        }
    }), Oe({
        defineVariadicStruct(t, e) {
            const {byteSize: n, align: r, flags: s, length: o, instance: {members: c}} = t, a = this, l = c.slice(1);
            for (const t of c) e[t.name] = this.defineMember(t);
            const u = e.retval.set, f = function(t) {
                this[st] = a.allocateMemory(8 * t, 4), this.length = t, this.littleEndian = a.littleEndian;
            };
            return ie(f, {
                [Tt]: {
                    value: 4
                }
            }), ie(f.prototype, {
                set: se((function(t, e, n, r, i) {
                    const s = this[st], o = a.littleEndian;
                    s.setUint16(8 * t, e, o), s.setUint16(8 * t + 2, n, o), s.setUint16(8 * t + 4, r, o), 
                    s.setUint8(8 * t + 6, i == D.Float), s.setUint8(8 * t + 7, i == D.Int || i == D.Float);
                }))
            }), e[_t] = s & i && this.defineVivificatorStruct(t), e[Wt] = this.defineVisitorVariadicStruct(c), 
            e[ee] = se((function(t) {
                u.call(this, t, this[Dt]);
            })), function(t) {
                if (t.length < o) throw new ArgumentCountMismatch(o, t.length, !0);
                let e = n, i = r;
                const s = t.slice(o), c = {};
                for (const [t, n] of s.entries()) {
                    const r = n?.[st], s = n?.constructor?.[Tt];
                    if (!r || !s) {
                        throw Ue(new InvalidVariadicArgument, o + t);
                    }
                    s > i && (i = s);
                    e = (c[t] = e + (s - 1) & ~(s - 1)) + r.byteLength;
                }
                const u = new f(t.length), h = a.allocateMemory(e, i);
                h[Tt] = i, this[st] = h, this[ot] = {}, a.copyArguments(this, t, l);
                let d = -1;
                for (const [t, {bitOffset: e, bitSize: n, type: r, slot: i, structure: {align: s}}] of l.entries()) u.set(t, e / 8, n, s, r), 
                i > d && (d = i);
                for (const [t, e] of s.entries()) {
                    const n = d + t + 1, {byteLength: r} = e[st], i = c[t], s = a.obtainView(h.buffer, i, r), l = this[ot][n] = e.constructor.call(ct, s), f = e.constructor[$t] ?? 8 * r, g = e.constructor[Tt], b = e.constructor[Bt];
                    l.$ = e, u.set(o + t, i, f, g, b);
                }
                this[Ct] = u;
            };
        },
        finalizeVariadicStruct(t, e) {
            const {flags: n} = t;
            e[kt] = se(!!(n & P)), e[Tt] = se(void 0);
        }
    }), Oe({
        defineVector(t, e) {
            const {flags: n, length: r, instance: {members: [o]}} = t, c = this.createApplier(t), a = function(e) {
                if (Se(e, l)) this[Ht](e), n & s && this[Wt]("copy", et.Vivificate, e); else if (e?.[Symbol.iterator]) {
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
                get: Ie,
                set: a
            }, e.length = se(r), n & F && (e.typedArray = this.defineTypedArray(t), n & N && (e.clampedArray = this.defineClampedArray(t))), 
            e.entries = e[wt] = this.defineVectorEntries(), e[Symbol.iterator] = this.defineVectorIterator(), 
            e[Yt] = se(a), e[_t] = n & i && this.defineVivificatorArray(t), e[Wt] = n & s && this.defineVisitorArray(), 
            l;
        },
        finalizeVector(t, e) {
            const {instance: {members: [n]}} = t;
            e.child = se(n.structure.constructor);
        }
    }), Oe({
        defineVisitor: () => ({
            value(t, e, n) {
                let r;
                r = "string" == typeof t ? Tn[t] : t, r.call(this, e, n);
            }
        })
    });
    const Tn = {
        copy(t, e) {
            const n = e[ot][0];
            if (this[st][at] && n && !n[st][at]) throw new ZigMemoryTargetRequired;
            this[ot][0] = n;
        },
        clear(t) {
            t & et.IsInactive && (this[ot][0] = void 0);
        },
        reset() {
            this[ot][0] = void 0, this[Vt] = void 0;
        }
    };
    return Oe({
        defineVisitorArgStruct(t) {
            const e = [];
            let n;
            for (const [r, {slot: i, structure: o}] of t.entries()) o.flags & s && (0 === r ? n = i : e.push(i));
            return {
                value(t, r, i) {
                    if (!(r & et.IgnoreArguments) && e.length > 0) for (const n of e) $n.call(this, n, t, r | et.IsImmutable, i);
                    r & et.IgnoreRetval || void 0 === n || $n.call(this, n, t, r, i);
                }
            };
        }
    }), Oe({
        defineVisitorArray: () => ({
            value(t, e, n) {
                for (let r = 0, i = this.length; r < i; r++) $n.call(this, r, t, e, n);
            }
        })
    }), Oe({
        defineVisitorErrorUnion(t, e) {
            const {slot: n} = t;
            return {
                value(t, r, i) {
                    e.call(this) && (r |= et.IsInactive), r & et.IsInactive && r & et.IgnoreInactive || $n.call(this, n, t, r, i);
                }
            };
        }
    }), Oe({
        defineVisitorOptional(t, e) {
            const {slot: n} = t;
            return {
                value(t, r, i) {
                    e.call(this) || (r |= et.IsInactive), r & et.IsInactive && r & et.IgnoreInactive || $n.call(this, n, t, r, i);
                }
            };
        }
    }), Oe({
        defineVisitorStruct(t) {
            const e = t.filter((t => t.structure?.flags & s)).map((t => t.slot));
            return {
                value(t, n, r) {
                    for (const i of e) $n.call(this, i, t, n, r);
                }
            };
        }
    }), Oe({
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
                        e !== s && (n |= et.IsInactive), n & et.IsInactive && n & et.IgnoreInactive || $n.call(this, o, t, n, i);
                    }
                }
            };
        }
    }), Oe({
        defineVisitorVariadicStruct(t) {
            const e = t[0], n = e.structure.flags & s ? e.slot : void 0;
            return {
                value(t, e, r) {
                    if (!(e & et.IgnoreArguments)) for (const [i, s] of Object.entries(this[ot])) i !== n && Wt in s && $n.call(this, i, t, e | et.IsImmutable, r);
                    e & et.IgnoreRetval || void 0 === n || $n.call(this, n, t, e, r);
                }
            };
        }
    }), t.createEnvironment = function() {
        try {
            return new ($e());
        } catch (t) {
            throw console.error(t), t;
        }
    }, t;
}({}))
