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
    }, n = 1, r = 2, i = 3, s = 4, o = 5, a = 6, c = 7, l = 8, u = 9, f = Object.keys(e), h = 1, d = 2, g = 4, p = 8, y = 16, m = {
        IsSize: 32
    }, b = 32, w = 64, v = 128, S = 256, I = {
        IsExtern: 32,
        IsPacked: 64,
        IsTuple: 128,
        IsOptional: 256
    }, A = 32, x = 64, E = 128, M = 32, U = 32, k = 32, O = 64, V = 128, B = 256, T = 512, $ = 32, z = 64, _ = 128, C = 256, F = 512, j = {
        IsGlobal: 32
    }, L = 32, R = 64, P = 32, N = 64, D = 128, W = {
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
    }, Z = Object.keys(W), G = 1, q = 2, J = 4, H = 16, Y = 32, X = 128, K = 256, Q = 512, tt = 1024, et = 2048, nt = {
        Pointer: 1,
        Slice: 2,
        Const: 4,
        ReadOnly: 8
    }, rt = 1, it = 2, st = 4, ot = 8, at = {
        IsInactive: 1,
        IsImmutable: 2,
        IgnoreUncreated: 4,
        IgnoreInactive: 8,
        IgnoreArguments: 16,
        IgnoreRetval: 32
    }, ct = 0, lt = 2, ut = 6, ft = 8, ht = 16, dt = 20, gt = 21, pt = 28, yt = 29, mt = 34, bt = 44, wt = 51, vt = 58, St = 63, It = 70, At = 76, xt = {
        unknown: 0,
        blockDevice: 1,
        characterDevice: 2,
        directory: 3,
        file: 4,
        socketDgram: 5,
        socketStream: 6,
        symbolicLink: 7
    }, Et = {
        create: 1,
        directory: 2,
        exclusive: 4,
        truncate: 8
    }, Mt = {
        symlinkFollow: 1
    }, Ut = {
        fd_datasync: 1,
        fd_read: 2,
        fd_seek: 4,
        fd_fdstat_set_flags: 8,
        fd_sync: 16,
        fd_tell: 32,
        fd_write: 64,
        fd_advise: 128,
        fd_allocate: 256,
        path_create_directory: 512,
        path_create_file: 1024,
        path_link_source: 2048,
        path_link_target: 4096,
        path_open: 8192,
        fd_readdir: 16384,
        path_readlink: 32768,
        path_rename_source: 65536,
        path_rename_target: 1 << 17,
        path_filestat_get: 1 << 18,
        path_filestat_set_size: 1 << 19,
        path_filestat_set_times: 1 << 20,
        fd_filestat_get: 1 << 21,
        fd_filestat_set_size: 1 << 22,
        fd_filestat_set_times: 1 << 23,
        path_symlink: 1 << 24,
        path_remove_directory: 1 << 25,
        path_unlink_file: 1 << 26,
        poll_fd_readwrite: 1 << 27,
        sock_shutdown: 1 << 28,
        sock_accept: 1 << 29
    }, kt = {
        append: 1,
        dsync: 2,
        nonblock: 4,
        rsync: 8,
        sync: 16
    }, Ot = {
        stdin: 0,
        stdout: 1,
        stderr: 2,
        root: -1,
        min: 15728640,
        max: 16777215
    }, Vt = 0, Bt = 1, Tt = 2, $t = globalThis[Symbol.for("ZIGAR")] ??= {};
    function zt(t) {
        return $t[t] ??= Symbol(t);
    }
    function _t(t) {
        return zt(t);
    }
    const Ct = _t("memory"), Ft = _t("slots"), jt = _t("parent"), Lt = _t("zig"), Rt = _t("name"), Pt = _t("type"), Nt = _t("flags"), Dt = _t("class"), Wt = _t("tag"), Zt = _t("props"), Gt = _t("sentinel"), qt = _t("target"), Jt = _t("entries"), Ht = _t("max length"), Yt = _t("keys"), Xt = _t("address"), Kt = _t("length"), Qt = _t("last address"), te = _t("last length"), ee = _t("cache"), ne = _t("size"), re = _t("bit size"), ie = _t("align"), se = _t("environment"), oe = _t("attributes"), ae = _t("primitive"), ce = _t("getters"), le = _t("setters"), ue = _t("typed array"), fe = _t("throwing"), he = _t("promise"), de = _t("generator"), ge = _t("allocator"), pe = _t("fallback"), ye = _t("signature"), me = _t("controller"), be = _t("proxy type"), we = _t("read only"), ve = _t("no cache"), Se = _t("update"), Ie = _t("reset"), Ae = _t("vivificate"), xe = _t("visit"), Ee = _t("shape"), Me = _t("initialize"), Ue = _t("restrict"), ke = _t("finalize"), Oe = _t("proxy"), Ve = _t("cast"), Be = _t("return"), Te = _t("yield"), $e = _t("transform");
    function ze(t, e, n) {
        if (n) {
            const {set: r, get: i, value: s, enumerable: o, configurable: a = !0, writable: c = !0} = n;
            Object.defineProperty(t, e, i || r ? {
                get: i,
                set: r,
                configurable: a,
                enumerable: o
            } : {
                value: s,
                configurable: a,
                enumerable: o,
                writable: c
            });
        }
        return t;
    }
    function _e(t, e) {
        for (const [n, r] of Object.entries(e)) ze(t, n, r);
        for (const n of Object.getOwnPropertySymbols(e)) {
            ze(t, n, e[n]);
        }
        return t;
    }
    function Ce(t) {
        return void 0 !== t ? {
            value: t
        } : void 0;
    }
    function Fe(t) {
        return "return" === t?.error ? t => {
            try {
                return t();
            } catch (t) {
                return t;
            }
        } : t => t();
    }
    function je({type: t, bitSize: e}) {
        switch (t) {
          case W.Bool:
            return "boolean";

          case W.Int:
          case W.Uint:
            if (e > 32) return "bigint";

          case W.Float:
            return "number";
        }
    }
    function Le(t, e = "utf-8") {
        const n = Pe[e] ||= new TextDecoder(e);
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
    function Re(t, e = "utf-8") {
        if ("utf-16" === e) {
            const {length: e} = t, n = new Uint16Array(e);
            for (let r = 0; r < e; r++) n[r] = t.charCodeAt(r);
            return n;
        }
        return (Ne[e] ||= new TextEncoder).encode(t);
    }
    const Pe = {}, Ne = {};
    function De(t, e, n) {
        let r = 0, i = t.length;
        if (0 === i) return 0;
        for (;r < i; ) {
            const s = Math.floor((r + i) / 2);
            n(t[s]) <= e ? r = s + 1 : i = s;
        }
        return i;
    }
    function We(t, e) {
        return !!e && !!(t & BigInt(e - 1));
    }
    function Ze(t, e) {
        return t + BigInt(e - 1) & ~BigInt(e - 1);
    }
    const Ge = 0xFFFFFFFFFFFFFFFFn, qe = -1n;
    function Je(t) {
        return BigInt(t);
    }
    const He = BigInt(Number.MAX_SAFE_INTEGER), Ye = BigInt(Number.MIN_SAFE_INTEGER);
    function Xe(t) {
        if (t > He || t < Ye) throw new RangeError("Number is too big/small");
        return Number(t);
    }
    function Ke(t, e, n) {
        return t.getBigUint64(e, n);
    }
    function Qe(t, e, n) {
        return Xe(Ke(t, e, n));
    }
    function tn(t, e) {
        return t + BigInt(e);
    }
    function en(t) {
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
    function nn(t, e) {
        const {constructor: n} = t;
        return n === e ? 1 : n.child === e ? t.length : void 0;
    }
    function rn(t, e) {
        const n = [], r = new Map, i = t => {
            if (t && !r.get(t) && (r.set(t, !0), n.push(t), t[e])) for (const n of Object.values(t[e])) i(n);
        };
        for (const e of t) i(e.instance.template), i(e.static.template);
        return n;
    }
    function sn(t, e) {
        return t === e || t?.[ye] === e[ye] && t?.[se] !== e?.[se];
    }
    function on(t, e) {
        return t instanceof e || sn(t?.constructor, e);
    }
    function an(t, e) {
        return "function" == typeof t?.[e];
    }
    function cn(t) {
        return "function" == typeof t?.then;
    }
    function ln(t, e) {
        const n = {};
        for (const [r, i] of Object.entries(e)) t & i && (n[r] = !0);
        return n;
    }
    function un(t, e) {
        for (const [n, r] of Object.entries(e)) if (n === t) return r;
    }
    function fn({get: t, set: e}) {
        return t.special = e.special = !0, {
            get: t,
            set: e
        };
    }
    function hn(t) {
        return new DataView(new ArrayBuffer(t));
    }
    function dn(t, e, n = 0) {
        const r = new Uint8Array(t.buffer, t.byteOffset, t.byteLength);
        e[pe]?.(!1, n);
        const i = new Uint8Array(e.buffer, e.byteOffset, e.byteLength);
        r.set(i, n), t[pe]?.(!0, n);
    }
    function gn(t, e = 0, n = t.byteLength - e) {
        new Uint8Array(t.buffer, t.byteOffset, t.byteLength).fill(0, e, e + n), t[pe]?.(!0, e, n);
    }
    function pn(t, e) {
        dn(t[Ct], e[Ct]);
    }
    function yn() {
        return this;
    }
    function mn() {
        return String(this);
    }
    function bn() {}
    class ObjectCache {
        map=new WeakMap;
        find(t) {
            return t[ve] ? void 0 : this.map.get(t);
        }
        save(t, e) {
            t[ve] || this.map.set(t, e);
        }
    }
    const wn = 1, vn = 2, Sn = 4, In = 8, An = () => 1e3 * new Date;
    function xn(t, e, n) {
        const r = {};
        return n & wn ? r.atime = t : n & vn && (r.atime = An()), n & Sn ? r.mtime = e : n & In && (r.mtime = An()), 
        r;
    }
    const En = {
        name: "",
        mixins: []
    };
    function Mn(t) {
        return En.mixins.includes(t) || En.mixins.push(t), t;
    }
    function Un() {
        return function(t, e) {
            const n = [], r = function() {
                for (const t of n) t.call(this);
            }, {prototype: i} = r;
            ze(r, "name", Ce(t));
            for (const t of e) for (let [e, r] of Object.entries(t)) if ("init" === e) n.push(r); else {
                if ("function" == typeof r) ; else {
                    let t = i[e];
                    if (void 0 !== t) if (t?.constructor === Object) r = Object.assign({
                        ...t
                    }, r); else if (t !== r) throw new Error(`Duplicate property: ${e}`);
                }
                ze(i, e, Ce(r));
            }
            return r;
        }(En.name, En.mixins);
    }
    function kn(t, e, n) {
        if (t + e <= 8) {
            const r = 2 ** e - 1;
            if (n) return function(e, n, i) {
                const s = n.getUint8(i) >> t & r;
                e.setUint8(0, s);
            };
            {
                const e = 255 ^ r << t;
                return function(n, i, s) {
                    const o = i.getUint8(0), a = n.getUint8(s) & e | (o & r) << t;
                    n.setUint8(s, a);
                };
            }
        }
        {
            const r = 8 - t, i = 2 ** r - 1;
            if (n) {
                const n = 2 ** (e % 8) - 1;
                return function(s, o, a) {
                    let c, l = a, u = 0, f = o.getUint8(l++), h = f >> t & i, d = r, g = e;
                    do {
                        g > d && (f = o.getUint8(l++), h |= f << d), c = g >= 8 ? 255 & h : h & n, s.setUint8(u++, c), 
                        h >>= 8, g -= 8;
                    } while (g > 0);
                };
            }
            {
                const n = 2 ** ((e - r) % 8) - 1, s = 255 ^ i << t, o = 255 ^ n;
                return function(r, i, a) {
                    let c, l, u = 0, f = a, h = r.getUint8(f), d = h & s, g = t, p = e + g;
                    do {
                        p > g && (c = i.getUint8(u++), d |= c << g, g += 8), p >= 8 ? l = 255 & d : (h = r.getUint8(f), 
                        l = h & o | d & n), r.setUint8(f++, l), d >>= 8, g -= 8, p -= 8;
                    } while (p > 0);
                };
            }
        }
    }
    Mn({
        init() {
            this.accessorCache = new Map;
        },
        getAccessor(t, e) {
            const {type: n, bitSize: r, bitOffset: i, byteSize: s} = e, o = [], a = void 0 === s && (7 & r || 7 & i);
            a && o.push("Unaligned");
            let c = Z[n];
            r > 32 && (n === W.Int || n === W.Uint) && (c = r <= 64 ? `Big${c}` : `Jumbo${c}`), 
            o.push(c, `${n === W.Bool && s ? s << 3 : r}`), a && o.push(`@${i}`);
            const l = t + o.join("");
            let u = this.accessorCache.get(l);
            if (u) return u;
            if (u = DataView.prototype[l], !u) {
                for (;o.length > 0; ) {
                    const n = `getAccessor${o.join("")}`;
                    if (u = this[n]?.(t, e)) break;
                    o.pop();
                }
                if (!u) throw new Error(`No accessor available: ${l}`);
            }
            if (u && this.usingBufferFallback()) {
                const e = u;
                u = "get" === t ? function(t, n) {
                    return this[pe]?.(!1, t, s), e.call(this, t, n);
                } : function(t, n, r) {
                    e.call(this, t, n, r), this[pe]?.(!0, t, s);
                };
            }
            return u.name || ze(u, "name", Ce(l)), this.accessorCache.set(l, u), u;
        }
    }), Mn({
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
    }), Mn({
        getAccessorBigUint(t, e) {
            const {bitSize: n} = e, r = 2n ** BigInt(n) - 1n;
            return "get" === t ? function(t, e) {
                return this.getBigInt64(t, e) & r;
            } : function(t, e, n) {
                const i = e & r;
                this.setBigUint64(t, i, n);
            };
        }
    }), Mn({
        getAccessorBool(t, e) {
            const {byteSize: n} = e, r = 8 * n, i = this.getAccessor(t, {
                type: W.Uint,
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
    }), Mn({
        getAccessorFloat128(t, e) {
            const {byteSize: n} = e, r = hn(8), i = function(t, e) {
                return BigInt(this.getUint32(t + (e ? 0 : n - 4), e)) | BigInt(this.getUint32(t + (e ? 4 : n - 8), e)) << 32n | BigInt(this.getUint32(t + (e ? 8 : n - 12), e)) << 64n | BigInt(this.getUint32(t + (e ? 12 : n - 16), e)) << 96n;
            }, s = function(t, e, r) {
                const i = 0xffffffffn & e, s = e >> 32n & 0xffffffffn, o = e >> 64n & 0xffffffffn, a = e >> 96n & 0xffffffffn;
                this.setUint32(t + (r ? 0 : n - 4), Number(i), r), this.setUint32(t + (r ? 4 : n - 8), Number(s), r), 
                this.setUint32(t + (r ? 8 : n - 12), Number(o), r), this.setUint32(t + (r ? 12 : n - 16), Number(a), r);
            };
            return "get" === t ? function(t, e) {
                const n = i.call(this, t, e), s = n >> 127n, o = (0x7fff0000000000000000000000000000n & n) >> 112n, a = 0x0000ffffffffffffffffffffffffffffn & n;
                if (0n === o) {
                    const t = a ? Number.MIN_VALUE : 0;
                    return s ? -t : t;
                }
                if (0x7fffn === o) return a ? NaN : s ? -1 / 0 : 1 / 0;
                const c = o - 16383n + 1023n;
                if (c >= 2047n) {
                    const t = 1 / 0;
                    return s ? -t : t;
                }
                const l = s << 63n | c << 52n | (a >> 60n) + BigInt((a & 2n ** 60n - 1n) >= 2n ** 59n);
                return r.setBigUint64(0, l, e), r.getFloat64(0, e);
            } : function(t, e, n) {
                r.setFloat64(0, e, n);
                const i = r.getBigUint64(0, n), o = i >> 63n, a = (0x7ff0000000000000n & i) >> 52n, c = 0x000fffffffffffffn & i;
                let l;
                l = 0n === a ? o << 127n | c << 60n : 0x07ffn === a ? o << 127n | 0x7fffn << 112n | (c ? 1n : 0n) : o << 127n | a - 1023n + 16383n << 112n | c << 60n, 
                s.call(this, t, l, n);
            };
        }
    }), Mn({
        getAccessorFloat16(t, e) {
            const n = hn(4), r = DataView.prototype.setUint16, i = DataView.prototype.getUint16;
            return "get" === t ? function(t, e) {
                const r = i.call(this, t, e), s = r >>> 15, o = (31744 & r) >> 10, a = 1023 & r;
                if (0 === o) return s ? -0 : 0;
                if (31 === o) return a ? NaN : s ? -1 / 0 : 1 / 0;
                const c = s << 31 | o - 15 + 127 << 23 | a << 13;
                return n.setUint32(0, c, e), n.getFloat32(0, e);
            } : function(t, e, i) {
                n.setFloat32(0, e, i);
                const s = n.getUint32(0, i), o = s >>> 31, a = (2139095040 & s) >> 23, c = 8388607 & s, l = a - 127 + 15;
                let u;
                u = 0 === a ? o << 15 : 255 === a ? o << 15 | 31744 | (c ? 1 : 0) : l >= 31 ? o << 15 | 31744 : o << 15 | l << 10 | c >> 13, 
                r.call(this, t, u, i);
            };
        }
    }), Mn({
        getAccessorFloat80(t, e) {
            const {byteSize: n} = e, r = hn(8), i = function(t, e) {
                return BigInt(this.getUint32(t + (e ? 0 : n - 4), e)) | BigInt(this.getUint32(t + (e ? 4 : n - 8), e)) << 32n | BigInt(this.getUint32(t + (e ? 8 : n - 12), e)) << 64n;
            }, s = function(t, e, r) {
                const i = 0xffffffffn & e, s = e >> 32n & 0xffffffffn, o = e >> 64n & 0xffffffffn;
                this.setUint32(t + (r ? 0 : n - 4), Number(i), r), this.setUint32(t + (r ? 4 : n - 8), Number(s), r), 
                this.setUint32(t + (r ? 8 : n - 12), Number(o), r);
            };
            return "get" === t ? function(t, e) {
                const n = i.call(this, t, e), s = n >> 79n, o = (0x7fff0000000000000000n & n) >> 64n, a = 0x00007fffffffffffffffn & n;
                if (0n === o) {
                    const t = a ? Number.MIN_VALUE : 0;
                    return s ? -t : t;
                }
                if (0x7fffn === o) return a ? NaN : s ? -1 / 0 : 1 / 0;
                const c = o - 16383n + 1023n;
                if (c >= 2047n) {
                    const t = 1 / 0;
                    return s ? -t : t;
                }
                const l = s << 63n | c << 52n | (a >> 11n) + BigInt((a & 2n ** 11n - 1n) >= 2n ** 10n);
                return r.setBigUint64(0, l, e), r.getFloat64(0, e);
            } : function(t, e, n) {
                r.setFloat64(0, e, n);
                const i = r.getBigUint64(0, n), o = i >> 63n, a = (0x7ff0000000000000n & i) >> 52n, c = 0x000fffffffffffffn & i;
                let l;
                l = 0n === a ? o << 79n | c << 11n : 0x07ffn === a ? o << 79n | 0x7fffn << 64n | (c ? 0x00002000000000000000n : 0n) | 0x00008000000000000000n : o << 79n | a - 1023n + 16383n << 64n | c << 11n | 0x00008000000000000000n, 
                s.call(this, t, l, n);
            };
        }
    }), Mn({
        getAccessorInt(t, e) {
            const {bitSize: n, byteSize: r} = e;
            if (r) {
                const e = this.getAccessor(t, {
                    type: W.Uint,
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
    }), Mn({
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
    }), Mn({
        getAccessorJumboUint(t, e) {
            const {bitSize: n} = e, r = this.getJumboAccessor(t, n), i = 2n ** BigInt(n) - 1n;
            return "get" === t ? function(t, e) {
                return r.call(this, t, e) & i;
            } : function(t, e, n) {
                const s = e & i;
                r.call(this, t, s, n);
            };
        }
    }), Mn({
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
    }), Mn({
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
    }), Mn({
        getAccessorUnalignedBool1(t, e) {
            const {bitOffset: n} = e, r = 1 << (7 & n);
            return "get" === t ? function(t) {
                return !!(this.getInt8(t) & r);
            } : function(t, e) {
                const n = this.getInt8(t), i = e ? n | r : n & ~r;
                this.setInt8(t, i);
            };
        }
    }), Mn({
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
    }), Mn({
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
    }), Mn({
        getAccessorUnaligned(t, e) {
            const {bitSize: n, bitOffset: r} = e, i = 7 & r, s = [ 1, 2, 4, 8 ].find((t => 8 * t >= n)) ?? 64 * Math.ceil(n / 64), o = hn(s);
            if ("get" === t) {
                const t = this.getAccessor("get", {
                    ...e,
                    byteSize: s
                }), r = kn(i, n, !0);
                return function(e, n) {
                    return r(o, this, e), t.call(o, 0, n);
                };
            }
            {
                const t = this.getAccessor("set", {
                    ...e,
                    byteSize: s
                }), r = kn(i, n, !1);
                return function(e, n, i) {
                    t.call(o, 0, n, i), r(this, o, e);
                };
            }
        }
    });
    class InvalidIntConversion extends SyntaxError {
        constructor(t) {
            super(`Cannot convert ${t} to an Int`);
        }
    }
    class Unsupported extends TypeError {
        errno=vt;
        hide=!0;
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
            const {name: i, type: s, byteSize: o} = t, a = n.byteLength, c = 1 !== o ? "s" : "";
            let l;
            if (s !== e.Slice || r) {
                l = `${i} has ${s === e.Slice ? r.length * o : o} byte${c}, received ${a}`;
            } else l = `${i} has elements that are ${o} byte${c} in length, received ${a}`;
            super(l);
        }
    }
    class BufferExpected extends TypeError {
        constructor(t) {
            const {type: n, byteSize: r, typedArray: i} = t, s = 1 !== r ? "s" : "", o = [ "ArrayBuffer", "DataView" ].map(Ln);
            let a;
            i && o.push(Ln(i.name)), a = n === e.Slice ? `Expecting ${Pn(o)} that can accommodate items ${r} byte${s} in length` : `Expecting ${Pn(o)} that is ${r} byte${s} in length`, 
            super(a);
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
            "string" === r || "number" === r || Fn(e) ? (Fn(e) && (e = `{ error: ${JSON.stringify(e.error)} }`), 
            i = `Error ${r} does not corresponds to any error in error set ${n}: ${e}`) : i = `Error of the type ${n} expected, received ${e}`, 
            super(i);
        }
    }
    class NotInErrorSet extends TypeError {
        constructor(t, e) {
            const {name: n} = t;
            super(`Error given is not a part of error set ${n}: ${e}`);
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
            if (Array.isArray(e)) for (const t of e) i.push(Ln(t)); else i.push(Ln(e));
            const s = jn(n);
            super(`${r} expects ${Pn(i)} as argument, received ${s}`);
        }
    }
    class InvalidArrayInitializer extends InvalidInitializer {
        constructor(t, n, r = !1) {
            const {instance: {members: [i]}, type: s, constructor: o} = t, a = [], c = je(i);
            if (c) {
                let t;
                switch (i.structure?.type) {
                  case e.Enum:
                    t = "enum item";
                    break;

                  case e.ErrorSet:
                    t = "error";
                    break;

                  default:
                    t = c;
                }
                a.push(`array of ${t}s`);
            } else a.push("array of objects");
            o[ue] && a.push(o[ue].name), s === e.Slice && r && a.push("length"), super(t, a.join(" or "), n);
        }
    }
    class InvalidEnumValue extends TypeError {
        errno=pt;
        constructor(t, e) {
            super(`Received '${e}', which is not among the following possible values:\n\n${Object.keys(t).map((t => `${t}\n`)).join("")}`);
        }
    }
    class ArrayLengthMismatch extends TypeError {
        constructor(t, e, n) {
            const {name: r, length: i, instance: {members: [s]}} = t, {structure: {constructor: o}} = s, {length: a, constructor: c} = n, l = e?.length ?? i, u = 1 !== l ? "s" : "";
            let f;
            f = c === o ? "only a single one" : c.child === o ? `a slice/array that has ${a}` : `${a} initializer${a > 1 ? "s" : ""}`, 
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
                this.message = `Expecting ${s}${t} argument${i}, received ${e}`, this.stack = Vn(this.stack, "new Arg(");
            };
            r(0), ze(this, Se, {
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
            const n = jn(e);
            super(`Expected ${Ln(t)}, received ${n}`);
        }
    }
    class InvalidStream extends TypeError {
        constructor(t, e) {
            const n = [];
            t & Ut.fd_read && n.push("ReadableStreamDefaultReader", "ReadableStreamBYOBReader", "Blob", "Uint8Array"), 
            t & Ut.fd_write && n.push("WritableStreamDefaultWriter", "array", "null"), t & Ut.fd_readdir && n.push("Map");
            super(`Expected ${n.join(", ")}, or an object with the appropriate stream interface, received ${e}`);
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
                r = `${Rn(t)} ${t}`;
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
            super(`${(r > 32 ? "Big" : "") + Z[n] + r} cannot represent the value given: ${e}`);
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
    class InvalidFileDescriptor extends Error {
        errno=ft;
        constructor() {
            super("Invalid file descriptor");
        }
    }
    class InvalidPath extends Error {
        errno=bt;
        constructor(t) {
            super(`Invalid relative path '${t}'`);
        }
    }
    class MissingStreamMethod extends Error {
        constructor(t, e = It) {
            super(`Missing stream method '${t}'`), this.errno = e, this.hide = e === It;
        }
    }
    class InvalidArgument extends Error {
        errno=pt;
        constructor() {
            super("Invalid argument");
        }
    }
    class WouldBlock extends Error {
        errno=ut;
        hide=!0;
        constructor() {
            super("Would block");
        }
    }
    class TooManyFiles extends Error {
        errno=mt;
        constructor() {
            super("Too many open files");
        }
    }
    class Deadlock extends Error {
        errno=ht;
        constructor() {
            super("Deadlock");
        }
    }
    class ZigError extends Error {
        constructor(t, e = 0) {
            if (t instanceof Error) return super(t.message), t.stack = Vn(this.stack, e), t;
            super(t ?? "Error encountered in Zig code");
        }
    }
    function On(t, e) {
        const n = n => {
            e -= n, t.message = `args[${e}]: ${t.message}`, t.stack = Vn(t.stack, "new Arg(");
        };
        return n(0), ze(t, Se, {
            value: n,
            enumerable: !1
        }), t;
    }
    function Vn(t, e) {
        if ("string" == typeof t) {
            const n = t.split("\n"), r = n.findIndex((t => t.includes(e)));
            -1 !== r && (n.splice(1, r), t = n.join("\n"));
        }
        return t;
    }
    function Bn() {
        throw new ReadOnly;
    }
    function Tn(t, e, n) {
        if (t.bytes += n, t.calls++, 100 === t.calls) {
            const n = t.bytes / t.calls;
            if (n < 8) {
                throw new Error(`Inefficient ${e} access. Each call is only ${"read" === e ? "reading" : "writing"} ${n} byte${1 !== n ? "s" : ""}. Please use std.io.Buffered${"read" === e ? "Reader" : "Writer"}.`);
            }
        }
    }
    function $n(t = !1, e, n, r, i) {
        const s = t => {
            let n;
            return i ? n = i(t) : t.hide || console.error(t), n ?? t.errno ?? e;
        }, o = t => {
            const e = r?.(t);
            return e ?? ct;
        };
        try {
            const e = n();
            if (cn(e)) {
                if (!t) throw new Deadlock;
                return e.then(o).catch(s);
            }
            return o(e);
        } catch (t) {
            return s(t);
        }
    }
    function zn(t, e) {
        if (!(t[0] & e)) throw new InvalidFileDescriptor;
    }
    function _n(t, e, n) {
        if (!an(t, e)) throw new MissingStreamMethod(e, n);
    }
    function Cn(t, e) {
        if (!0 === t) return ct;
        if (!1 === t) return e;
        throw new TypeMismatch("boolean", t);
    }
    function Fn(t) {
        return "object" == typeof t && "string" == typeof t.error && 1 === Object.keys(t).length;
    }
    function jn(t) {
        const e = typeof t;
        let n;
        return n = "object" === e ? t ? Object.prototype.toString.call(t) : "null" : e, 
        Ln(n);
    }
    function Ln(t) {
        return `${Rn(t)} ${t}`;
    }
    function Rn(t) {
        return /^\W*[aeiou]/i.test(t) ? "an" : "a";
    }
    function Pn(t, e = "or") {
        const n = ` ${e} `;
        return t.length > 2 ? t.slice(0, -1).join(", ") + n + t[t.length - 1] : t.join(n);
    }
    function Nn(t) {
        let n, r = 1, i = null;
        if (t instanceof DataView) {
            n = t;
            const e = n?.[Lt]?.align;
            e && (r = e);
        } else if (t instanceof ArrayBuffer) n = new DataView(t); else if (t) if (t[Ct]) t.constructor[Pt] === e.Pointer && (t = t["*"]), 
        n = t[Ct], i = t.constructor, r = i[ie]; else {
            "string" == typeof t && (t = Re(t));
            const {buffer: e, byteOffset: i, byteLength: s, BYTES_PER_ELEMENT: o} = t;
            e && void 0 !== i && void 0 !== s && (n = new DataView(e, i, s), r = o);
        }
        return {
            dv: n,
            align: r,
            constructor: i
        };
    }
    Mn({
        defineAlloc: () => ({
            value(t, e = 1) {
                const n = Math.clz32(e);
                if (e !== 1 << 31 - n) throw new Error(`Invalid alignment: ${e}`);
                const r = 31 - n, {vtable: {alloc: i}, ptr: s} = this, o = i(s, t, r, 0);
                if (!o) throw new Error("Out of memory");
                o.length = t;
                const a = o["*"][Ct];
                return a[Lt].align = e, a;
            }
        }),
        defineFree() {
            const t = this;
            return {
                value(e) {
                    const {dv: n, align: r} = Nn(e), i = n?.[Lt];
                    if (!i) throw new TypeMismatch("object containing allocated Zig memory", e);
                    const {address: s} = i;
                    if (s === qe) throw new PreviouslyFreed(e);
                    const {vtable: {free: o}, ptr: a} = this;
                    o(a, n, 31 - Math.clz32(r), 0), t.releaseZigView(n);
                }
            };
        },
        defineDupe: () => ({
            value(t) {
                const {dv: e, align: n, constructor: r} = Nn(t);
                if (!e) throw new TypeMismatch("string, DataView, typed array, or Zig object", t);
                const i = this.alloc(e.byteLength, n);
                return dn(i, e), r ? r(i) : i;
            }
        })
    });
    const Dn = [ "log", "mkdir", "stat", "utimes", "open", "rename", "readlink", "rmdir", "symlink", "unlink" ];
    Mn({
        init() {
            this.variables = [], this.listenerMap = new Map, this.envVariables = this.envVarArrays = null;
        },
        getSpecialExports() {
            const t = t => {
                if (void 0 === t) throw new Error("Not a Zig type");
                return t;
            };
            return {
                init: () => this.initPromise,
                abandon: () => this.abandonModule?.(),
                redirect: (t, e) => this.redirectStream(t, e),
                sizeOf: e => t(e?.[ne]),
                alignOf: e => t(e?.[ie]),
                typeOf: e => Wn[t(e?.[Pt])],
                on: (t, e) => this.addListener(t, e),
                set: (t, e) => this.setObject(t, e)
            };
        },
        addListener(t, e) {
            const n = Dn.indexOf(t);
            if (!(n >= 0)) throw new Error(`Unknown event: ${t}`);
            if (!this.ioRedirection) throw new Error("Redirection disabled");
            this.listenerMap.set(t, e), n >= 1 && this.setRedirectionMask(t, !!e);
        },
        hasListener(t) {
            return this.listenerMap.get(t);
        },
        setObject(t, e) {
            if ("object" != typeof e) throw new TypeMismatch("object", e);
            if ("env" !== t) throw new Error(`Unknown object: ${t}`);
            this.envVariables = e, this.libc && this.initializeLibc();
        },
        triggerEvent(t, e) {
            const n = this.listenerMap.get(t);
            return n?.(e);
        },
        recreateStructures(t, e) {
            Object.assign(this, e);
            const n = (t, e) => {
                for (const [n, r] of Object.entries(e)) t[n] = s(r);
                return t;
            }, r = [], i = t => t.length ? t.buffer : new ArrayBuffer(0), s = t => {
                const {memory: e, structure: s, actual: o, slots: a} = t;
                if (e) {
                    if (o) return o;
                    {
                        const {array: o, offset: c, length: l} = e, u = this.obtainView(i(o), c, l), {handle: f} = t, {constructor: h} = s, d = h.call(se, u);
                        return a && n(d[Ft], a), void 0 !== f ? this.variables.push({
                            handle: f,
                            object: d
                        }) : void 0 === c && r.push(d), t.actual = d, d;
                    }
                }
                return s;
            }, o = new Map;
            for (const e of t) {
                for (const t of [ e.instance, e.static ]) if (t.template) {
                    const {slots: e, memory: n, handle: r} = t.template, s = t.template = {};
                    if (n) {
                        const {array: t, offset: e, length: o} = n;
                        s[Ct] = this.obtainView(i(t), e, o), void 0 !== r && this.variables.push({
                            handle: r,
                            object: s
                        });
                    }
                    if (e) {
                        const t = s[Ft] = {};
                        o.set(t, e);
                    }
                }
                this.defineStructure(e);
            }
            for (const [t, e] of o) n(t, e);
            for (const e of t) this.finalizeStructure(e);
            for (const t of r) this.makeReadOnly(t);
        },
        imports: {
            initializeLibc: {}
        }
    });
    const Wn = f.map((t => t.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()));
    Mn({
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
                const t = this.getViewAddress(e[Ct]), i = this.createJsThunk(t, n);
                if (!i) throw new Error("Unable to create function thunk");
                r = this.obtainZigView(i, 0), this.jsFunctionThunkMap.set(n, r), this.jsFunctionControllerMap.set(n, e);
            }
            return r;
        },
        createInboundCaller(t, e) {
            const n = this.getFunctionId(t);
            return this.jsFunctionCallerMap.set(n, ((n, r) => {
                try {
                    const i = e(n);
                    if (xe in i) {
                        i[xe]("reset", at.IgnoreUncreated);
                        const t = this.startContext();
                        this.updatePointerTargets(t, i, !0), this.updateShadowTargets(t), this.endContext();
                    }
                    const s = [ ...i ], o = i.hasOwnProperty(Be), a = $n(r || o, gt, (() => t(...s)), (t => {
                        if (t?.[Symbol.asyncIterator]) {
                            if (!i.hasOwnProperty(Te)) throw new UnexpectedGenerator;
                            this.pipeContents(t, i);
                        } else i[Be](t);
                    }), (t => {
                        try {
                            if (e[fe] && t instanceof Error) return i[Be](t), ct;
                            throw t;
                        } catch (e) {
                            console.error(t);
                        }
                    }));
                    return o ? ct : a;
                } catch (t) {
                    return console.error(t), gt;
                }
            })), function(...e) {
                return t(...e);
            };
        },
        defineArgIterator(t) {
            const o = this, a = t.filter((({structure: t}) => t.type === e.Struct && t.purpose === s)).length;
            return {
                value() {
                    let c, l = 0, u = 0, f = 0;
                    const h = [];
                    for (const [d, {structure: g, type: p}] of t.entries()) try {
                        let t, y, m = this[d];
                        if (p === W.Object && m?.[Ct]?.[Lt] && (m = new m.constructor(m)), g.type === e.Struct) switch (g.purpose) {
                          case s:
                            t = 1 === a ? "allocator" : "allocator" + ++l, y = this[ge] = m;
                            break;

                          case n:
                            t = "callback", 1 == ++u && (y = o.createPromiseCallback(this, m));
                            break;

                          case r:
                            t = "callback", 1 == ++u && (y = o.createGeneratorCallback(this, m));
                            break;

                          case i:
                            t = "signal", 1 == ++f && (y = o.createInboundSignal(m));
                        }
                        void 0 !== t ? void 0 !== y && (c ||= {}, c[t] = y) : h.push(m);
                    } catch (t) {
                        h.push(t);
                    }
                    return c && h.push(c), h[Symbol.iterator]();
                }
            };
        },
        handleJscall(t, e, n, r) {
            const i = this.obtainZigView(e, n, !1), s = this.jsFunctionCallerMap.get(t);
            return s ? s(i, r) : gt;
        },
        releaseFunction(t) {
            const e = this.jsFunctionThunkMap.get(t), n = this.jsFunctionControllerMap.get(t);
            if (e && n) {
                const r = this.getViewAddress(n[Ct]), i = this.getViewAddress(e);
                this.destroyJsThunk(r, i), this.releaseZigView(e), t && (this.jsFunctionThunkMap.delete(t), 
                this.jsFunctionCallerMap.delete(t), this.jsFunctionControllerMap.delete(t));
            }
        },
        freeFunction(t) {
            this.releaseFunction(this.getFunctionId(t));
        },
        exports: {
            handleJscall: {
                async: !0
            },
            releaseFunction: {}
        },
        imports: {
            createJsThunk: {},
            destroyJsThunk: {},
            finalizeAsyncCall: {}
        }
    }), Mn({
        createOutboundCaller(t, e) {
            const n = this, r = function(...i) {
                const s = new e(i, this?.[ge]);
                return n.invokeThunk(t, r, s);
            };
            return r;
        },
        copyArguments(t, o, f, h, d) {
            let g = 0, p = 0, y = 0;
            const m = t[le];
            for (const {type: b, structure: w} of f) {
                let f, v, S, I;
                if (w.type === e.Struct) switch (w.purpose) {
                  case s:
                    f = (1 == ++y ? h?.allocator ?? h?.allocator1 : h?.[`allocator${y}`]) ?? this.createDefaultAllocator(t, w);
                    break;

                  case n:
                    v ||= this.createPromise(w, t, h?.callback), f = v;
                    break;

                  case r:
                    S ||= this.createGenerator(w, t, h?.callback), f = S;
                    break;

                  case i:
                    I ||= this.createSignal(w, h?.signal), f = I;
                    break;

                  case a:
                    f = this.createReader(o[p++]);
                    break;

                  case c:
                    f = this.createWriter(o[p++]);
                    break;

                  case l:
                    f = this.createFile(o[p++]);
                    break;

                  case u:
                    f = this.createDirectory(o[p++]);
                }
                if (void 0 === f && (f = o[p++], void 0 === f && b !== W.Void)) throw new UndefinedArgument;
                try {
                    m[g++].call(t, f, d);
                } catch (t) {
                    throw On(t, g - 1);
                }
            }
        },
        invokeThunk(t, e, n) {
            const r = this.startContext(), i = n[oe], s = this.getViewAddress(t[Ct]), o = this.getViewAddress(e[Ct]), a = ke in n, c = xe in n;
            c && this.updatePointerAddresses(r, n);
            const l = this.getViewAddress(n[Ct]), u = i ? this.getViewAddress(i[Ct]) : 0;
            this.updateShadows(r);
            let f = !1;
            const h = () => {
                this.updateShadowTargets(r), c && this.updatePointerTargets(r, n), this.flushStreams?.(), 
                this.endContext(), f = !0;
            };
            a && (n[ke] = h);
            if (!(i ? this.runVariadicThunk(s, o, l, u, i.length) : this.runThunk(s, o, l))) throw f || h(), 
            new ZigError;
            const d = e[$e];
            if (a) {
                let t = null;
                if (!f) try {
                    t = n.retval;
                } catch (e) {
                    t = new ZigError(e, 1);
                }
                return null != t ? (d && (t = d(t)), n[Be](t)) : d && (n[$e] = d), n[he] ?? n[de];
            }
            h();
            try {
                const {retval: t} = n;
                return d ? d(t) : t;
            } catch (t) {
                throw new ZigError(t, 1);
            }
        },
        imports: {
            runThunk: null,
            runVariadicThunk: null
        }
    });
    class AsyncReader {
        bytes=null;
        promise=null;
        done=!1;
        readnb(t) {
            if ("number" != typeof this.poll()) throw new WouldBlock;
            return this.shift(t);
        }
        async read(t) {
            return await this.poll(), this.shift(t);
        }
        store({done: t, value: e}) {
            return t ? (this.done = !0, 0) : (e instanceof Uint8Array || (e = e instanceof ArrayBuffer ? new Uint8Array(e) : e.buffer instanceof ArrayBuffer ? new Uint8Array(e.buffer, e.byteOffset, e.byteLength) : Re(e + "")), 
            this.bytes = e, e.length);
        }
        shift(t) {
            let e;
            return this.bytes && (this.bytes.length > t ? (e = this.bytes.subarray(0, t), this.bytes = this.bytes.subarray(t)) : (e = this.bytes, 
            this.bytes = null)), e ?? new Uint8Array(0);
        }
        poll() {
            const t = this.bytes?.length;
            return t || (this.promise ??= this.fetch().then((t => (this.promise = null, this.store(t)))));
        }
    }
    class WebStreamReader extends AsyncReader {
        onClose=null;
        constructor(t) {
            super(), this.reader = t, Gn(t, this);
        }
        async fetch() {
            return this.reader.read();
        }
        destroy() {
            this.done || this.reader.cancel(), this.bytes = null;
        }
        valueOf() {
            return this.reader;
        }
    }
    class WebStreamReaderBYOB extends WebStreamReader {
        async fetch() {
            const t = new Uint8Array(qn);
            return this.reader.read(t);
        }
    }
    class AsyncWriter {
        promise=null;
        writenb(t) {
            if ("number" != typeof this.poll()) throw new WouldBlock;
            this.queue(t);
        }
        async write(t) {
            await this.poll(), await this.queue(t);
        }
        queue(t) {
            return this.promise = this.send(t).then((() => {
                this.promise = null;
            }));
        }
        poll() {
            return this.promise?.then?.((() => Jn)) ?? Jn;
        }
    }
    class WebStreamWriter extends AsyncWriter {
        onClose=null;
        done=!1;
        constructor(t) {
            super(), this.writer = t, t.closed.catch(bn).then((() => {
                this.done = !0, this.onClose?.();
            }));
        }
        async send(t) {
            await this.writer.write(t);
        }
        destroy() {
            this.done || this.writer.close();
        }
        valueOf() {
            return this.writer;
        }
    }
    class BlobReader extends AsyncReader {
        pos=0;
        onClose=null;
        constructor(t) {
            super(), this.blob = t, this.size = t.size, Gn(t, this);
        }
        async fetch() {
            const t = await this.pread(qn, this.pos), {length: e} = t;
            return {
                done: !e,
                value: e ? t : null
            };
        }
        async pread(t, e) {
            const n = this.blob.slice(e, e + t), r = new Response(n), i = await r.arrayBuffer();
            return new Uint8Array(i);
        }
        async read(t) {
            const e = await super.read(t);
            return this.pos += e.length, e;
        }
        tell() {
            return this.pos;
        }
        seek(t, e) {
            return this.done = !1, this.bytes = null, this.pos = Zn(e, t, this.pos, this.size);
        }
        valueOf() {
            return this.blob;
        }
    }
    class Uint8ArrayReader {
        pos=0;
        onClose=null;
        constructor(t) {
            this.array = t, this.size = t.length, Gn(t, this);
        }
        readnb(t) {
            return this.read(t);
        }
        read(t) {
            const e = this.pread(t, this.pos);
            return this.pos += e.length, e;
        }
        pread(t, e) {
            return this.array.subarray(e, e + t);
        }
        tell() {
            return this.pos;
        }
        seek(t, e) {
            return this.pos = Zn(e, t, this.pos, this.size);
        }
        poll() {
            return this.size - this.pos;
        }
        valueOf() {
            return this.array;
        }
    }
    class Uint8ArrayReadWriter extends Uint8ArrayReader {
        writenb(t) {
            return this.write(t);
        }
        write(t) {
            this.pwrite(t, this.pos), this.pos += t.length;
        }
        pwrite(t, e) {
            this.array.set(t, e);
        }
    }
    class StringReader extends Uint8ArrayReader {
        constructor(t) {
            super(Re(t)), this.string = t, Gn(t, this);
        }
        valueOf() {
            return this.string;
        }
    }
    class ArrayWriter {
        constructor(t) {
            this.array = t, this.closeCB = null, Gn(t, this);
        }
        writenb(t) {
            this.write(t);
        }
        write(t) {
            this.array.push(t);
        }
        poll() {
            return Jn;
        }
        valueOf() {
            return this.array;
        }
    }
    class NullStream {
        read() {
            return this.pread();
        }
        pread() {
            return new Uint8Array(0);
        }
        write() {}
        pwrite() {}
        poll(t) {
            return t === Bt ? 0 : Jn;
        }
        valueOf() {
            return null;
        }
    }
    class MapDirectory {
        onClose=null;
        keys=null;
        cookie=0;
        constructor(t) {
            this.map = t, this.size = t.size, Gn(t, this);
        }
        readdir() {
            const t = this.cookie;
            let e;
            switch (t) {
              case 0:
              case 1:
                e = {
                    name: ".".repeat(t + 1),
                    type: "directory"
                };
                break;

              default:
                this.keys || (this.keys = [ ...this.map.keys() ]);
                const n = this.keys[t - 2];
                if (void 0 === n) return null;
                e = {
                    name: n,
                    ...this.map.get(n)
                };
            }
            return this.cookie++, e;
        }
        seek(t) {
            return this.cookie = t;
        }
        tell() {
            return this.cookie;
        }
        valueOf() {
            return this.map;
        }
    }
    function Zn(t, e, n, r) {
        let i = -1;
        switch (t) {
          case 0:
            i = e;
            break;

          case 1:
            i = n + e;
            break;

          case 2:
            i = r + e;
        }
        if (!(i >= 0 && i <= r)) throw new InvalidArgument;
        return i;
    }
    function Gn(t, e) {
        if ("object" == typeof t) {
            const n = t.close;
            ze(t, "close", {
                value: () => {
                    n?.(), e.onClose?.(), delete t.close;
                }
            });
        }
    }
    const qn = 8192, Jn = 16777216;
    function Hn(t, e) {
        return De(t, e, (t => t.address));
    }
    Mn({
        convertDirectory: t => t instanceof Map ? new MapDirectory(t) : an(t, "readdir") ? t : void 0
    }), Mn({
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
                if (t & m.IsSize && s > 32) {
                    const t = BigInt(Number.MAX_SAFE_INTEGER), e = BigInt(Number.MIN_SAFE_INTEGER);
                    return function(n, i) {
                        const s = r.call(this, n, i);
                        return e <= s && s <= t ? Number(s) : s;
                    };
                }
            }
            return r;
        }
    }), Mn({
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
            const i = e[Ct];
            if (n) {
                if (void 0 === n.address) {
                    const {start: e, end: s, targets: o} = n;
                    let a, c = 0;
                    for (const t of o) {
                        const e = t[Ct], n = e.byteOffset, r = t.constructor[ie] ?? e[ie];
                        (void 0 === c || r > c) && (c = r, a = n);
                    }
                    const l = s - e, u = this.allocateShadowMemory(l + c, 1), f = this.getViewAddress(u), h = Ze(tn(f, a - e), c), d = tn(h, e - a);
                    for (const t of o) {
                        const n = t[Ct], r = n.byteOffset;
                        if (r !== a) {
                            const i = t.constructor[ie] ?? n[ie];
                            if (We(tn(d, r - e), i)) throw new AlignmentConflict(i, c);
                        }
                    }
                    const g = u.byteOffset + Number(d - f), p = new DataView(u.buffer, g, l), y = new DataView(i.buffer, Number(e), l), m = this.registerMemory(d, l, 1, r, y, p);
                    t.shadowList.push(m), n.address = d;
                }
                return tn(n.address, i.byteOffset - n.start);
            }
            {
                const n = e.constructor[ie] ?? i[ie], s = i.byteLength, o = this.allocateShadowMemory(s, n), a = this.getViewAddress(o), c = this.registerMemory(a, s, 1, r, i, o);
                return t.shadowList.push(c), a;
            }
        },
        updateShadows(t) {
            for (let {targetDV: e, shadowDV: n} of t.shadowList) dn(n, e);
        },
        updateShadowTargets(t) {
            for (let {targetDV: e, shadowDV: n, writable: r} of t.shadowList) r && dn(e, n);
        },
        registerMemory(t, e, n, r, i, s) {
            const o = Hn(this.memoryList, t);
            let a = this.memoryList[o - 1];
            return a?.address === t && a.len === e ? a.writable ||= r : (a = {
                address: t,
                len: e,
                align: n,
                writable: r,
                targetDV: i,
                shadowDV: s
            }, this.memoryList.splice(o, 0, a)), a;
        },
        unregisterMemory(t, e) {
            const n = Hn(this.memoryList, t), r = this.memoryList[n - 1];
            if (r?.address === t && r.len === e) return this.memoryList.splice(n - 1, 1), r;
        },
        findMemory(t, e, n, r) {
            let i = n * (r ?? 0);
            const s = Hn(this.memoryList, e), o = this.memoryList[s - 1];
            let a;
            if (o?.address === e && o.len === i) a = o.targetDV; else if (o?.address <= e && tn(e, i) <= tn(o.address, o.len)) {
                const t = Number(e - o.address), n = void 0 === r, {targetDV: s} = o;
                n && (i = s.byteLength - t), a = this.obtainView(s.buffer, s.byteOffset + t, i), 
                n && (a[ie] = o.align);
            }
            if (a) {
                let {targetDV: e, shadowDV: n} = o;
                n && t && !t.shadowList.includes(o) && dn(e, n);
            } else a = this.obtainZigView(e, i);
            return a;
        },
        findShadowView(t) {
            for (const {shadowDV: e, targetDV: n} of this.memoryList) if (n === t) return e;
        },
        releaseZigView(t) {
            const e = t[Lt], n = e?.address;
            n && n !== qe && (e.address = qe, this.unregisterBuffer(tn(n, -t.byteOffset)));
        },
        getViewAddress(t) {
            const e = t[Lt];
            if (e) return e.address;
            return tn(this.getBufferAddress(t.buffer), t.byteOffset);
        },
        ...{
            imports: {
                getBufferAddress: {},
                obtainExternBuffer: {}
            },
            exports: {
                getViewAddress: {}
            },
            allocateShadowMemory(t, e) {
                return this.allocateJSMemory(t, e);
            },
            freeShadowMemory(t) {},
            obtainZigView(t, e, n = !0) {
                if (function(t) {
                    return 0xaaaaaaaaaaaaaaaan === t;
                }(t) && (t = e > 0 ? 0 : Ge), !t && e) return null;
                let r, i, s;
                if (n) {
                    s = Hn(this.externBufferList, t);
                    const n = this.externBufferList[s - 1];
                    n?.address <= t && tn(t, e) <= tn(n.address, n.len) && (r = n.buffer, i = Number(t - n.address));
                }
                r || (r = e > 0 ? this.obtainExternBuffer(t, e, pe) : new ArrayBuffer(0), r[Lt] = {
                    address: t,
                    len: e
                }, i = 0, n && this.externBufferList.splice(s, 0, {
                    address: t,
                    len: e,
                    buffer: r
                }));
                const o = this.obtainView(r, i, e, n);
                return o[pe]?.(!1), o;
            },
            unregisterBuffer(t) {
                const e = Hn(this.externBufferList, t), n = this.externBufferList[e - 1];
                n?.address === t && this.externBufferList.splice(e - 1, 1);
            },
            getTargetAddress(t, e, n, r) {
                const i = e[Ct];
                if (n) {
                    if (void 0 === n.misaligned) {
                        const t = this.getBufferAddress(i.buffer);
                        for (const e of n.targets) {
                            const r = e[Ct].byteOffset, i = e.constructor[ie];
                            if (We(tn(t, r), i)) {
                                n.misaligned = !0;
                                break;
                            }
                        }
                        void 0 === n.misaligned && (n.misaligned = !1, n.address = t);
                    }
                    if (!n.misaligned) return tn(n.address, i.byteOffset);
                } else {
                    const t = e.constructor[ie], n = this.getViewAddress(i);
                    if (!We(n, t)) {
                        const e = i.byteLength;
                        return this.registerMemory(n, e, t, r, i), n;
                    }
                }
                return this.getShadowAddress(t, e, n, r);
            }
        }
    }), Mn({
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
                loadModule: {}
            },
            exportFunctions() {
                const t = {};
                for (const [e, n] of Object.entries(this.exports)) {
                    const {async: r = !1} = n;
                    let i = this[e];
                    i && (r && (i = this.addPromiseHandling(i)), t[e] = i.bind(this));
                }
                return t;
            },
            addPromiseHandling(t) {
                const e = t.length - 1;
                return function(...n) {
                    const r = n[e], i = !!r;
                    n[e] = i;
                    const s = t.call(this, ...n);
                    return i ? (cn(s) ? s.then((t => this.finalizeAsyncCall(r, t))) : this.finalizeAsyncCall(r, s), 
                    ct) : s;
                };
            },
            importFunctions(t) {
                for (const [e] of Object.entries(this.imports)) {
                    const n = t[e];
                    n && (ze(this, e, Ce(n)), this.destructors.push((() => this[e] = Yn)));
                }
            }
        }
    });
    const Yn = () => {
        throw new Error("Module was abandoned");
    };
    Mn({
        linkVariables(t) {
            for (const {object: e, handle: n} of this.variables) {
                const r = e[Ct], i = this.recreateAddress(n);
                let s = e[Ct] = this.obtainZigView(i, r.byteLength);
                t && dn(s, r), e.constructor[ee]?.save?.(s, e), this.destructors.push((() => {
                    dn(e[Ct] = this.allocateMemory(s.byteLength), s);
                }));
                const o = t => {
                    const e = t[Ft];
                    if (e) {
                        const t = s.byteOffset;
                        for (const n of Object.values(e)) if (n) {
                            const e = n[Ct];
                            if (e.buffer === r.buffer) {
                                const i = t + e.byteOffset - r.byteOffset;
                                n[Ct] = this.obtainView(s.buffer, i, e.byteLength), n.constructor[ee]?.save?.(s, n), 
                                o(n);
                            }
                        }
                    }
                };
                o(e), e[xe]?.((function() {
                    this[Se]();
                }), at.IgnoreInactive);
            }
            this.createDeferredThunks?.();
        },
        imports: {
            recreateAddress: null
        }
    }), Mn({
        updatePointerAddresses(t, e) {
            const n = new Map, r = new Map, i = [], s = function(t) {
                if (void 0 === n.get(this)) {
                    const t = this[Ft][0];
                    if (t) {
                        const e = {
                            target: t,
                            writable: !this.constructor.const
                        }, o = t[Ct];
                        if (o[Lt]) n.set(this, null); else {
                            n.set(this, t);
                            const a = r.get(o.buffer);
                            if (a) {
                                const t = Array.isArray(a) ? a : [ a ], n = De(t, o.byteOffset, (t => t.target[Ct].byteOffset));
                                t.splice(n, 0, e), Array.isArray(a) || (r.set(o.buffer, t), i.push(t));
                            } else r.set(o.buffer, e);
                            t[xe]?.(s, 0);
                        }
                    }
                }
            }, o = at.IgnoreRetval | at.IgnoreInactive;
            e[xe](s, o);
            const a = this.findTargetClusters(i), c = new Map;
            for (const t of a) for (const e of t.targets) c.set(e, t);
            for (const [e, r] of n) if (r) {
                const n = c.get(r), i = n?.writable ?? !e.constructor.const;
                e[Xt] = this.getTargetAddress(t, r, n, i), Kt in e && (e[Kt] = r.length);
            }
        },
        updatePointerTargets(t, e, n = !1) {
            const r = new Map, i = function(e) {
                if (!r.get(this)) {
                    r.set(this, !0);
                    const n = this[Ft][0], s = n && e & at.IsImmutable ? n : this[Se](t, !0, !(e & at.IsInactive)), o = this.constructor.const ? at.IsImmutable : 0;
                    o & at.IsImmutable || n && !n[Ct][Lt] && n[xe]?.(i, o), s !== n && s && !s[Ct][Lt] && s?.[xe]?.(i, o);
                }
            }, s = n ? at.IgnoreRetval : 0;
            e[xe](i, s);
        },
        findTargetClusters(t) {
            const e = [];
            for (const n of t) {
                let t = null, r = 0, i = 0, s = null;
                for (const {target: o, writable: a} of n) {
                    const n = o[Ct], {byteOffset: c, byteLength: l} = n, u = c + l;
                    let f = !0;
                    t && (i > c ? (s ? s.writable ||= a : (s = {
                        targets: [ t ],
                        start: r,
                        end: i,
                        address: void 0,
                        misaligned: void 0,
                        writable: a
                    }, e.push(s)), s.targets.push(o), u > i ? s.end = u : f = !1) : s = null), f && (t = o, 
                    r = c, i = u);
                }
            }
            return e;
        }
    }), Mn({
        convertReader: t => t instanceof ReadableStreamDefaultReader ? new WebStreamReader(t) : "function" == typeof ReadableStreamBYOBReader && t instanceof ReadableStreamBYOBReader ? new WebStreamReaderBYOB(t) : t instanceof Blob ? new BlobReader(t) : t instanceof Uint8Array ? new Uint8ArrayReadWriter(t) : "string" == typeof t || t instanceof String ? new StringReader(t) : null === t ? new NullStream : an(t, "read") ? t : void 0
    }), Mn({
        addRuntimeCheck: t => function(e, n) {
            const r = t.call(this, e, n);
            if ("set" === e) {
                const {min: t, max: e} = function(t) {
                    const {type: e, bitSize: n} = t, r = e === W.Int;
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
    }), Mn({
        init() {
            this.streamLocationMap = new Map([ [ Ot.root, "" ] ]);
        },
        obtainStreamLocation(t, e, n) {
            const r = this.obtainZigView(e, n, !1);
            let i = Le(new Uint8Array(r.buffer, r.byteOffset, r.byteLength)).trim();
            if (i.startsWith("/dev/fd/")) {
                const t = parseInt(i.slice(8)), e = this.getStreamLocation(t);
                if (!e) throw new InvalidPath(i);
                return e;
            }
            i.endsWith("/") && (i = i.slice(0, -1));
            const s = i.trim().split("/"), o = [];
            for (const t of s) if (".." === t) {
                if (!(o.length > 0)) throw new InvalidPath(i);
                o.pop();
            } else "." !== t && "" != t && o.push(t);
            s[0] || (t = Ot.root);
            const [a] = this.getStream(t);
            return {
                parent: a.valueOf(),
                path: o.join("/")
            };
        },
        getStreamLocation(t) {
            return this.streamLocationMap.get(t);
        },
        setStreamLocation(t, e) {
            const n = this.streamLocationMap;
            e ? n.set(t, e) : n.delete(t);
        }
    });
    const Xn = [ Ut.fd_read, 0 ], Kn = [ Ut.fd_write, 0 ], Qn = Ut.fd_seek | Ut.fd_fdstat_set_flags | Ut.fd_tell | Ut.path_create_directory | Ut.path_create_file | Ut.path_open | Ut.fd_readdir | Ut.path_filestat_get | Ut.path_filestat_set_size | Ut.path_filestat_set_times | Ut.fd_filestat_get | Ut.fd_filestat_set_times | Ut.path_remove_directory | Ut.path_unlink_file, tr = Ut.fd_datasync | Ut.fd_read | Ut.fd_seek | Ut.fd_sync | Ut.fd_tell | Ut.fd_write | Ut.fd_advise | Ut.fd_allocate | Ut.fd_filestat_get | Ut.fd_filestat_set_times | Ut.fd_filestat_set_size;
    Mn({
        init() {
            const t = {
                cookie: 0n,
                readdir() {
                    const t = Number(this.cookie);
                    let e = null;
                    switch (t) {
                      case 0:
                      case 1:
                        e = {
                            name: ".".repeat(t + 1),
                            type: "directory"
                        };
                    }
                    return e;
                },
                seek(t) {
                    return this.cookie = t;
                },
                tell() {
                    return this.cookie;
                },
                valueOf: () => null
            };
            this.streamMap = new Map([ [ Ot.root, [ t, this.getDefaultRights("dir"), 0 ] ], [ Ot.stdout, [ this.createLogWriter("stdout"), Kn, 0 ] ], [ Ot.stderr, [ this.createLogWriter("stderr"), Kn, 0 ] ] ]), 
            this.flushRequestMap = new Map, this.nextStreamHandle = Ot.min;
        },
        getStream(t) {
            const e = this.streamMap.get(t);
            if (!e) {
                if (2 < t && t < Ot.min) throw new Unsupported;
                throw new InvalidFileDescriptor;
            }
            return e;
        },
        createStreamHandle(t, e, n = 0) {
            if (!this.ioRedirection) throw new Unsupported;
            let r = this.nextStreamHandle++;
            if (r > Ot.max) {
                for (r = Ot.min; this.streamMap.get(r); ) if (r++, r > Ot.max) throw new TooManyFiles;
                this.nextStreamHandle = r + 1;
            }
            return this.streamMap.set(r, [ t, e, n ]), t.onClose = () => this.destroyStreamHandle(r), 
            "linux" === process.platform && 4 === this.streamMap.size && this.setSyscallTrap(!0), 
            r;
        },
        destroyStreamHandle(t) {
            const e = this.streamMap.get(t);
            if (e) {
                const [n] = e;
                n?.destroy?.(), this.streamMap.delete(t), "linux" === process.platform && 3 === this.streamMap.size && this.setSyscallTrap(!1);
            }
        },
        redirectStream(t, e) {
            const n = this.streamMap, r = Ot[t], i = n.get(r);
            if (void 0 !== e) {
                let i, s;
                if (r === Ot.stdin) i = this.convertReader(e), s = Xn; else if (r === Ot.stdout || r === Ot.stderr) i = this.convertWriter(e), 
                s = Kn; else {
                    if (r !== Ot.root) throw new Error(`Expecting 'stdin', 'stdout', 'stderr', or 'root', received ${t}`);
                    i = this.convertDirectory(e), s = this.getDefaultRights("dir");
                }
                if (!i) throw new InvalidStream(s[0], e);
                n.set(r, [ i, s, 0 ]);
            } else n.delete(r);
            return i?.[0];
        },
        createLogWriter(t) {
            const e = this;
            return {
                pending: [],
                write(t) {
                    const n = t.lastIndexOf(10);
                    if (-1 === n) this.pending.push(t); else {
                        const e = t.subarray(0, n), r = t.subarray(n + 1);
                        this.dispatch([ ...this.pending, e ]), this.pending.splice(0), r.length > 0 && this.pending.push(r);
                    }
                    e.scheduleFlush(this, this.pending.length > 0, 250);
                },
                dispatch(n) {
                    const r = Le(n);
                    null == e.triggerEvent("log", {
                        source: t,
                        message: r
                    }) && console.log(r);
                },
                flush() {
                    this.pending.length > 0 && (this.dispatch(this.pending), this.pending.splice(0));
                }
            };
        },
        scheduleFlush(t, e, n) {
            const r = this.flushRequestMap, i = r.get(t);
            i && (clearTimeout(i), r.delete(t)), e && r.set(t, setTimeout((() => {
                t.flush(), r.delete(t);
            }), n));
        },
        flushStreams() {
            const t = this.flushRequestMap;
            if (t.size > 0) {
                for (const [e, n] of t) e.flush(), clearTimeout(n);
                t.clear();
            }
        },
        getDefaultRights: t => "dir" === t ? [ Qn, Qn | tr ] : [ tr, 0 ],
        imports: {
            setRedirectionMask: {},
            setSyscallTrap: {}
        }
    }), Mn({}), Mn({
        convertWriter: t => t instanceof WritableStreamDefaultWriter ? new WebStreamWriter(t) : Array.isArray(t) ? new ArrayWriter(t) : t instanceof Uint8Array ? new Uint8ArrayReadWriter(t) : null === t ? new NullStream : "function" == typeof t?.write ? t : void 0
    }), Mn({
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
    }), Mn({
        init() {
            this.defaultAllocator = null, this.allocatorVtable = null, this.allocatorContextMap = new Map, 
            this.nextAllocatorContextId = Je(4096);
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
            let s = Ge;
            if (n) {
                const e = [];
                s = this.nextAllocatorContextId++, this.allocatorContextMap.set(s, e), t[Ie] = t => {
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
            const r = this.getViewAddress(t["*"][Ct]), i = r != Ge ? this.allocatorContextMap.get(r) : null, s = 1 << n, o = this.allocateJSMemory(e, s);
            {
                const t = this.getViewAddress(o);
                return this.registerMemory(t, e, s, !0, o), ze(o, Lt, {
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
            const r = e["*"][Ct], i = this.getViewAddress(r), s = r.byteLength;
            this.unregisterMemory(i, s);
        }
    }), Mn({
        createDirectory(t) {
            if ("object" == typeof t && "number" == typeof t?.fd) return t;
            const e = this.convertDirectory(t);
            if (!e) throw new InvalidStream(Ut.fd_readdir, t);
            let n = this.createStreamHandle(e, this.getDefaultRights("dir"));
            return "win32" === process.platform && (n = this.obtainZigView(Je(n << 1), 0)), 
            {
                fd: n
            };
        }
    }), Mn({
        createFile(t) {
            if ("object" == typeof t && "number" == typeof t?.fd) return {
                handle: t.fd
            };
            if ("object" == typeof t && "number" == typeof t?.handle) return t;
            const e = this.convertReader(t) ?? this.convertWriter(t);
            if (!e) throw new InvalidStream(Ut.fd_read | Ut.fd_write, t);
            const n = this.getDefaultRights("file"), r = {
                read: Ut.fd_read,
                write: Ut.fd_write,
                seek: Ut.fd_seek,
                tell: Ut.fd_tell,
                allocate: Ut.fd_allocate
            };
            for (const [t, i] of Object.entries(r)) an(e, t) || (n[0] &= ~i);
            let i = this.createStreamHandle(e, n);
            return "win32" === process.platform && (i = this.obtainZigView(Je(i << 1), 0)), 
            {
                handle: i
            };
        }
    }), Mn({
        init() {
            this.generatorCallbackMap = new Map, this.generatorContextMap = new Map, this.nextGeneratorContextId = Je(8192);
        },
        createGenerator(t, e, n) {
            const {constructor: r, instance: {members: i}} = t;
            if (n) {
                if ("function" != typeof n) throw new TypeMismatch("function", n);
            } else {
                const t = e[de] = new AsyncGenerator;
                n = t.push.bind(t);
            }
            const s = this.nextGeneratorContextId++, o = this.obtainZigView(s, 0, !1);
            this.generatorContextMap.set(s, {
                func: n,
                args: e
            });
            let a = this.generatorCallbackMap.get(r);
            a || (a = async (t, e) => {
                const n = t instanceof DataView ? t : t["*"][Ct], r = this.getViewAddress(n), i = this.generatorContextMap.get(r);
                if (i) {
                    const {func: t, args: n} = i, s = e instanceof Error;
                    if (!s && e) {
                        const t = n[$e];
                        t && (e = t(e));
                    }
                    const o = !1 === await (2 === t.length ? t(s ? e : null, s ? null : e) : t(e)) || s || null === e;
                    if (n[Ie]?.(o), !o) return !0;
                    n[ke](), this.generatorContextMap.delete(r);
                }
                return !1;
            }, this.generatorCallbackMap.set(r, a), this.destructors.push((() => this.freeFunction(a)))), 
            e[Be] = t => a(o, t);
            const c = {
                ptr: o,
                callback: a
            }, l = i.find((t => "allocator" === t.name));
            if (l) {
                const {structure: t} = l;
                c.allocator = this.createJsAllocator(e, t, !0);
            }
            return c;
        },
        createGeneratorCallback(t, e) {
            const {ptr: n, callback: r} = e, i = r["*"];
            return t[Te] = e => i.call(t, n, e), (...e) => {
                const n = 2 === e.length ? e[0] ?? e[1] : e[0];
                return t[Te](n);
            };
        },
        async pipeContents(t, e) {
            try {
                try {
                    const n = t[Symbol.asyncIterator]();
                    for await (const t of n) if (null !== t && !e[Te](t)) break;
                    e[Te](null);
                } catch (t) {
                    if (!e.constructor[fe]) throw t;
                    e[Te](t);
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
    Mn({
        init() {
            this.promiseCallbackMap = new Map, this.promiseContextMap = new Map, this.nextPromiseContextId = Je(4096);
        },
        createPromise(t, e, n) {
            const {constructor: r} = t;
            if (n) {
                if ("function" != typeof n) throw new TypeMismatch("function", n);
            } else e[he] = new Promise(((t, r) => {
                n = n => {
                    if (n?.[Ct]?.[Lt] && (n = new n.constructor(n)), n instanceof Error) r(n); else {
                        if (n) {
                            const t = e[$e];
                            t && (n = t(n));
                        }
                        t(n);
                    }
                };
            }));
            const i = this.nextPromiseContextId++, s = this.obtainZigView(i, 0, !1);
            this.promiseContextMap.set(i, {
                func: n,
                args: e
            });
            let o = this.promiseCallbackMap.get(r);
            return o || (o = (t, e) => {
                const n = t instanceof DataView ? t : t["*"][Ct], r = this.getViewAddress(n), i = this.promiseContextMap.get(r);
                if (i) {
                    const {func: t, args: n} = i;
                    if (2 === t.length) {
                        const n = e instanceof Error;
                        t(n ? e : null, n ? null : e);
                    } else t(e);
                    n[ke](), this.promiseContextMap.delete(r);
                }
            }, this.promiseCallbackMap.set(r, o), this.destructors.push((() => this.freeFunction(o)))), 
            e[Be] = t => o(s, t), {
                ptr: s,
                callback: o
            };
        },
        createPromiseCallback(t, e) {
            const {ptr: n, callback: r} = e, i = r["*"];
            return t[Be] = e => i.call(t, n, e), (...e) => {
                const n = 2 === e.length ? e[0] ?? e[1] : e[0];
                return t[Be](n);
            };
        }
    }), Mn({
        init() {
            this.readerCallback = null, this.readerMap = new Map, this.nextReaderId = Je(4096), 
            this.readerProgressMap = new Map;
        },
        createReader(t) {
            if ("object" == typeof t && t && "context" in t && "readFn" in t) return t;
            const e = this.convertReader(t);
            if (!e) throw new InvalidStream(Ut.fd_read, t);
            const n = this.nextReaderId++, r = this.obtainZigView(n, 0, !1), i = e.onClose = () => {
                this.readerMap.delete(n), this.readerProgressMap.delete(n);
            };
            this.readerMap.set(n, e), this.readerProgressMap.set(n, {
                bytes: 0,
                calls: 0
            });
            let s = this.readerCallback;
            if (!s) {
                const t = t => {
                    throw console.error(t), i(), t;
                };
                s = this.readerCallback = (e, n) => {
                    const r = this.getViewAddress(e["*"][Ct]), i = this.readerMap.get(r);
                    if (!i) return 0;
                    try {
                        const e = n["*"][Ct].byteLength, s = t => {
                            const e = t.length, r = this.getViewAddress(n["*"][Ct]);
                            return this.moveExternBytes(t, r, !0), e;
                        };
                        Tn(this.readerProgressMap.get(r), "read", e);
                        const o = i.read(e);
                        return cn(o) ? o.then(s).catch(t) : s(o);
                    } catch (e) {
                        t(e);
                    }
                }, this.destructors.push((() => this.freeFunction(s)));
            }
            return {
                context: r,
                readFn: s
            };
        }
    }), Mn({
        init() {
            this.writerCallback = null, this.writerMap = new Map, this.nextWriterContextId = Je(8192), 
            this.writerProgressMap = new Map;
        },
        createWriter(t) {
            if ("object" == typeof t && t && "context" in t && "writeFn" in t) return t;
            const e = this.convertWriter(t);
            if (!e) throw new InvalidStream(Ut.fd_write, t);
            const n = this.nextWriterContextId++, r = this.obtainZigView(n, 0, !1), i = e.onClose = () => {
                this.writerMap.delete(n), this.writerProgressMap.delete(n);
            };
            this.writerMap.set(n, e), this.writerProgressMap.set(n, {
                bytes: 0,
                calls: 0
            });
            let s = this.writerCallback;
            if (!s) {
                const t = t => {
                    throw console.error(t), i(), t;
                };
                s = this.writerCallback = (e, n) => {
                    const r = this.getViewAddress(e["*"][Ct]), i = this.writerMap.get(r);
                    if (!i) return 0;
                    try {
                        const e = n["*"][Ct];
                        Tn(this.writerProgressMap.get(r), "write", e.byteLength);
                        const s = e.byteLength, o = new Uint8Array(e.buffer, e.byteOffset, s), a = new Uint8Array(o), c = i.write(a);
                        return cn(c) ? c.then((() => s), t) : s;
                    } catch (e) {
                        t(e);
                    }
                }, this.destructors.push((() => this.freeFunction(s)));
            }
            return {
                context: r,
                writeFn: s
            };
        }
    }), Mn({
        copyUint64(t, e) {
            const n = hn(8);
            n.setBigUint64(0, BigInt(e), this.littleEndian), this.moveExternBytes(n, t, !0);
        },
        copyUint32(t, e) {
            const n = hn(4);
            n.setUint32(0, e, this.littleEndian), this.moveExternBytes(n, t, !0);
        }
    }), Mn({
        clockResGet(t, e) {
            return this.copyUint64(e, 1000n), ct;
        }
    }), Mn({
        clockTimeGet(t, e, n) {
            const r = 0 === t ? Date.now() : performance.now();
            return this.copyUint64(n, BigInt(1e6 * r)), ct;
        }
    }), Mn({
        environGet(t, e) {
            const n = this.envVarArrays;
            let r = 0, i = 0;
            for (const t of n) r += t.length, i++;
            const s = hn(8 * i), o = new Uint8Array(r);
            let a = 0, c = 0, l = this.littleEndian;
            for (const t of n) s.setBigUint64(a, e + BigInt(c), l), a += 8, o.set(t, c), c += t.length;
            return this.moveExternBytes(s, t, !0), this.moveExternBytes(o, e, !0), 0;
        },
        exports: {
            environGet: {}
        }
    }), Mn({
        environSizesGet(t, e) {
            let n = this.envVariables;
            if (!n) return vt;
            const r = this.envVarArrays = [];
            for (const [t, e] of Object.entries(n)) {
                const n = Re(`${t}=${e}\0`);
                r.push(n);
            }
            let i = 0;
            for (const t of r) i += t.length;
            return this.copyUint32(t, r.length), this.copyUint32(e, i), 0;
        },
        exports: {
            environSizesGet: {}
        }
    });
    const er = {
        normal: 0,
        sequential: 1,
        random: 2,
        willNeed: 3,
        dontNeed: 4,
        noReuse: 5
    };
    Mn({
        fdAdvise(t, e, n, r, i) {
            return $n(i, ft, (() => {
                const [i] = this.getStream(t);
                if (an(i, "advise")) {
                    const t = Object.keys(er);
                    return i.advise(Xe(e), Xe(n), t[r]);
                }
            }));
        },
        exports: {
            fdAdvise: {
                async: !0
            }
        }
    }), Mn({
        fdAllocate(t, e, n, r) {
            return $n(r, ft, (() => {
                const [r] = this.getStream(t);
                return _n(r, "allocate", wt), r.allocate(Xe(e), Xe(n));
            }));
        },
        exports: {
            fdAllocate: {
                async: !0
            }
        }
    }), Mn({
        fdClose(t, e) {
            return $n(e, ft, (() => (this.setStreamLocation?.(t), this.destroyStreamHandle(t))));
        },
        exports: {
            fdClose: {
                async: !0
            }
        }
    }), Mn({
        fdDatasync(t, e) {
            return $n(e, ft, (() => {
                const [e] = this.getStream(t);
                if (an(e, "datasync")) return e.datasync();
            }));
        },
        exports: {
            fdDatasync: {
                async: !0
            }
        }
    }), Mn({
        fdFdstatGet(t, e, n) {
            return $n(n, ft, (() => {
                const [n, r, i] = this.getStream(t);
                let s;
                if (n.type) {
                    if (s = un(n.type, xt), void 0 === s) throw new InvalidEnumValue(xt, n.type);
                } else s = r[0] & (Ut.fd_read | Ut.fd_write) ? xt.file : xt.directory;
                const o = hn(24);
                o.setUint8(0, s), o.setUint16(2, i, !0), o.setBigUint64(8, BigInt(r[0]), !0), o.setBigUint64(16, BigInt(r[1]), !0), 
                this.moveExternBytes(o, e, !0);
            }));
        },
        exports: {
            fdFdstatGet: {
                async: !0
            }
        }
    }), Mn({
        fdFdstatSetFlags(t, e, n) {
            const r = kt.append | kt.nonblock;
            return $n(n, ft, (() => {
                const n = this.getStream(t), [i, s, o] = n;
                e & kt.nonblock && (s[0] & Ut.fd_read && _n(i, "readnb", St), s[0] & Ut.fd_write && _n(i, "writenb", St)), 
                n[2] = o & ~r | e & r;
            }));
        },
        exports: {
            fdFdstatSetFlags: {
                async: !0
            }
        }
    }), Mn({
        fdFdstatSetRights(t, e, n) {
            return $n(n, ft, (() => {
                const n = this.getStream(t), [r, i] = n;
                if (e & ~i) throw new InvalidFileDescriptor;
                n[1] = i;
            }));
        },
        exports: {
            fdFdstatSetRights: {
                async: !0
            }
        }
    }), Mn({
        copyStat(t, e) {
            if (!1 === e) return bt;
            if ("object" != typeof e || !e) throw new TypeMismatch("object or false", e);
            const {ino: n = 1, type: r = "unknown", size: i = 0, atime: s = 0, mtime: o = 0, ctime: a = 0} = e, c = un(r, xt);
            if (void 0 === c) throw new InvalidEnumValue(xt, r);
            const l = this.littleEndian, u = hn(64);
            u.setBigUint64(0, 0n, l), u.setBigUint64(8, BigInt(n), l), u.setUint8(16, c), u.setBigUint64(24, 1n, l), 
            u.setBigUint64(32, BigInt(i), l), u.setBigUint64(40, BigInt(s), l), u.setBigUint64(48, BigInt(o), l), 
            u.setBigUint64(56, BigInt(a), l), this.moveExternBytes(u, t, l);
        },
        inferStat(t) {
            if (t) return {
                size: t.size,
                type: an(t, "readdir") ? "directory" : "file"
            };
        }
    }), Mn({
        fdFilestatGet(t, e, n) {
            return $n(n, ft, (() => {
                const [e] = this.getStream(t);
                if (this.hasListener("stat")) {
                    const n = e.valueOf(), r = this.getStreamLocation?.(t);
                    return this.triggerEvent("stat", {
                        ...r,
                        target: n,
                        flags: {}
                    });
                }
                return this.inferStat(e);
            }), (t => this.copyStat(e, t)));
        },
        exports: {
            fdFilestatGet: {
                async: !0
            }
        }
    }), Mn({
        fdFilestatSetTimesEvent: "utimes",
        fdFilestatSetTimes(t, e, n, r, i) {
            return $n(i, ft, (() => {
                const [i] = this.getStream(t), s = i.valueOf(), o = this.getStreamLocation?.(t), a = xn(e, n, r);
                return this.triggerEvent("utimes", {
                    ...o,
                    target: s,
                    times: a,
                    flags: {}
                });
            }), (t => void 0 === t ? At : Cn(t, ft)));
        },
        exports: {
            fdFilestatSetTimes: {
                async: !0
            }
        }
    }), Mn({
        fdPread(t, e, n, r, i, s) {
            const o = this.littleEndian, a = [];
            let c = 0;
            return $n(s, yt, (() => {
                const [i, s] = this.getStream(t);
                zn(s, Ut.fd_read), _n(i, "pread");
                const l = hn(16 * n);
                this.moveExternBytes(l, e, !1);
                for (let t = 0; t < n; t++) {
                    const e = Ke(l, 16 * t, o), n = Qe(l, 16 * t + 8, o);
                    a.push({
                        ptr: e,
                        len: n
                    }), c += n;
                }
                return i.pread(c, Xe(r));
            }), (t => {
                let {byteOffset: e, byteLength: n, buffer: r} = t;
                for (const {ptr: t, len: i} of a) if (n > 0) {
                    const s = new DataView(r, e, Math.min(n, i));
                    this.moveExternBytes(s, t, !0), e += i, n -= i;
                }
                this.copyUint32(i, t.length);
            }));
        },
        ...{
            exports: {
                fdPread: {
                    async: !0
                },
                fdPread1: {
                    async: !0
                }
            },
            fdPread1(t, e, n, r, i, s) {
                return $n(s, yt, (() => {
                    const [e, i] = this.getStream(t);
                    return zn(i, Ut.fd_read), _n(e, "pread"), e.pread(n, Xe(r));
                }), (t => {
                    this.moveExternBytes(t, e, !0), this.copyUint32(i, t.length);
                }));
            }
        }
    }), Mn({
        fdPwrite(t, e, n, r, i, s) {
            const o = this.littleEndian;
            let a = 0;
            return $n(s, yt, (() => {
                const [i, s] = this.getStream(t);
                zn(s, Ut.fd_write), _n(i, "pwrite");
                const c = hn(16 * n);
                this.moveExternBytes(c, e, !1);
                const l = [];
                for (let t = 0; t < n; t++) {
                    const e = Ke(c, 16 * t, o), n = Qe(c, 16 * t + 8, o);
                    l.push({
                        ptr: e,
                        len: n
                    }), a += n;
                }
                const u = new ArrayBuffer(a);
                let f = 0;
                for (const {ptr: t, len: e} of l) {
                    const n = new DataView(u, f, e);
                    this.moveExternBytes(n, t, !1), f += e;
                }
                const h = new Uint8Array(u);
                return i.pwrite(h, Xe(r));
            }), (() => this.copyUint32(i, a)));
        },
        ...{
            exports: {
                fdPwrite: {
                    async: !0
                },
                fdPwrite1: {
                    async: !0
                }
            },
            fdPwrite1(t, e, n, r, i, s) {
                return $n(s, yt, (() => {
                    const [i, s] = this.getStream(t);
                    zn(s, Ut.fd_write), _n(i, "pwrite");
                    const o = new Uint8Array(n);
                    return this.moveExternBytes(o, e, !1), i.pwrite(o, Xe(r));
                }), (() => this.copyUint32(i, n)));
            }
        }
    }), Mn({
        fdRead(t, e, n, r, i) {
            const s = this.littleEndian, o = [];
            let a = 0;
            return $n(i, ft, (() => {
                const [r, i, c] = this.getStream(t);
                zn(i, Ut.fd_read);
                const l = hn(16 * n);
                this.moveExternBytes(l, e, !1);
                for (let t = 0; t < n; t++) {
                    const e = Ke(l, 16 * t, s), n = Qe(l, 16 * t + 8, s);
                    o.push({
                        ptr: e,
                        len: n
                    }), a += n;
                }
                return (c & kt.nonblock ? r.readnb : r.read).call(r, a);
            }), (t => {
                let {byteOffset: e, byteLength: n, buffer: i} = t;
                for (const {ptr: t, len: r} of o) {
                    const s = Math.min(n, r);
                    if (s > 0) {
                        const r = new DataView(i, e, s);
                        this.moveExternBytes(r, t, !0), e += s, n -= s;
                    }
                }
                this.copyUint32(r, t.length);
            }));
        },
        ...{
            exports: {
                fdRead: {
                    async: !0
                },
                fdRead1: {
                    async: !0
                }
            },
            fdRead1(t, e, n, r, i) {
                return $n(i, ft, (() => {
                    const [e, r, i] = this.getStream(t);
                    zn(r, Ut.fd_read);
                    return (i & kt.nonblock ? e.readnb : e.read).call(e, n);
                }), (t => {
                    this.moveExternBytes(t, e, !0), this.copyUint32(r, t.length);
                }));
            }
        }
    }), Mn({
        fdReaddir(t, e, n, r, i, s) {
            if (n < 24) return pt;
            let o, a;
            return $n(s, ft, (() => ([o] = this.getStream(t), o.tell())), (t => $n(s, ft, (() => {
                r = t;
                const e = o.readdir();
                return a = cn(e), e;
            }), (t => {
                const s = hn(n);
                let c = n, l = 0;
                for (;t; ) {
                    const {name: e, type: n = "unknown", ino: i = 1} = t, u = Re(e), f = un(n, xt);
                    if (void 0 === f) throw new InvalidEnumValue(xt, n);
                    if (c < 24 + u.length) {
                        o.seek(Number(r));
                        break;
                    }
                    s.setBigUint64(l, BigInt(++r), !0), s.setBigUint64(l + 8, BigInt(i), !0), s.setUint32(l + 16, u.length, !0), 
                    s.setUint8(l + 20, f), l += 24, c -= 24;
                    for (let t = 0; t < u.length; t++, l++) s.setUint8(l, u[t]);
                    c -= u.length, t = c > 40 && !a ? o.readdir() : null;
                }
                this.moveExternBytes(s, e, !0), this.copyUint32(i, l);
            }))));
        },
        exports: {
            fdReaddir: {
                async: !0
            }
        }
    }), Mn({
        fdSeek(t, e, n, r, i) {
            return $n(i, ft, (() => {
                const [r] = this.getStream(t);
                return _n(r, "seek"), r.seek(Xe(e), n);
            }), (t => this.copyUint64(r, t)));
        },
        exports: {
            fdSeek: {
                async: !0
            }
        }
    }), Mn({
        fdSync(t, e) {
            return $n(e, ft, (() => {
                const [e] = this.getStream(t);
                if (an(e, "sync")) return e.sync?.();
            }));
        },
        exports: {
            fdSync: {
                async: !0
            }
        }
    }), Mn({
        fdTell(t, e, n) {
            return $n(n, ft, (() => {
                const [e] = this.getStream(t);
                return _n(e, "tell"), e.tell();
            }), (t => this.copyUint64(e, t)));
        },
        exports: {
            fdTell: {
                async: !0
            }
        }
    }), Mn({
        fdWrite(t, e, n, r, i) {
            const s = this.littleEndian;
            let o = 0;
            return $n(i, ft, (() => {
                const [r, i, a] = this.getStream(t);
                zn(i, Ut.fd_write);
                const c = hn(16 * n);
                this.moveExternBytes(c, e, !1);
                const l = [];
                for (let t = 0; t < n; t++) {
                    const e = Ke(c, 16 * t, s), n = Qe(c, 16 * t + 8, s);
                    l.push({
                        ptr: e,
                        len: n
                    }), o += n;
                }
                const u = new ArrayBuffer(o);
                let f = 0;
                for (const {ptr: t, len: e} of l) {
                    const n = new DataView(u, f, e);
                    this.moveExternBytes(n, t, !1), f += e;
                }
                const h = new Uint8Array(u);
                return (a & kt.nonblock ? r.writenb : r.write).call(r, h);
            }), (() => {
                r && this.copyUint32(r, o);
            }));
        },
        fdWriteStderr(t, e) {
            return $n(!0, ft, (() => {
                const [e, n, r] = this.getStream(2);
                zn(n, Ut.fd_write);
                return (r & kt.nonblock ? e.writenb : e.write).call(e, t);
            })), 0;
        },
        ...{
            exports: {
                fdWrite: {
                    async: !0
                },
                fdWrite1: {
                    async: !0
                },
                fdWriteStderr: {
                    async: !0
                }
            },
            fdWrite1(t, e, n, r, i) {
                return $n(i, ft, (() => {
                    const [r, i, s] = this.getStream(t);
                    zn(i, Ut.fd_write);
                    const o = s & kt.nonblock ? r.writenb : r.write, a = new Uint8Array(n);
                    return this.moveExternBytes(a, e, !1), o.call(r, a);
                }), (() => {
                    r && this.copyUint32(r, n);
                }));
            }
        }
    }), Mn({
        pathCreateDirectoryEvent: "mkdir",
        pathCreateDirectory(t, e, n, r) {
            return $n(r, bt, (() => {
                const r = this.obtainStreamLocation(t, e, n);
                return this.triggerEvent("mkdir", r, bt);
            }), (t => void 0 === t ? vt : t instanceof Map ? dt : Cn(t, bt)));
        },
        exports: {
            pathCreateDirectory: {
                async: !0
            }
        }
    }), Mn({
        pathFilestatGetEvent: "stat/open",
        pathFilestatGet(t, e, n, r, i, s) {
            let o = !1;
            return $n(s, bt, (() => {
                const i = this.obtainStreamLocation(t, n, r);
                let s = {
                    ...ln(e, Mt)
                };
                return this.hasListener("stat") ? this.triggerEvent("stat", {
                    ...i,
                    flags: s
                }) : (s = {
                    ...s,
                    dryrun: !0
                }, o = !0, this.triggerEvent("open", {
                    ...i,
                    rights: {},
                    flags: s
                }));
            }), (t => {
                if (void 0 === t) return vt;
                if (!1 === t) return bt;
                if (o) {
                    const e = this.convertReader(t) ?? this.convertWriter(t) ?? this.convertDirectory(t);
                    if (!e) throw new InvalidStream(Ut.fd_read | Ut.fd_write | Ut.fd_readdir, t);
                    t = this.inferStat(e);
                }
                return this.copyStat(i, t);
            }));
        },
        exports: {
            pathFilestatGet: {
                async: !0
            }
        }
    }), Mn({
        pathFilestatSetTimesEvent: "utimes",
        pathFilestatSetTimes(t, e, n, r, i, s, o, a) {
            return $n(a, bt, (() => {
                const a = this.obtainStreamLocation(t, n, r), c = xn(i, s, o), l = ln(e, Mt);
                return this.triggerEvent("utimes", {
                    ...a,
                    times: c,
                    flags: l
                });
            }), (t => void 0 === t ? vt : Cn(t, bt)));
        },
        exports: {
            pathFilestatSetTimes: {
                async: !0
            }
        }
    });
    const nr = {
        read: Ut.fd_read,
        write: Ut.fd_write,
        readdir: Ut.fd_readdir
    };
    function rr() {
        Object.assign(this, {
            resolved: !0
        });
    }
    function ir(t) {
        Object.assign(this, {
            resolved: !0,
            length: t
        });
    }
    function sr(t) {
        console.error(t), Object.assign(this, {
            resolved: !0,
            error: ft
        });
    }
    let or, ar;
    function cr() {
        const t = lr.toString(), e = t.indexOf("{") + 1, n = t.lastIndexOf("}");
        return t.slice(e, n);
    }
    function lr() {
        const t = WebAssembly;
        let e, n;
        function r(r) {
            switch (r.type) {
              case "start":
                {
                    const {executable: i, memory: s, futex: o, options: a} = r, c = {
                        env: {
                            memory: s
                        },
                        wasi: {},
                        wasi_snapshot_preview1: {}
                    }, l = () => {
                        throw new Error("Exit");
                    };
                    for (const {module: r, name: a, kind: u} of t.Module.imports(i)) {
                        const t = c[r];
                        if ("function" === u && t && (t[a] = "proc_exit" === a ? l : function(...t) {
                            return Atomics.store(o, 0, 0), e.postMessage({
                                type: "call",
                                module: r,
                                name: a,
                                args: t
                            }), Atomics.wait(o, 0, 0), 2 === Atomics.load(o, 0) && (n.exports.wasi_thread_clean(0), 
                            l()), Atomics.load(o, 1);
                        }, "fd_write" === a)) {
                            const n = t[a];
                            t[a] = function(t, i, o, c) {
                                if (2 === t) {
                                    const t = new DataView(s.buffer);
                                    let n = 0;
                                    const l = [];
                                    for (let e = 0, r = 0; e < o; e++, r += 8) {
                                        const e = t.getUint32(i + r, !0), s = t.getUint32(i + r + 4, !0);
                                        l.push({
                                            ptr: e,
                                            len: s
                                        }), n += s;
                                    }
                                    const u = new Uint8Array(n);
                                    let f = 0;
                                    for (const {ptr: e, len: n} of l) {
                                        const r = new Uint8Array(t.buffer, e, n);
                                        u.set(r, f), f += n;
                                    }
                                    return e.postMessage({
                                        type: "call",
                                        module: r,
                                        name: `${a}_stderr`,
                                        args: [ u ]
                                    }, [ u.buffer ]), t.setUint32(c, n, !0), 0;
                                }
                                return n(t, i, o, c);
                            };
                        }
                    }
                    a.tableInitial && (c.env.__indirect_function_table = new t.Table({
                        initial: a.tableInitial,
                        element: "anyfunc"
                    })), n = new t.Instance(i, c);
                }
                break;

              case "run":
                try {
                    n.exports.wasi_thread_start(r.tid, r.taddr);
                } catch {}
                e.postMessage({
                    type: "done"
                });
                break;

              case "clean":
                try {
                    n.exports.wasi_thread_clean(r.raddr);
                } catch {}
                e.postMessage({
                    type: "done"
                });
                break;

              case "end":
                e.close();
            }
        }
        "object" == typeof self || "node" !== r.env.COMPAT ? (self.onmessage = t => r(t.data), 
        e = self) : "node" === r.env.COMPAT && import("node:worker_threads").then((t => {
            e = t.parentPort, e.on("message", r);
        }));
    }
    function ur(t, n) {
        const {byteSize: r, type: i} = n;
        if (!(i === e.Slice ? t.byteLength % r == 0 : t.byteLength === r)) throw new BufferSizeMismatch(n, t);
    }
    function fr(t) {
        throw new BufferExpected(t);
    }
    Mn({
        pathOpenEvent: "open",
        pathOpen(t, e, n, r, i, s, o, a, c, l) {
            const u = [ Number(s), Number(o) ];
            let f;
            return u[0] & (Ut.fd_read | Ut.fd_write | Ut.fd_readdir) || (u[0] |= Ut.fd_read), 
            $n(l, bt, (() => {
                f = this.obtainStreamLocation(t, n, r);
                const s = ln(u[0], nr), o = {
                    ...ln(e, Mt),
                    ...ln(i, Et),
                    ...ln(a, kt)
                };
                return this.triggerEvent("open", {
                    ...f,
                    rights: s,
                    flags: o
                });
            }), (t => {
                if (void 0 === t) return vt;
                if (!1 === t) return bt;
                const e = this.convertReader(t) ?? this.convertWriter(t) ?? this.convertDirectory(t);
                if (!e) throw new InvalidStream(u[0], t);
                const n = this.createStreamHandle(e, u, a);
                this.setStreamLocation?.(n, f), this.copyUint32(c, n);
            }));
        },
        exports: {
            pathOpen: {
                async: !0
            }
        }
    }), Mn({
        pathReadlinkEvent: "readlink",
        pathReadlink(t, e, n, r, i, s, o) {
            return $n(o, bt, (() => {
                const r = this.obtainStreamLocation(t, e, n);
                return this.triggerEvent("readlink", r, bt);
            }), (t => {
                if (void 0 === t) return vt;
                if (!1 === t) return bt;
                if ("string" != typeof t) throw new TypeMismatch("string", t);
                const e = Re(t).slice(0, i);
                this.moveExternBytes(e, r, this.littleEndian), this.copyUint32(s, e.length);
            }));
        },
        exports: {
            pathReadlink: {
                async: !0
            }
        }
    }), Mn({
        pathRemoveDirectory: "rmdir",
        pathRemoveDirectory(t, e, n, r) {
            return $n(r, bt, (() => {
                const r = this.obtainStreamLocation(t, e, n);
                return this.triggerEvent("rmdir", r, bt);
            }), (t => void 0 === t ? vt : Cn(t, bt)));
        },
        exports: {
            pathRemoveDirectory: {
                async: !0
            }
        }
    }), Mn({
        pathRenameEvent: "rename",
        pathRename(t, e, n, r, i, s, o) {
            return $n(o, bt, (() => {
                const o = this.obtainStreamLocation(t, e, n), {path: a, parent: c} = this.obtainStreamLocation(r, i, s);
                return this.triggerEvent("rename", {
                    ...o,
                    newParent: c,
                    newPath: a
                }, bt);
            }), (t => void 0 === t ? vt : Cn(t, bt)));
        },
        exports: {
            pathRename: {
                async: !0
            }
        }
    }), Mn({
        pathSymlinkEvent: "symlink",
        pathSymlink(t, e, n, r, i, s) {
            return $n(s, bt, (() => {
                const s = this.obtainZigView(t, e, !1), o = Le(new Uint8Array(s.buffer, s.byteOffset, s.byteLength)).trim(), a = this.obtainStreamLocation(n, r, i);
                return this.triggerEvent("symlink", {
                    ...a,
                    target: o
                }, bt);
            }), (t => void 0 === t ? vt : Cn(t, bt)));
        },
        exports: {
            pathSymlink: {
                async: !0
            }
        }
    }), Mn({
        pathUnlinkFileEvent: "unlink",
        pathUnlinkFile(t, e, n, r) {
            return $n(r, bt, (() => {
                const r = this.obtainStreamLocation(t, e, n);
                return this.triggerEvent("unlink", r, bt);
            }), (t => void 0 === t ? vt : Cn(t, bt)));
        },
        exports: {
            pathUnlinkFile: {
                async: !0
            }
        }
    }), Mn({
        pollOneoff(t, e, n, r, i) {
            const s = [], o = [], a = this.littleEndian;
            return $n(i, ft, (() => {
                const e = hn(48 * n);
                this.moveExternBytes(e, t, !1);
                for (let t = 0; t < n; t++) {
                    const n = 48 * t, r = e.getBigUint64(n, a), i = e.getUint8(n + 8), c = {
                        tag: i,
                        userdata: r,
                        error: ct
                    };
                    let l;
                    switch (s.push(c), i) {
                      case Vt:
                        {
                            let t = e.getBigUint64(n + 24, a);
                            const r = new Int32Array(new SharedArrayBuffer(4)), i = rr.bind(c);
                            if (0n === t) i(); else {
                                const e = Math.ceil(Number(t) / 1e6);
                                l = Atomics.waitAsync(r, 0, 0, e).value.then(i);
                            }
                        }
                        break;

                      case Tt:
                      case Bt:
                        {
                            const t = e.getInt32(n + 16, a), r = ir.bind(c), s = sr.bind(c);
                            try {
                                const [e] = this.getStream(t);
                                _n(e, "poll");
                                const n = e.poll(i);
                                cn(n) ? l = n.then(r, s) : r(n);
                            } catch (t) {
                                if (t.errno === vt) throw t;
                                s(t);
                            }
                        }
                        break;

                      default:
                        throw new InvalidArgument;
                    }
                    l && o.push(l);
                }
                if (o.length === s.length) return Promise.any(o);
            }), (() => {
                let t = 0;
                for (const e of s) e.resolved && t++;
                const n = hn(32 * t);
                let i = 0;
                for (const t of s) if (t.resolved) {
                    const e = 32 * i;
                    n.setBigUint64(e, t.userdata, a), n.setUint16(e + 8, t.error, a), n.setUint8(e + 10, t.tag), 
                    void 0 !== t.length && (0 === t.length ? n.setUint16(e + 24, 1, a) : n.setBigUint64(e + 16, BigInt(t.length), a)), 
                    i++;
                }
                this.moveExternBytes(n, e, !0), this.copyUint32(r, t);
            }));
        },
        exports: {
            pollOneoff: {
                async: !0
            }
        }
    }), Mn({
        init() {
            this.nextThreadId = 1, this.workers = [], "node" === process.env.COMPAT && "function" != typeof Worker && import("node:worker_threads").then((t => or = t.Worker));
        },
        getThreadHandler(t) {
            switch (t) {
              case "thread-spawn":
                return "object" != typeof window || window.crossOriginIsolated || console.warn("%cHTML document is not cross-origin isolated %c\n\nWebAssembly multithreading in the browser is only possibly when %cwindow.crossOriginIsolated%c = true. Visit https://developer.mozilla.org/en-US/docs/Web/API/Window/crossOriginIsolated for information on how to enable it.", "color: red;font-size: 200%;font-weight:bold", "", "background-color: lightgrey;font-weight:bold", ""), 
                this.spawnThread.bind(this);

              case "thread-cancel":
                return this.cancelThread.bind(this);

              case "thread-address":
                return this.getThreadAddress.bind(this);
            }
        },
        spawnThread(t) {
            const e = this.nextThreadId++;
            1073741824 === this.nextThreadId && (this.nextThreadId = 1);
            return this.createWorker().run(e, t), e;
        },
        cancelThread(t, e) {
            const n = this.workers.find((e => e.tid === t));
            if (n) if (e) {
                n.end(!0);
                this.createWorker().clean(e);
            } else n.canceled = !0;
        },
        getThreadAddress(t) {
            return this.workers.find((e => e.tid === t)).taddr;
        },
        createWorker() {
            const t = t => {
                switch (t.type) {
                  case "call":
                    if (e.canceled) e.canceled = !1, e.signal(2); else {
                        const {module: n, name: r, args: i} = t, s = this.exportedModules[n]?.[r], o = s?.(...i, !0), a = t => e.signal(1, t);
                        cn(o) ? o.then(a) : a(o);
                    }
                    break;

                  case "done":
                    e.end();
                }
            };
            let e;
            if ("function" == typeof Worker) {
                const n = function() {
                    if (!ar) {
                        const t = cr();
                        ar = URL.createObjectURL(new Blob([ t ], {
                            type: "text/javascript"
                        }));
                    }
                    return ar;
                }();
                e = new Worker(n, {
                    name: "zig"
                }), e.addEventListener("message", (e => t(e.data)));
            } else if ("node" === process.env.COMPAT) {
                const n = cr();
                e = new or(n, {
                    eval: !0
                }), e.on("message", t);
            }
            const {executable: n, memory: r, options: i} = this, s = new Int32Array(new SharedArrayBuffer(8));
            return e.postMessage({
                type: "start",
                executable: n,
                memory: r,
                options: i,
                futex: s
            }), e.signal = (t, e) => {
                0 === Atomics.load(s, 0) && (Atomics.store(s, 0, t), Atomics.store(s, 1, 0 | e), 
                Atomics.notify(s, 0, 1));
            }, e.run = (t, n) => {
                e.tid = t, e.taddr = n, e.canceled = !1, e.postMessage({
                    type: "run",
                    tid: t,
                    taddr: n
                });
            }, e.clean = t => {
                e.postMessage({
                    type: "clean",
                    raddr: t
                });
            }, e.end = (t = !1) => {
                t ? e.terminate() : e.postMessage({
                    type: "end"
                }), function(t, e) {
                    const n = t.indexOf(e);
                    -1 !== n && t.splice(n, 1);
                }(this.workers, e);
            }, this.workers.push(e), e;
        }
    }), Mn({
        init() {
            this.comptime = !1, this.slots = {}, this.structures = [], this.structureCounters = {
                struct: 0,
                union: 0,
                errorSet: 0,
                enum: 0,
                opaque: 0
            }, this.littleEndian = !0, this.runtimeSafety = !1, this.ioRedirection = !0, this.libc = !1;
        },
        createView(t, e, n, r) {
            if (n) {
                const n = this.allocateJSMemory(e, 0);
                return e > 0 && this.moveExternBytes(n, t, !1), n;
            }
            {
                const n = this.obtainZigView(t, e);
                return n[Lt].handle = r, n;
            }
        },
        createInstance(t, e, n) {
            const {constructor: r} = t, i = r.call(se, e);
            return n && Object.assign(i[Ft], n), i;
        },
        createTemplate: (t, e) => ({
            [Ct]: t,
            [Ft]: e
        }),
        appendList(t, e) {
            t.push(e);
        },
        getSlotValue(t, e) {
            return t || (t = this.slots), t[e];
        },
        setSlotValue(t, e, n) {
            t || (t = this.slots), t[e] = n;
        },
        beginStructure(t) {
            this.defineStructure(t);
        },
        finishStructure(t) {
            t.name || this.inferTypeName(t), this.structures.push(t), this.finalizeStructure(t);
        },
        acquireStructures() {
            const t = this.getModuleAttributes();
            this.littleEndian = !!(t & rt), this.runtimeSafety = !!(t & it), this.ioRedirection = !!(t & ot), 
            this.libc = !!(t & st);
            const e = this.getFactoryThunk(), n = {
                [Ct]: this.obtainZigView(e, 0)
            };
            this.comptime = !0, this.mixinUsage = new Map, this.invokeThunk(n, n, n), this.comptime = !1;
            for (const t of this.structures) {
                const {constructor: e, flags: n, instance: {template: r}} = t;
                for (const t of e[Zt]) try {
                    const n = e[t];
                    n?.[xe] && this.updatePointerTargets(null, n);
                } catch {}
                if (n & g && r && r[Ct]) {
                    const t = Object.create(e.prototype);
                    t[Ct] = r[Ct], t[Ft] = r[Ft], this.updatePointerTargets(null, t);
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
            const {structures: t, runtimeSafety: e, littleEndian: n, ioRedirection: r, libc: i} = this;
            return {
                structures: t,
                settings: {
                    runtimeSafety: e,
                    littleEndian: n,
                    ioRedirection: r,
                    libc: i
                }
            };
        },
        prepareObjectsForExport() {
            const t = [];
            for (const e of rn(this.structures, Ft)) {
                const n = e[Ct]?.[Lt];
                if (n) {
                    const {address: r, len: i, handle: s} = n, o = e[Ct] = this.createView(r, i, !0, 0);
                    void 0 !== s && (o.handle = s), t.push({
                        address: r,
                        len: i,
                        owner: e,
                        replaced: !1,
                        handle: s
                    });
                } else this.makeReadOnly(e);
            }
            t.sort(((t, e) => e.len - t.len));
            for (const e of t) if (!e.replaced) for (const n of t) if (e !== n && !n.replaced && !n.handle && e.address <= n.address && tn(n.address, n.len) <= tn(e.address, e.len)) {
                const t = e.owner[Ct], r = Number(n.address - e.address) + t.byteOffset;
                n.owner[Ct] = this.obtainView(t.buffer, r, n.len), n.replaced = !0;
            }
        },
        useStructures() {
            const t = this.getRootModule(), e = rn(this.structures, Ft);
            for (const t of e) t[Ct]?.[Lt] && this.variables.push({
                object: t
            });
            return this.slots = {}, this.structures = [], t.__zigar = this.getSpecialExports(), 
            t;
        },
        inferTypeName(t) {
            const e = this[`get${f[t.type]}Name`];
            t.name = e.call(this, t);
        },
        getPrimitiveName(t) {
            const {instance: {members: [e]}, flags: n = 0} = t;
            switch (e.type) {
              case W.Bool:
                return "bool";

              case W.Int:
                return n & m.IsSize ? "isize" : `i${e.bitSize}`;

              case W.Uint:
                return n & m.IsSize ? "usize" : `u${e.bitSize}`;

              case W.Float:
                return `f${e.bitSize}`;

              case W.Void:
                return "void";

              case W.Literal:
                return "enum_literal";

              case W.Null:
                return "null";

              case W.Undefined:
                return "undefined";

              case W.Type:
                return "type";

              case W.Object:
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
            for (const e of [ "Allocator", "Promise", "Generator", "Read", "Writer" ]) if (t.flags & I[`Is${e}`]) return e;
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
            return t.flags & j.IsGlobal ? "anyerror" : "ES" + this.structureCounters.errorSet++;
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
            if (n.structure.type === e.Slice && (s = s.slice(3)), r & O && (i = r & k ? "[]" : r & V ? "[*c]" : "[*]"), 
            !(r & V)) {
                const t = n.structure.constructor?.[Gt];
                t && (i = i.slice(0, -1) + `:${t.value}` + i.slice(-1));
            }
            return r & B && (i = `${i}const `), i + s;
        },
        getSliceName(t) {
            const {instance: {members: [e]}, flags: n} = t;
            return n & F ? "anyopaque" : `[_]${e.structure.name}`;
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
            const {instance: {members: [e]}} = t, n = e.structure.name;
            return n ? n.slice(4, -1) : "fn ()";
        },
        exports: {
            createView: {},
            createInstance: {},
            createTemplate: {},
            appendList: {},
            getSlotValue: {},
            setSlotValue: {},
            beginStructure: {},
            finishStructure: {}
        },
        imports: {
            getFactoryThunk: {},
            getModuleAttributes: {}
        }
    }), Mn({
        init() {
            this.viewMap = new WeakMap;
            {
                const t = this;
                this.fallbackHandler = function(e, n, r) {
                    let {address: i} = this[Lt], s = this;
                    (n > 0 || void 0 !== r) && (s = new DataView(s.buffer, s.byteOffset + n, r), i = tn(i, n)), 
                    t.moveExternBytes(s, i, e);
                }, this.needFallback = void 0;
            }
        },
        extractView(t, n, r = fr) {
            const {type: i, byteSize: s, constructor: o} = t;
            let a;
            const c = n?.[Symbol.toStringTag];
            if (c && ("DataView" === c ? a = this.registerView(n) : "ArrayBuffer" === c ? a = this.obtainView(n, 0, n.byteLength) : (c && c === o[ue]?.name || "Uint8ClampedArray" === c && o[ue] === Uint8Array || "Uint8Array" === c && n instanceof Buffer) && (a = this.obtainView(n.buffer, n.byteOffset, n.byteLength))), 
            !a) {
                const r = n?.[Ct];
                if (r) {
                    const {constructor: o, instance: {members: [a]}} = t;
                    if (on(n, o)) return r;
                    if (function(t) {
                        return t === e.Array || t === e.Vector || t === e.Slice;
                    }(i)) {
                        const {byteSize: o, structure: {constructor: c}} = a, l = nn(n, c);
                        if (void 0 !== l) {
                            if (i === e.Slice || l * o === s) return r;
                            throw new ArrayLengthMismatch(t, null, n);
                        }
                    }
                }
            }
            return a ? void 0 !== s && ur(a, t) : r?.(t, n), a;
        },
        assignView(t, n, r, i, s) {
            const {byteSize: o, type: a} = r, c = o ?? 1, l = {
                [Ct]: n
            };
            if (t[Ct]) {
                const i = a === e.Slice ? c * t.length : c;
                if (n.byteLength !== i) throw new BufferSizeMismatch(r, n, t);
                t.constructor[Gt]?.validateData?.(l, t.length), pn(t, l);
            } else {
                void 0 !== o && ur(n, r);
                const e = n.byteLength / c;
                t.constructor[Gt]?.validateData?.(l, e), s && (i = !0), t[Ee](i ? null : n, e, s), 
                i && pn(t, l);
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
        obtainView(t, e, n, r = !0) {
            let i;
            if (r) {
                const {existing: r, entry: s} = this.findViewAt(t, e, n);
                if (r) return r;
                i = new DataView(t, e, n), s ? s.set(`${e}:${n}`, i) : this.viewMap.set(t, i);
            } else i = new DataView(t, e, n), i[ve] = !0;
            {
                const r = t[Lt];
                if (r) {
                    const s = tn(r.address, e);
                    i[Lt] = {
                        address: s,
                        len: n
                    }, t[pe] && (i[pe] = this.fallbackHandler);
                }
            }
            return i;
        },
        registerView(t) {
            if (!t[Lt]) {
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
                requireBufferFallback: {},
                syncExternalBuffer: {},
                moveExternBytes: {}
            },
            usingBufferFallback() {
                return void 0 === this.needFallback && (this.needFallback = this.requireBufferFallback?.()), 
                this.needFallback;
            },
            allocateJSMemory(t, e) {
                const n = e > hr && this.getBufferAddress ? e : 0, r = new ArrayBuffer(t + n);
                let i = 0;
                if (n) {
                    const t = this.getBufferAddress(r);
                    i = Ze(t, e) - t;
                }
                return this.obtainView(r, Number(i), t);
            }
        }
    });
    const hr = [ "arm64", "ppc64", "x64", "s390x" ].includes(process.arch) ? 16 : 8, dr = $t.proxyMaps ??= [ 0, nt.Const, nt.ReadOnly, nt.Const | nt.ReadOnly ].reduce(((t, e) => (t[e] = new WeakMap, 
    t)), {}), gr = $t.proxyTargetMap ??= new WeakMap;
    function pr(t, e) {
        const n = t, r = dr[e & (nt.Const | nt.ReadOnly)];
        let i = r.get(n);
        return i || (i = new Proxy(t, Ur[e]), r.set(n, i), gr.set(i, {
            target: t,
            type: e
        })), i;
    }
    function yr(t, n = !1) {
        const {type: r, flags: i} = t;
        let s = n && r !== e.Function ? nt.ReadOnly : 0;
        return i & y && (r === e.Pointer ? (s |= nt.Pointer, i & B && (s |= nt.Const)) : s |= nt.Slice), 
        s;
    }
    function mr(t) {
        if (("object" == typeof t || "function" == typeof t) && t) return gr.get(t);
    }
    function br(t) {
        const e = mr(t);
        return e ? [ e.target, e.type ] : [ t, 0 ];
    }
    function wr(t) {
        const e = mr(t);
        let n;
        if (e) {
            if (e.type & nt.ReadOnly) return t;
            n = e.type | nt.ReadOnly, t = e.target;
        } else {
            if (!t?.[Ct] || "object" != typeof t || t[we]) return t;
            n = t.constructor[be] ?? nt.ReadOnly;
        }
        return pr(t, n);
    }
    const vr = {
        get(t, e) {
            if (e in t) return t[e];
            return t[qt][e];
        },
        set(t, e, n) {
            if (e in t) t[e] = n; else {
                t[qt][e] = n;
            }
            return !0;
        },
        deleteProperty(t, e) {
            if (e in t) delete t[e]; else {
                delete t[qt][e];
            }
            return !0;
        },
        has(t, e) {
            if (e in t) return !0;
            return e in t[qt];
        },
        apply: (t, e, n) => t["*"].apply(e, n)
    }, Sr = {
        ...vr,
        set(t, e, n) {
            if (e in t) Bn(); else {
                t[qt][e] = n;
            }
            return !0;
        }
    }, Ir = {
        get(t, e) {
            const n = t[e];
            return "string" == typeof e ? wr(n) : n;
        },
        set(t, e, n) {
            Bn();
        }
    }, Ar = {
        ...vr,
        get: (t, e) => e in t ? Ir.get(t, e) : Ir.get(t[qt], e),
        set: (t, e, n) => (e in t ? t[e] = n : Bn(), !0)
    }, xr = {
        ...Sr,
        set: Ir.set
    }, Er = {
        get(t, e) {
            const n = "symbol" == typeof e ? 0 : 0 | e;
            return 0 !== n || n == e ? t.get(n) : t[e];
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
            return e.push("length"), e;
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
    }, Mr = {
        ...Er,
        get(t, e) {
            const n = "symbol" == typeof e ? 0 : 0 | e;
            return 0 !== n || n == e ? wr(t.get(n)) : "set" === e ? Bn : t[e];
        },
        set: Bn
    }, Ur = {
        [nt.Pointer]: vr,
        [nt.Pointer | nt.Const]: Ar,
        [nt.Pointer | nt.ReadOnly]: Sr,
        [nt.Pointer | nt.ReadOnly | nt.Const]: xr,
        [nt.Slice]: Er,
        [nt.Slice | nt.ReadOnly]: Mr,
        [nt.ReadOnly]: Ir
    };
    function kr(t) {
        const [n] = br(t);
        if (n?.[Ct] && !n[we]) {
            n[we] = !0;
            const t = n.constructor[Pt];
            t === e.Pointer ? Or(n, [ "length" ]) : t === e.Array || t === e.Slice ? (Or(n), 
            function(t) {
                const {get: e} = t;
                _e(t, {
                    get: Ce((function(t) {
                        return kr(e.call(this, t));
                    })),
                    set: Ce(Bn)
                });
            }(n)) : Or(n);
        }
        return t;
    }
    function Or(t, e = []) {
        const n = Object.getOwnPropertyDescriptors(t.constructor.prototype);
        for (const [r, i] of Object.entries(n)) if (!e.includes(r)) {
            const {get: e, set: n} = i;
            i.get = e ? function() {
                return kr(e.call(this));
            } : void 0, i.set = n ? Bn : void 0, ze(t, r, i);
        }
    }
    function Vr(t) {
        const e = mr(t);
        if (e) {
            const {target: t} = e;
            return e.type & nt.Pointer ? t["*"] : t;
        }
        return t;
    }
    function Br() {
        const t = Vr(this), e = t.length;
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
    function Tr(t) {
        const e = Fe(t), n = Vr(this), r = n.length;
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
    function $r(t) {
        return {
            [Symbol.iterator]: Tr.bind(this, t),
            length: this.length
        };
    }
    function zr(t) {
        return {
            [Symbol.iterator]: Cr.bind(this, t),
            length: this[Zt].length
        };
    }
    function _r(t) {
        return zr.call(this, t)[Symbol.iterator]();
    }
    function Cr(t) {
        const e = Fe(t), n = this, r = this[Zt];
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
    function Fr(t) {
        return {
            [Symbol.iterator]: Lr.bind(this, t),
            length: this[Zt].length
        };
    }
    function jr(t) {
        return Fr.call(this, t)[Symbol.iterator]();
    }
    function Lr(t) {
        const e = Fe(t), n = this, r = this[Zt], i = this[ce];
        let s = 0;
        return {
            next() {
                let t, o;
                if (s < r.length) {
                    const a = r[s++];
                    t = [ a, e((() => i[a].call(n))) ], o = !1;
                } else o = !0;
                return {
                    value: t,
                    done: o
                };
            }
        };
    }
    function Rr() {
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
    function Pr() {
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
    function Nr() {
        return {
            [Symbol.iterator]: Pr.bind(this),
            length: this.length
        };
    }
    function Dr(t = {}) {
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
    function Wr(t, {get: e, set: n}) {
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
    function Zr(t) {
        return Yr.call(this, t).$;
    }
    function Gr(t) {
        return Zr.call(this, t)?.string ?? null;
    }
    function qr(t) {
        return Zr.call(this, t)?.typedArray ?? null;
    }
    function Jr(t) {
        return Zr.call(this, t)?.clampedArray ?? null;
    }
    function Hr(t) {
        return Zr.call(this, t)?.valueOf?.() ?? null;
    }
    function Yr(t) {
        return this[Ft][t] ?? this[Ae](t);
    }
    function Xr(t, e, n) {
        Yr.call(this, t)[Me](e, n);
    }
    Mn({
        makeReadOnly(t) {
            kr(t);
        }
    }), Mn({
        defineArrayEntries: () => Ce($r),
        defineArrayIterator: () => Ce(Br)
    }), Mn({
        defineStructEntries: () => Ce(zr),
        defineStructIterator: () => Ce(_r)
    }), Mn({
        defineUnionEntries: () => Ce(Fr),
        defineUnionIterator: () => Ce(jr)
    }), Mn({
        defineVectorEntries: () => Ce(Nr),
        defineVectorIterator: () => Ce(Rr)
    }), Mn({
        defineZigIterator: () => Ce(Dr)
    }), Mn({
        defineMember(t, e = !0) {
            if (!t) return {};
            const {type: n, structure: r} = t, i = this[`defineMember${Z[n]}`].call(this, t);
            if (e && r) {
                const {type: e} = r, n = this[`transformDescriptor${f[e]}`];
                if (n) return n.call(this, i, t);
            }
            return i;
        }
    }), Mn({
        defineBase64(t) {
            const e = this;
            return fn({
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
    }), Mn({
        defineMemberBool(t) {
            return this.defineMemberUsing(t, this.getAccessor);
        }
    }), Mn({
        defineClampedArray(t) {
            const e = this, n = Uint8ClampedArray;
            return fn({
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
    }), Mn({
        defineDataView(t) {
            const e = this;
            return fn({
                get() {
                    const t = this[Ct];
                    return t[pe]?.(!1), t;
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
    }), Mn({
        defineMemberFloat(t) {
            return this.defineMemberUsing(t, this.getAccessor);
        }
    }), Mn({
        defineMemberInt(t) {
            let e = this.getAccessor;
            return this.runtimeSafety && (e = this.addRuntimeCheck(e)), e = this.addIntConversion(e), 
            this.defineMemberUsing(t, e);
        }
    }), Mn({
        defineMemberLiteral(t) {
            const {slot: e} = t;
            return Wr(e, {
                get(t) {
                    return this[Ft][t].string;
                },
                set: Bn
            });
        }
    }), Mn({
        defineMemberNull: t => ({
            get: function() {
                return null;
            },
            set: Bn
        })
    }), Mn({
        defineMemberObject(t) {
            const {flags: e, structure: n, slot: r} = t;
            let i, s;
            return i = e & K ? Gr : e & tt ? qr : e & et ? Jr : e & Q ? Hr : n.flags & (h | y) ? Zr : Yr, 
            s = e & q ? Bn : Xr, Wr(r, {
                get: i,
                set: s
            });
        }
    }), Mn({
        ...{
            defineMemberUsing(t, e) {
                const {littleEndian: n} = this, {bitOffset: r, byteSize: i} = t, s = e.call(this, "get", t), o = e.call(this, "set", t);
                if (void 0 !== r) {
                    const t = r >> 3;
                    return {
                        get: function() {
                            return s.call(this[Ct], t, n);
                        },
                        set: function(e) {
                            return o.call(this[Ct], t, e, n);
                        }
                    };
                }
                return {
                    get: function(e) {
                        try {
                            return s.call(this[Ct], e * i, n);
                        } catch (n) {
                            throw function(t, e, n) {
                                return n instanceof RangeError && !(n instanceof OutOfBound) && (n = new OutOfBound(t, e)), 
                                n;
                            }(t, e, n);
                        }
                    },
                    set: function(t, e) {
                        return o.call(this[Ct], t * i, e, n);
                    }
                };
            }
        }
    }), Mn({}), Mn({
        defineSentinel(t) {
            const {byteSize: e, instance: {members: [n, r], template: i}} = t, {get: s} = this.defineMember(r), {get: o} = this.defineMember(n), a = s.call(i, 0), c = !!(r.flags & G), {runtimeSafety: l} = this;
            return Ce({
                value: a,
                bytes: i[Ct],
                validateValue(e, n, r) {
                    if (c) {
                        if (l && e === a && n !== r - 1) throw new MisplacedSentinel(t, e, n, r);
                        if (e !== a && n === r - 1) throw new MissingSentinel(t, a, r);
                    }
                },
                validateData(n, r) {
                    if (c) if (l) for (let e = 0; e < r; e++) {
                        const i = o.call(n, e);
                        if (i === a && e !== r - 1) throw new MisplacedSentinel(t, a, e, r);
                        if (i !== a && e === r - 1) throw new MissingSentinel(t, a, r);
                    } else if (r > 0 && r * e === n[Ct].byteLength) {
                        if (o.call(n, r - 1) !== a) throw new MissingSentinel(t, a, r);
                    }
                },
                isRequired: c
            });
        },
        imports: {
            findSentinel: null
        }
    }), Mn({
        defineString(t) {
            const e = this, {byteSize: n} = t.instance.members[0], r = "utf-" + 8 * n;
            return fn({
                get() {
                    let t = Le(this.typedArray, r);
                    const e = this.constructor[Gt]?.value;
                    return void 0 !== e && t.charCodeAt(t.length - 1) === e && (t = t.slice(0, -1)), 
                    t;
                },
                set(n, i) {
                    if ("string" != typeof n) throw new TypeMismatch("string", n);
                    const s = this.constructor[Gt]?.value;
                    void 0 !== s && n.charCodeAt(n.length - 1) !== s && (n += String.fromCharCode(s));
                    const o = Re(n, r), a = new DataView(o.buffer);
                    e.assignView(this, a, t, !1, i);
                }
            });
        }
    }), Mn({
        defineValueOf: () => ({
            value() {
                return ti(this, !1);
            }
        })
    });
    const Kr = BigInt(Number.MAX_SAFE_INTEGER), Qr = BigInt(Number.MIN_SAFE_INTEGER);
    function ti(t, n) {
        const r = {
            error: n ? "return" : "throw"
        }, i = Fe(r), s = new Map, o = function(t) {
            const a = "function" == typeof t ? e.Struct : t?.constructor?.[Pt];
            if (void 0 === a) {
                if (n) {
                    if ("bigint" == typeof t && Qr <= t && t <= Kr) return Number(t);
                    if (t instanceof Error) return {
                        error: t.message
                    };
                }
                return t;
            }
            let c = s.get(t);
            if (void 0 === c) {
                let n;
                switch (a) {
                  case e.Struct:
                    n = t[Jt](r), c = t.constructor[Nt] & I.IsTuple ? [] : {};
                    break;

                  case e.Union:
                    n = t[Jt](r), c = {};
                    break;

                  case e.Array:
                  case e.Vector:
                  case e.Slice:
                    n = t[Jt](), c = [];
                    break;

                  case e.Pointer:
                    try {
                        c = t["*"];
                    } catch (t) {
                        c = Symbol.for("inaccessible");
                    }
                    break;

                  case e.Enum:
                    c = i((() => String(t)));
                    break;

                  case e.Opaque:
                    c = {};
                    break;

                  default:
                    c = i((() => t.$));
                }
                if (c = o(c), s.set(t, c), n) for (const [t, e] of n) c[t] = o(e);
            }
            return c;
        };
        return o(t);
    }
    Mn({
        defineToJSON: () => ({
            value() {
                return ti(this, !0);
            }
        })
    }), Mn({
        defineMemberType(t, e) {
            const {slot: n} = t;
            return Wr(n, {
                get(t) {
                    const e = this[Ft][t];
                    return e?.constructor;
                },
                set: Bn
            });
        }
    }), Mn({
        defineTypedArray(t) {
            const e = this, n = this.getTypedArray(t);
            return fn({
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
    }), Mn({
        defineMemberUint(t) {
            let e = this.getAccessor;
            return this.runtimeSafety && (e = this.addRuntimeCheck(e)), e = this.addIntConversion(e), 
            this.defineMemberUsing(t, e);
        }
    }), Mn({
        defineMemberUndefined: t => ({
            get: function() {},
            set: Bn
        })
    }), Mn({
        defineMemberUnsupported(t) {
            const e = function() {
                throw new Unsupported;
            };
            return {
                get: e,
                set: e
            };
        }
    }), Mn({
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
    }), Mn({
        defineStructure(t) {
            const {type: e, byteSize: n} = t, r = this[`define${f[e]}`], i = [], s = {}, o = {
                dataView: this.defineDataView(t),
                base64: this.defineBase64(t),
                toJSON: this.defineToJSON(),
                valueOf: this.defineValueOf(),
                [le]: Ce(s),
                [Yt]: Ce(i)
            }, a = t.constructor = r.call(this, t, o);
            for (const [t, e] of Object.entries(o)) {
                const n = e?.set;
                n && !s[t] && "$" !== t && (s[t] = n, i.push(t));
            }
            return _e(a.prototype, o), a;
        },
        finalizeStructure(t) {
            const {name: n, type: r, constructor: i, align: s, byteSize: o, flags: a, signature: c, static: {members: l, template: u}} = t, h = [], d = {
                name: Ce(n),
                toJSON: this.defineToJSON(),
                valueOf: this.defineValueOf(),
                [ye]: Ce(c),
                [se]: Ce(this),
                [ie]: Ce(s),
                [ne]: Ce(o),
                [Pt]: Ce(r),
                [Nt]: Ce(a),
                [Zt]: Ce(h),
                [ue]: Ce(this.getTypedArray(t)),
                [Symbol.iterator]: this.defineStructIterator(),
                [Jt]: this.defineStructEntries(),
                [Zt]: Ce(h)
            }, g = {
                [Symbol.toStringTag]: Ce(n)
            };
            if (l) for (const t of l) {
                const {name: n, slot: r, flags: i} = t;
                if (t.structure.type === e.Function) {
                    let t = u[Ft][r];
                    i & K ? t[$e] = t => t.string : i & et ? t[$e] = t => t.clampedArray : i & tt ? t[$e] = t => t.typedArray : i & Q && (t[$e] = t => t.valueOf()), 
                    d[n] = Ce(t), t.name || ze(t, "name", Ce(n));
                    const [e, s] = /^(get|set)\s+([\s\S]+)/.exec(n)?.slice(1) ?? [], o = "get" === e ? 0 : 1;
                    if (e && t.length === o) {
                        d[s] ||= {};
                        d[s][e] = t;
                    }
                    if (i & H) {
                        const r = function(...e) {
                            try {
                                let [n, r] = br(this);
                                return i & Y && r === nt.Pointer && (n = n["*"]), t(n, ...e);
                            } catch (t) {
                                throw t[Se]?.(1), t;
                            }
                        };
                        if (_e(r, {
                            name: Ce(n),
                            length: Ce(t.length - 1)
                        }), g[n] = Ce(r), e && r.length === o) {
                            (g[s] ||= {})[e] = r;
                        }
                    }
                } else d[n] = this.defineMember(t), h.push(n);
            }
            d[Ft] = h.length > 0 && Ce(u[Ft]);
            const p = this[`finalize${f[r]}`];
            !1 !== p?.call(this, t, d, g) && (_e(i.prototype, g), _e(i, d));
        },
        createConstructor(t, n = {}) {
            const {type: r, byteSize: i, align: s, flags: o, instance: {members: a, template: c}} = t, {onCastError: l} = n;
            let u;
            if (c?.[Ft]) {
                const t = a.filter((t => t.flags & q));
                t.length > 0 && (u = t.map((t => t.slot)));
            }
            const f = new ObjectCache, h = this, d = function(n, a = {}) {
                const {allocator: g} = a, m = this instanceof d;
                let b, w, v = !1;
                if (m) {
                    if (0 === arguments.length) throw new NoInitializer(t);
                    if (b = this, o & p && (b[Ft] = {}), Ee in b) b[Me](n, g), w = b[Ct]; else {
                        const t = r !== e.Pointer ? g : null;
                        b[Ct] = w = h.allocateMemory(i, s, t);
                    }
                } else {
                    if (Ve in d && (b = d[Ve].call(this, n, a), !1 !== b)) return b;
                    w = h.extractView(t, n, l), (b = f.find(w)) ? v = !0 : (b = Object.create(d.prototype), 
                    Ee in b ? h.assignView(b, w, t, !1, !1) : b[Ct] = w, o & p && (b[Ft] = {}));
                }
                if (!v) {
                    if (u) for (const t of u) b[Ft][t] = c[Ft][t];
                    b[Ue]?.(), m && (Ee in b || b[Me](n, g)), ke in b && (b = b[ke]()), f.save(w, b);
                }
                return o & y && (m || !this) ? b[Oe]() : b;
            };
            return ze(d, ee, Ce(f)), d;
        },
        createInitializer: t => function(e, n) {
            const [r, i] = br(e), [s] = br(this);
            return t.call(s, r, n, i);
        },
        createApplier(t) {
            const {instance: {template: e}} = t;
            return function(n, r) {
                const [i] = br(n), [s] = br(this), o = Object.keys(i);
                if (i instanceof Error) throw i;
                const a = s[Yt], c = s[le];
                for (const e of o) if (!(e in c)) throw new NoProperty(t, e);
                let l = 0, u = 0, f = 0, h = 0;
                for (const t of a) {
                    const e = c[t];
                    e.special ? t in i && h++ : (l++, t in i ? u++ : e.required && f++);
                }
                if (0 !== f && 0 === h) {
                    const e = a.filter((t => c[t].required && !(t in i)));
                    throw new MissingInitializers(t, e);
                }
                if (h + u > o.length) for (const t of a) t in i && (o.includes(t) || o.push(t));
                u < l && 0 === h && e && e[Ct] && pn(s, e);
                for (const t of o) {
                    c[t].call(s, i[t], r);
                }
                return o.length;
            };
        },
        getTypedArray(t) {
            const {type: n, instance: r} = t;
            if (void 0 !== n && r) switch (n) {
              case e.Enum:
              case e.ErrorSet:
              case e.Primitive:
                {
                    const {byteSize: t, type: e} = r.members[0];
                    return globalThis[(t > 4 && e !== W.Float ? "Big" : "") + (e === W.Float ? "Float" : e === W.Int ? "Int" : "Uint") + 8 * t + "Array"];
                }

              case e.Array:
              case e.Slice:
              case e.Vector:
                return this.getTypedArray(r.members[0].structure);
            }
        }
    }), Mn({
        defineArgStruct(t, e) {
            const {flags: n, byteSize: r, align: i, length: s, instance: {members: o}} = t, a = this, c = o.slice(1), l = function(t, e) {
                const o = this instanceof l;
                let u, f;
                if (o ? (u = this, f = a.allocateMemory(r, i)) : (u = Object.create(l.prototype), 
                f = t), u[Ct] = f, n & p && (u[Ft] = {}), !o) return u;
                {
                    let r;
                    if (n & P && t.length === s + 1 && (r = t.pop()), t.length !== s) throw new ArgumentCountMismatch(s, t.length);
                    n & D && (u[ke] = null), a.copyArguments(u, t, c, r, e);
                }
            };
            for (const t of o) e[t.name] = this.defineMember(t);
            const u = e.retval.set;
            return e.length = Ce(c.length), e[Ae] = n & d && this.defineVivificatorStruct(t), 
            e[xe] = n & g && this.defineVisitorArgStruct(o), e[Be] = Ce((function(t) {
                u.call(this, t, this[ge]);
            })), e[Symbol.iterator] = this.defineArgIterator?.(c), l;
        },
        finalizeArgStruct(t, e) {
            const {flags: n} = t;
            e[fe] = Ce(!!(n & N));
        }
    }), Mn({
        defineFinalizerArray: ({get: t, set: e}) => ({
            value() {
                return _e(this, {
                    get: {
                        value: t.bind(this)
                    },
                    set: e && {
                        value: e.bind(this)
                    }
                }), this;
            }
        }),
        defineVivificatorArray(t) {
            const {instance: {members: [e]}} = t, {byteSize: n, structure: r} = e, i = this;
            return {
                value: function(t) {
                    const {constructor: e} = r, s = this[Ct], o = s.byteOffset + n * t, a = i.obtainView(s.buffer, o, n, !s[ve]);
                    return this[Ft][t] = e.call(jt, a);
                }
            };
        }
    }), Mn({
        defineArray(t, e) {
            const {length: n, instance: {members: [r]}, flags: i} = t, s = this.createApplier(t), o = this.defineMember(r), {set: a} = o, c = this.createConstructor(t), l = this.createInitializer((function(e, r) {
                if (on(e, c)) pn(this, e), i & g && this[xe]("copy", at.Vivificate, e); else if ("string" == typeof e && i & w && (e = {
                    string: e
                }), e?.[Symbol.iterator]) {
                    if ((e = en(e)).length !== n) throw new ArrayLengthMismatch(t, this, e);
                    let i = 0;
                    for (const t of e) a.call(this, i++, t, r);
                } else if (e && "object" == typeof e) {
                    if (0 === s.call(this, e)) throw new InvalidArrayInitializer(t, e);
                } else if (void 0 !== e) throw new InvalidArrayInitializer(t, e);
            }));
            return e.$ = {
                get: function() {
                    return pr(this, nt.Slice);
                },
                set: l
            }, e.length = Ce(n), e.entries = e[Jt] = this.defineArrayEntries(), i & v && (e.typedArray = this.defineTypedArray(t), 
            i & w && (e.string = this.defineString(t)), i & S && (e.clampedArray = this.defineClampedArray(t))), 
            e[Symbol.iterator] = this.defineArrayIterator(), e[Me] = Ce(l), e[ke] = this.defineFinalizerArray(o), 
            e[Ae] = i & d && this.defineVivificatorArray(t), e[xe] = i & g && this.defineVisitorArray(), 
            e[Oe] = {
                value() {
                    return pr(this, nt.Slice);
                }
            }, e[be] = Ce(nt.Slice), c;
        },
        finalizeArray(t, e) {
            const {flags: n, instance: {members: [r]}} = t;
            e.child = Ce(r.structure.constructor), e[Gt] = n & b && this.defineSentinel(t);
        }
    }), Mn({
        defineEnum(t, e) {
            const {instance: {members: [n]}} = t, r = this.defineMember(n), {get: i, set: s} = r, {get: o} = this.defineMember(n, !1), a = this.createApplier(t), c = [ "string", "number", "tagged union" ], l = this.createConstructor(t, {
                onCastError(t, e) {
                    throw new InvalidInitializer(t, c, e);
                }
            });
            return e.$ = r, e.toString = Ce(mn), e[Symbol.toPrimitive] = {
                value(t) {
                    switch (t) {
                      case "string":
                      case "default":
                        return this.$[Rt];

                      default:
                        return o.call(this);
                    }
                }
            }, e[Me] = Ce((function(e) {
                if (e && "object" == typeof e) {
                    if (0 === a.call(this, e)) throw new InvalidInitializer(t, c, e);
                } else void 0 !== e && s.call(this, e);
            })), l;
        },
        finalizeEnum(t, e) {
            const {flags: n, constructor: r, instance: {members: [i]}, static: {members: s, template: o}} = t, a = o[Ft], {get: c, set: l} = this.defineMember(i, !1), u = {};
            for (const {name: t, flags: n, slot: r} of s) if (n & J) {
                const n = a[r];
                ze(n, Rt, Ce(t));
                const i = c.call(n);
                e[t] = {
                    value: n,
                    writable: !1
                }, u[i] = n;
            }
            e[Ve] = {
                value(t) {
                    if ("string" == typeof t) return r[t];
                    if ("number" == typeof t || "bigint" == typeof t) {
                        let e = u[t];
                        if (!e && n & M) {
                            e = new r(void 0), l.call(e, t);
                            const n = `${t}`;
                            ze(e, Rt, Ce(n)), ze(r, n, Ce(e)), u[t] = e;
                        }
                        return e;
                    }
                    return t instanceof r ? t : t?.[Wt] instanceof r && t[Wt];
                }
            }, e[ue] = Ce(this.getTypedArray(t));
        },
        transformDescriptorEnum(t, e) {
            const {type: n, structure: r} = e;
            if (n === W.Object) return t;
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
    }), Mn({
        init() {
            this.ZigError = null, this.globalItemsByIndex = {}, this.globalErrorSet = null;
        },
        defineErrorSet(t, n) {
            const {instance: {members: [r]}, byteSize: i, flags: s} = t;
            if (!this.ZigError) {
                this.ZigError = class Error extends ZigErrorBase {};
                const t = {
                    type: e.ErrorSet,
                    flags: j.IsGlobal,
                    byteSize: i,
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
                }, n = this.defineStructure(t);
                this.finalizeStructure(t), this.globalErrorSet = n;
            }
            if (this.globalErrorSet && s & j.IsGlobal) return this.globalErrorSet;
            const o = this.defineMember(r), {set: a} = o, c = [ "string", "number" ], l = this.createApplier(t), u = this.createConstructor(t, {
                onCastError(t, e) {
                    throw new InvalidInitializer(t, c, e);
                }
            });
            return n.$ = o, n[Me] = Ce((function(e) {
                if (e instanceof u[Dt]) a.call(this, e); else if (e && "object" == typeof e && !Fn(e)) {
                    if (0 === l.call(this, e)) throw new InvalidInitializer(t, c, e);
                } else void 0 !== e && a.call(this, e);
            })), u;
        },
        finalizeErrorSet(t, e) {
            const {constructor: n, flags: r, instance: {members: [i]}, static: {members: s, template: o}} = t;
            if (this.globalErrorSet && r & j.IsGlobal) return !1;
            const a = o?.[Ft] ?? {}, c = r & j.IsGlobal ? this.globalItemsByIndex : {}, {get: l} = this.defineMember(i, !1);
            for (const {name: t, slot: n} of s) {
                const r = a[n], i = l.call(r);
                let s = this.globalItemsByIndex[i];
                const o = !!s;
                s || (s = new this.ZigError(t, i));
                const u = Ce(s);
                e[t] = u;
                const f = `${s}`;
                e[f] = u, c[i] = s, o || (_e(this.globalErrorSet, {
                    [t]: u,
                    [f]: u
                }), this.globalErrorSet[Zt].push(t), this.globalItemsByIndex[i] = s);
            }
            e[Ve] = {
                value: t => "number" == typeof t ? c[t] : "string" == typeof t ? n[t] : t instanceof n[Dt] ? c[Number(t)] : Fn(t) ? n[`Error: ${t.error}`] : t instanceof Error && n[`${t}`]
            }, e[Dt] = Ce(this.ZigError);
        },
        transformDescriptorErrorSet(t, e) {
            const {type: n, structure: r} = e;
            if (n === W.Object) return t;
            const i = t => {
                const {constructor: e, flags: n} = r, i = e(t);
                if (!i) {
                    if (n & j.IsGlobal && "number" == typeof t) {
                        const e = new this.ZigError(`Unknown error: ${t}`, t);
                        return this.globalItemsByIndex[t] = e, ze(this.globalErrorSet, `${e}`, Ce(e)), e;
                    }
                    throw t instanceof Error ? new NotInErrorSet(r, t) : new ErrorExpected(r, t);
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
    function ei(t, e) {
        return sn(t?.constructor?.child, e) && t["*"];
    }
    function ni(t, e, n) {
        if (n & O) {
            if (t?.constructor?.child?.child === e.child && t["*"]) return !0;
            if (n & V && ei(t, e.child)) return !0;
        }
        return !1;
    }
    function ri() {
        return this[Kt];
    }
    function ii(t, e) {
        return (t |= 0) < 0 ? (t = e + t) < 0 && (t = 0) : t > e && (t = e), t;
    }
    function si() {
        throw new InaccessiblePointer;
    }
    function oi() {
        const t = {
            get: si,
            set: si
        };
        _e(this, {
            "*": t,
            $: t,
            [qt]: t
        });
    }
    function ai(t, e, n, r) {
        let i, s = this[Ft][t];
        if (!s) {
            if (n & at.IgnoreUncreated) return;
            s = this[Ae](t);
        }
        r && (i = r[Ft][t], !i) || s[xe](e, n, i);
    }
    Mn({
        defineErrorUnion(t, e) {
            const {instance: {members: [n, r]}, flags: i} = t, {get: s, set: o} = this.defineMember(n), {get: a, set: c} = this.defineMember(r), {get: l, set: u} = this.defineMember(r, !1), f = n.type === W.Void, h = r.structure.constructor, {bitOffset: p, byteSize: y} = n, m = function() {
                gn(this[Ct], p >> 3, y), this[xe]?.("clear", at.IgnoreUncreated);
            }, b = this.createApplier(t), w = this.createInitializer((function(t, e) {
                if (on(t, v)) pn(this, t), i & g && (l.call(this) || this[xe]("copy", 0, t)); else if (t instanceof h[Dt] && h(t)) c.call(this, t), 
                m.call(this); else if (void 0 !== t || f) try {
                    return o.call(this, t, e), void u.call(this, 0);
                } catch (e) {
                    if (t instanceof Error) {
                        const e = h(t) ?? h.Unexpected;
                        if (!e) throw new NotInErrorSet(r.structure, t);
                        c.call(this, e), m.call(this);
                    } else if (Fn(t)) c.call(this, t), m.call(this); else {
                        if (!t || "object" != typeof t) throw e;
                        if (0 === b.call(this, t)) throw e;
                    }
                }
            })), v = this.createConstructor(t);
            return e.$ = {
                get: function() {
                    if (l.call(this)) throw a.call(this);
                    return s.call(this);
                },
                set: w
            }, e[Me] = Ce(w), e[Ae] = i & d && this.defineVivificatorStruct(t), e[xe] = i & g && this.defineVisitorErrorUnion(n, l), 
            v;
        }
    }), Mn({
        defineFunction(t, n) {
            const {instance: {members: [r], template: i}} = t, {structure: {constructor: s}} = r, o = this, a = function(n) {
                const r = this instanceof a;
                let c;
                if (r) {
                    if (0 === arguments.length) throw new NoInitializer(t);
                    if ("function" != typeof n) throw new TypeMismatch("function", n);
                    if (s[Pt] === e.VariadicStruct || !a[me]) throw new Unsupported;
                    c = o.getFunctionThunk(n, a[me]);
                } else {
                    if (this !== se) throw new NoCastingToFunction;
                    c = n;
                }
                const l = s.prototype.length, u = r ? o.createInboundCaller(n, s) : o.createOutboundCaller(i, s);
                return _e(u, {
                    length: Ce(l),
                    name: Ce(r ? n.name : "")
                }), Object.setPrototypeOf(u, a.prototype), u[Ct] = c, u;
            };
            return Object.setPrototypeOf(a.prototype, Function.prototype), n.valueOf = n.toJSON = Ce(yn), 
            a;
        },
        finalizeFunction(t, e, n) {
            const {static: {template: r}} = t;
            e[me] = Ce(r), n[Symbol.toStringTag] = void 0;
        }
    }), Mn({
        defineOpaque(t, e) {
            const {purpose: n} = t, r = () => {
                throw new AccessingOpaque(t);
            }, i = this.createConstructor(t);
            return e.$ = {
                get: r,
                set: r
            }, e[Symbol.iterator] = n === o && this.defineZigIterator(), e[Symbol.toPrimitive] = {
                value(e) {
                    const {name: n} = t;
                    return `[opaque ${n}]`;
                }
            }, e[Me] = Ce((() => {
                throw new CreatingOpaque(t);
            })), i;
        }
    }), Mn({
        defineOptional(t, e) {
            const {instance: {members: [n, r]}, flags: i} = t, {get: s, set: o} = this.defineMember(n), {get: a, set: c} = this.defineMember(r), l = n.type === W.Void, {bitOffset: u, byteSize: f} = n, h = this.createInitializer((function(t, e) {
                on(t, p) ? (pn(this, t), i & g && a.call(this) && this[xe]("copy", at.Vivificate, t)) : null === t ? (c.call(this, 0), 
                i & U && gn(this[Ct], u >> 3, f), this[xe]?.("clear", at.IgnoreUncreated)) : (void 0 !== t || l) && (o.call(this, t, e), 
                i & U ? c.call(this, 1) : i & g && (a.call(this) || c.call(this, 13)));
            })), p = t.constructor = this.createConstructor(t);
            return e.$ = {
                get: function() {
                    return a.call(this) ? s.call(this) : (this[xe]?.("clear", at.IgnoreUncreated), null);
                },
                set: h
            }, e[Me] = Ce(h), e[Ae] = i & d && this.defineVivificatorStruct(t), e[xe] = i & g && this.defineVisitorOptional(n, a), 
            p;
        }
    }), Mn({
        definePointer(t, n) {
            const {flags: r, byteSize: i, instance: {members: [s]}} = t, {structure: o} = s, {type: a, flags: c, byteSize: l = 1} = o, u = r & k ? i / 2 : i, {get: f, set: d} = this.defineMember({
                type: W.Uint,
                bitOffset: 0,
                bitSize: 8 * u,
                byteSize: u,
                structure: {
                    byteSize: u
                }
            }), {get: g, set: p} = r & k ? this.defineMember({
                type: W.Uint,
                bitOffset: 8 * u,
                bitSize: 8 * u,
                byteSize: u,
                structure: {
                    flags: m.IsSize,
                    byteSize: u
                }
            }) : {}, b = function(t, n = !0, i = !0) {
                if (n || this[Ct][Lt]) {
                    if (!i) return this[Ft][0] = void 0;
                    {
                        const n = _.child, i = f.call(this), s = r & k ? g.call(this) : a === e.Slice && c & $ ? U.findSentinel(i, n[Gt].bytes) + 1 : 1;
                        if (i !== this[Qt] || s !== this[te]) {
                            const e = U.findMemory(t, i, s, n[ne]), o = e ? n.call(se, e) : null;
                            return this[Ft][0] = o, this[Qt] = i, this[te] = s, r & k && (this[Ht] = null), 
                            o;
                        }
                    }
                }
                return this[Ft][0];
            }, w = function(t) {
                d.call(this, t), this[Qt] = t;
            }, v = c & $ ? 1 : 0, S = r & k || c & $ ? function(t) {
                p?.call?.(this, t - v), this[te] = t;
            } : null, I = yr(t), A = yr(o, r & B), x = function(t = !0) {
                const e = !this[Ft][0], n = b.call(this, null, e);
                if (!n) {
                    if (r & T) return null;
                    throw new NullPointer;
                }
                return A && t ? pr(n, A) : n;
            }, E = c & h ? function() {
                return x.call(this).$;
            } : x, M = r & B ? Bn : function(t) {
                return x.call(this).$ = t;
            }, U = this, z = this.createInitializer((function(n, i, s) {
                const l = o.constructor;
                if (ei(n, l)) {
                    if (!(r & B) && n.constructor.const) throw new ConstantConstraint(t, n);
                    n = n[Ft][0];
                } else if (r & O) ni(n, l, r) && (n = l.call(se, n[Ft][0][Ct])); else if (a === e.Slice && c & F && n) if (n.constructor[Pt] === e.Pointer) n = n[qt]?.[Ct]; else if (n[Ct]) n = n[Ct]; else if (n?.buffer instanceof ArrayBuffer && !(n instanceof Uint8Array || n instanceof DataView)) {
                    const {byteOffset: t, byteLength: e} = n;
                    void 0 !== t && void 0 !== e && (n = new DataView(n.buffer, t, e));
                }
                if (n instanceof l) {
                    if ((s === nt.ReadOnly || n[we]) && !(r & B)) throw new ReadOnlyTarget(t);
                } else if (on(n, l)) n = l.call(se, n[Ct]); else if (r & V && r & O && n instanceof l.child) n = l.call(se, n[Ct]); else if (function(t, e) {
                    const n = t?.[Symbol.toStringTag];
                    if (n) {
                        const r = e[ue];
                        if (r) switch (n) {
                          case r.name:
                          case "DataView":
                            return !0;

                          case "ArrayBuffer":
                            return r === Uint8Array || r === Int8Array;

                          case "Uint8ClampedArray":
                            return r === Uint8Array;
                        }
                        if (e.child && void 0 !== nn(t, e.child)) return !0;
                    }
                    return !1;
                }(n, l)) {
                    const t = U.extractView(o, n);
                    n = l.call(se, t);
                } else if (null == n || n[Ct]) {
                    if (!(void 0 === n || r & T && null === n)) throw new InvalidPointerTarget(t, n);
                } else {
                    if (r & V && r & O && "object" == typeof n && !n[Symbol.iterator]) {
                        let t = !0;
                        const e = l.prototype[le];
                        for (const r of Object.keys(n)) {
                            const n = e[r];
                            if (n?.special) {
                                t = !1;
                                break;
                            }
                        }
                        t && (n = [ n ]);
                    }
                    if (ue in l && n?.buffer && n[Symbol.iterator]) throw new InvalidPointerTarget(t, n);
                    const e = n = new l(n, {
                        allocator: i
                    });
                    c & y && (n = mr(e).target);
                }
                const u = n?.[Ct]?.[Lt];
                if (u?.address === qe) throw new PreviouslyFreed(n);
                this[qt] = n;
            })), _ = this.createConstructor(t);
            return n["*"] = {
                get: E,
                set: M
            }, n.$ = {
                get: a === e.Pointer ? yn : function() {
                    return pr(this, I);
                },
                set: z
            }, n.length = {
                get: function() {
                    const t = x.call(this, !1);
                    return t ? t.length : 0;
                },
                set: function(t) {
                    t |= 0;
                    const e = x.call(this, !1);
                    if (!e) {
                        if (0 !== t) throw new InvalidSliceLength(t, 0);
                        return;
                    }
                    if (e.length === t) return;
                    const n = e[Ct], i = n[Lt];
                    let s;
                    if (!i) if (r & k) this[Ht] ||= e.length, s = this[Ht]; else {
                        s = (n.buffer.byteLength - n.byteOffset) / l | 0;
                    }
                    if (t < 0 || t > s) throw new InvalidSliceLength(t, s);
                    const a = t * l, c = i ? U.obtainZigView(i.address, a) : U.obtainView(n.buffer, n.byteOffset, a), u = o.constructor;
                    this[Ft][0] = u.call(se, c), S?.call?.(this, t);
                }
            }, n.slice = a === e.Slice && {
                value(t, e) {
                    const n = this[qt].slice(t, e);
                    return new _(n);
                }
            }, n.subarray = a === e.Slice && {
                value(t, e, n) {
                    const r = this[qt].subarray(t, e, n);
                    return new _(r);
                }
            }, n[Symbol.toPrimitive] = a === e.Primitive && {
                value(t) {
                    return this[qt][Symbol.toPrimitive](t);
                }
            }, n[Me] = Ce(z), n[ke] = a === e.Function && {
                value() {
                    const t = function(...e) {
                        return t["*"].call(this, ...e);
                    };
                    return t[Ct] = this[Ct], t[Ft] = this[Ft], Object.setPrototypeOf(t, _.prototype), 
                    t;
                }
            }, n[Oe] = I && {
                value() {
                    return pr(this, I);
                }
            }, n[be] = Ce(I), n[qt] = {
                get: x,
                set: function(t) {
                    if (void 0 !== t) {
                        if (t) {
                            const e = t[Ct][Lt];
                            if (e) {
                                const {address: n, js: r} = e;
                                w.call(this, n), S?.call?.(this, t.length), r && (t[Ct][Lt] = void 0);
                            } else if (this[Ct][Lt]) throw new ZigMemoryTargetRequired;
                        } else this[Ct][Lt] && (w.call(this, 0), S?.call?.(this, 0));
                        this[Ft][0] = t ?? null, r & k && (this[Ht] = null);
                    }
                }
            }, n[Se] = Ce(b), n[Xt] = {
                set: w
            }, n[Kt] = {
                set: S
            }, n[xe] = this.defineVisitor(), n[Qt] = Ce(0), n[te] = Ce(0), n[Ht] = r & k && Ce(null), 
            n.dataView = n.base64 = void 0, _;
        },
        finalizePointer(t, n) {
            const {flags: r, constructor: i, instance: {members: [s]}} = t, {structure: o} = s, {type: a, constructor: c} = o;
            n.child = c !== Object ? Ce(c) : {
                get: () => o.constructor
            }, n.const = Ce(!!(r & B)), n[Ve] = {
                value(n, s) {
                    if (this === se || this === jt || n instanceof i) return !1;
                    if (ei(n, c)) return new i(c(n["*"]), s);
                    if (ni(n, c, r)) return new i(n);
                    if (a === e.Slice) return new i(c(n), s);
                    throw new NoCastingToPointer(t);
                }
            };
        }
    }), Mn({
        definePrimitive(t, e) {
            const {instance: {members: [n]}} = t, r = this.createApplier(t), {get: i, set: s} = this.defineMember(n), o = function(e) {
                if (on(e, a)) pn(this, e); else if (e && "object" == typeof e) {
                    if (0 === r.call(this, e)) {
                        const r = je(n);
                        throw new InvalidInitializer(t, r, e);
                    }
                } else void 0 !== e && s.call(this, e);
            }, a = this.createConstructor(t);
            return e.$ = {
                get: i,
                set: o
            }, e[Me] = Ce(o), e[Symbol.toPrimitive] = Ce(i), a;
        },
        finalizePrimitive(t, e) {
            const {instance: {members: [n]}} = t;
            e[re] = Ce(n.bitSize), e[ae] = Ce(n.type);
        }
    }), Mn({
        defineSlice(t, e) {
            const {align: n, flags: r, instance: {members: [i]}} = t, {byteSize: s} = i, o = this, a = function(t, e, r) {
                t || (t = o.allocateMemory(e * s, n, r)), this[Ct] = t, this[Kt] = e;
            }, c = function(e, n) {
                if (n !== this[Kt]) throw new ArrayLengthMismatch(t, this, e);
            }, l = this.defineMember(i), {set: u} = l, f = this.createApplier(t), h = this.createInitializer((function(e, n) {
                if (on(e, y)) this[Ct] ? c.call(this, e, e.length) : a.call(this, null, e.length, n), 
                pn(this, e), r & g && this[xe]("copy", at.Vivificate, e); else if ("string" == typeof e && r & z) h.call(this, {
                    string: e
                }, n); else if (e?.[Symbol.iterator]) {
                    e = en(e), this[Ct] ? c.call(this, e, e.length) : a.call(this, null, e.length, n);
                    let t = 0;
                    for (const r of e) y[Gt]?.validateValue(r, t, e.length), u.call(this, t++, r, n);
                } else if ("number" == typeof e) {
                    if (!(!this[Ct] && e >= 0 && isFinite(e))) throw new InvalidArrayInitializer(t, e, !this[Ct]);
                    a.call(this, null, e, n);
                } else if (e && "object" == typeof e) {
                    if (0 === f.call(this, e, n)) throw new InvalidArrayInitializer(t, e);
                } else if (void 0 !== e) throw new InvalidArrayInitializer(t, e);
            })), p = function(t, e) {
                const n = this[Kt], r = this[Ct];
                t = void 0 === t ? 0 : ii(t, n), e = void 0 === e ? n : ii(e, n);
                const i = t * s, a = e * s - i;
                return o.obtainView(r.buffer, r.byteOffset + i, a);
            }, y = this.createConstructor(t);
            return e.$ = {
                get: function() {
                    return pr(this, nt.Slice);
                },
                set: h
            }, e.length = {
                get: ri
            }, r & _ && (e.typedArray = this.defineTypedArray(t), r & z && (e.string = this.defineString(t)), 
            r & C && (e.clampedArray = this.defineClampedArray(t))), e.entries = e[Jt] = this.defineArrayEntries(), 
            e.subarray = {
                value(t, e) {
                    const n = p.call(this, t, e);
                    return y(n);
                }
            }, e.slice = {
                value(t, e, r = {}) {
                    const {zig: i = !1} = r, s = p.call(this, t, e), a = o.allocateMemory(s.byteLength, n, i), c = y(a);
                    return dn(a, s), c;
                }
            }, e[Symbol.iterator] = this.defineArrayIterator(), e[Ee] = Ce(a), e[Me] = Ce(h), 
            e[ke] = this.defineFinalizerArray(l), e[Ae] = r & d && this.defineVivificatorArray(t), 
            e[xe] = r & g && this.defineVisitorArray(), e[Oe] = {
                value() {
                    return pr(this, nt.Slice);
                }
            }, e[be] = Ce(nt.Slice), y;
        },
        finalizeSlice(t, e) {
            const {flags: n, instance: {members: [r]}} = t;
            e.child = Ce(r.structure.constructor), e[Gt] = n & $ && this.defineSentinel(t);
        }
    }), Mn({
        defineVivificatorStruct(t) {
            const {instance: {members: e}} = t, n = {};
            for (const t of e.filter((t => t.type === W.Object))) n[t.slot] = t;
            const r = this;
            return {
                value(t) {
                    const e = n[t], {bitOffset: i, byteSize: s, structure: {constructor: o}} = e, a = this[Ct], c = a.byteOffset + (i >> 3);
                    let l = s;
                    if (void 0 === l) {
                        if (7 & i) throw new NotOnByteBoundary(e);
                        l = e.bitSize >> 3;
                    }
                    const u = r.obtainView(a.buffer, c, l, !a[ve]);
                    return this[Ft][t] = o.call(jt, u);
                }
            };
        }
    }), Mn({
        defineStruct(t, e) {
            const {purpose: n, flags: r, length: i, instance: {members: a}} = t, c = a.find((t => t.flags & X)), l = c && this.defineMember(c), u = this.createApplier(t), f = this.createInitializer((function(e, n) {
                if (on(e, h)) pn(this, e), r & g && this[xe]("copy", 0, e); else if (e && "object" == typeof e) u.call(this, e, n); else if ("number" != typeof e && "bigint" != typeof e || !l) {
                    if (void 0 !== e) throw new InvalidInitializer(t, "object", e);
                } else l.set.call(this, e);
            })), h = this.createConstructor(t), p = e[le].value, y = e[Yt].value, m = [];
            for (const t of a.filter((t => !!t.name))) {
                const {name: n, flags: r} = t, {set: i} = e[n] = this.defineMember(t);
                i && (r & G && (i.required = !0), p[n] = i, y.push(n)), m.push(n);
            }
            return e.$ = {
                get: yn,
                set: f
            }, e.length = Ce(i), e.entries = r & I.IsTuple && this.defineVectorEntries(), e[Symbol.toPrimitive] = l && {
                value(t) {
                    return "string" === t ? Object.prototype.toString.call(this) : l.get.call(this);
                }
            }, e[Symbol.iterator] = n === o ? this.defineZigIterator() : r & I.IsTuple ? this.defineVectorIterator() : this.defineStructIterator(), 
            e[Me] = Ce(f), e[Ae] = r & d && this.defineVivificatorStruct(t), e[xe] = r & g && this.defineVisitorStruct(a), 
            e[Jt] = r & I.IsTuple ? this.defineVectorEntries() : this.defineStructEntries(), 
            e[Zt] = Ce(m), n === s && (e.alloc = this.defineAlloc(), e.free = this.defineFree(), 
            e.dupe = this.defineDupe()), h;
        }
    }), Mn({
        defineUnion(t, e) {
            const {purpose: n, flags: r, instance: {members: i}} = t, s = !!(r & A), a = s ? i.slice(0, -1) : i, c = s ? i[i.length - 1] : null, {get: l, set: u} = this.defineMember(c), {get: f} = this.defineMember(c, !1), h = r & x ? function() {
                return l.call(this)[Rt];
            } : function() {
                const t = l.call(this);
                return a[t].name;
            }, p = r & x ? function(t) {
                const {constructor: e} = c.structure;
                u.call(this, e[t]);
            } : function(t) {
                const e = a.findIndex((e => e.name === t));
                u.call(this, e);
            }, y = this.createApplier(t), m = this.createInitializer((function(e, n) {
                if (on(e, b)) pn(this, e), r & g && this[xe]("copy", at.Vivificate, e); else if (e && "object" == typeof e) {
                    let r = 0;
                    for (const t of I) t in e && r++;
                    if (r > 1) throw new MultipleUnionInitializers(t);
                    if (0 === y.call(this, e, n)) throw new MissingUnionInitializer(t, e, s);
                } else if (void 0 !== e) throw new InvalidInitializer(t, "object with a single property", e);
            })), b = this.createConstructor(t), w = {}, v = e[le].value, S = e[Yt].value, I = [];
            for (const n of a) {
                const {name: i} = n, {get: o, set: a} = this.defineMember(n), c = s ? function() {
                    const e = h.call(this);
                    if (i !== e) {
                        if (r & x) return null;
                        throw new InactiveUnionProperty(t, i, e);
                    }
                    return o.call(this);
                } : o, l = s && a ? function(e) {
                    const n = h.call(this);
                    if (i !== n) throw new InactiveUnionProperty(t, i, n);
                    a.call(this, e);
                } : a, u = s && a ? function(t) {
                    p.call(this, i), this[xe]?.("clear", at.IgnoreUncreated), a.call(this, t);
                } : a;
                e[i] = {
                    get: c,
                    set: l
                }, v[i] = u, w[i] = o, S.push(i), I.push(i);
            }
            e.$ = {
                get: function() {
                    return this;
                },
                set: m
            }, e[Symbol.iterator] = n === o ? this.defineZigIterator() : this.defineUnionIterator(), 
            e[Symbol.toPrimitive] = r & x && {
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
            return e[Ue] = r & E && {
                value() {
                    return M || this[xe](oi), this[xe] = bn, this;
                }
            }, e[Me] = Ce(m), e[Wt] = r & x && {
                get: l,
                set: u
            }, e[Ae] = r & d && this.defineVivificatorStruct(t), e[xe] = r & g && this.defineVisitorUnion(a, r & x ? f : null), 
            e[Jt] = this.defineUnionEntries(), e[Zt] = r & x ? {
                get() {
                    return [ h.call(this) ];
                }
            } : Ce(I), e[ce] = Ce(w), b;
        },
        finalizeUnion(t, e) {
            const {flags: n, instance: {members: r}} = t;
            n & x && (e.tag = Ce(r[r.length - 1].structure.constructor));
        }
    }), Mn({
        defineVariadicStruct(t, e) {
            const {byteSize: n, align: r, flags: i, length: s, instance: {members: o}} = t, a = this, c = o.slice(1);
            for (const t of o) e[t.name] = this.defineMember(t);
            const l = e.retval.set, u = function(t) {
                this[Ct] = a.allocateMemory(8 * t, 4), this.length = t, this.littleEndian = a.littleEndian;
            };
            return _e(u, {
                [ie]: {
                    value: 4
                }
            }), _e(u.prototype, {
                set: Ce((function(t, e, n, r, i) {
                    const s = this[Ct], o = a.littleEndian;
                    s.setUint16(8 * t, e, o), s.setUint16(8 * t + 2, n, o), s.setUint16(8 * t + 4, r, o), 
                    s.setUint8(8 * t + 6, i == W.Float), s.setUint8(8 * t + 7, i == W.Int || i == W.Float);
                }))
            }), e[Ae] = i & d && this.defineVivificatorStruct(t), e[xe] = this.defineVisitorVariadicStruct(o), 
            e[Be] = Ce((function(t) {
                l.call(this, t, this[ge]);
            })), function(t) {
                if (t.length < s) throw new ArgumentCountMismatch(s, t.length, !0);
                let e = n, i = r;
                const o = t.slice(s), l = {};
                for (const [t, n] of o.entries()) {
                    const r = n?.[Ct], o = n?.constructor?.[ie];
                    if (!r || !o) {
                        throw On(new InvalidVariadicArgument, s + t);
                    }
                    o > i && (i = o);
                    e = (l[t] = e + (o - 1) & ~(o - 1)) + r.byteLength;
                }
                const f = new u(t.length), h = a.allocateMemory(e, i);
                h[ie] = i, this[Ct] = h, this[Ft] = {}, a.copyArguments(this, t, c);
                let d = -1;
                for (const [t, {bitOffset: e, bitSize: n, type: r, slot: i, structure: {align: s}}] of c.entries()) f.set(t, e >> 3, n, s, r), 
                i > d && (d = i);
                for (const [t, e] of o.entries()) {
                    const n = d + t + 1, {byteLength: r} = e[Ct], i = l[t], o = a.obtainView(h.buffer, i, r), c = this[Ft][n] = e.constructor.call(jt, o), u = e.constructor[re] ?? 8 * r, g = e.constructor[ie], p = e.constructor[ae];
                    c.$ = e, f.set(s + t, i, u, g, p);
                }
                this[oe] = f;
            };
        },
        finalizeVariadicStruct(t, e) {
            const {flags: n} = t;
            e[fe] = Ce(!!(n & N)), e[ie] = Ce(void 0);
        }
    }), Mn({
        defineVector(t, e) {
            const {flags: n, length: r, instance: {members: [i]}} = t, s = this.createApplier(t), o = this.createInitializer((function(e) {
                if (on(e, a)) pn(this, e), n & g && this[xe]("copy", at.Vivificate, e); else if (e?.[Symbol.iterator]) {
                    let n = e.length;
                    if ("number" != typeof n && (n = (e = [ ...e ]).length), n !== r) throw new ArrayLengthMismatch(t, this, e);
                    let i = 0;
                    for (const t of e) this[i++] = t;
                } else if (e && "object" == typeof e) {
                    if (0 === s.call(this, e)) throw new InvalidArrayInitializer(t, e);
                } else if (void 0 !== e) throw new InvalidArrayInitializer(t, e);
            })), a = this.createConstructor(t), {bitSize: c} = i;
            for (let t = 0, s = 0; t < r; t++, s += c) e[t] = n & g ? this.defineMember({
                ...i,
                slot: t
            }) : this.defineMember({
                ...i,
                bitOffset: s
            });
            return e.$ = {
                get: yn,
                set: o
            }, e.length = Ce(r), n & L && (e.typedArray = this.defineTypedArray(t), n & R && (e.clampedArray = this.defineClampedArray(t))), 
            e.entries = e[Jt] = this.defineVectorEntries(), e[Symbol.iterator] = this.defineVectorIterator(), 
            e[Me] = Ce(o), e[Ae] = n & d && this.defineVivificatorArray(t), e[xe] = n & g && this.defineVisitorArray(), 
            a;
        },
        finalizeVector(t, e) {
            const {instance: {members: [n]}} = t;
            e.child = Ce(n.structure.constructor);
        }
    }), Mn({
        fdLockGet(t, e, n) {
            const r = this.littleEndian;
            return $n(n, lt, (() => {
                const [n] = this.getStream(t);
                if (an(n, "getlock")) {
                    const t = hn(24);
                    this.moveExternBytes(t, e, !1);
                    const i = t.getUint16(0, r), s = t.getUint16(2, r), o = t.getUint32(4, r), a = Xe(t.getBigInt64(8, r)), c = Xe(t.getBigUint64(16, r));
                    return n.getlock({
                        type: i,
                        whence: s,
                        start: a,
                        length: c,
                        pid: o
                    });
                }
            }), (t => {
                let n;
                t ? (n = hn(24), n.setUint16(0, t.type ?? 0, r), n.setUint16(2, t.whence ?? 0, r), 
                n.setUint32(4, t.pid ?? 0, r), n.setBigInt64(8, BigInt(t.start ?? 0), r), n.setBigUint64(16, BigInt(t.length ?? 0), r)) : (n = hn(2), 
                n.setUint16(0, 2, r)), this.moveExternBytes(n, e, !0);
            }));
        },
        exports: {
            fdLockGet: {
                async: !0
            }
        }
    }), Mn({
        fdLockSet(t, e, n, r) {
            const i = this.littleEndian;
            return $n(r, ut, (() => {
                const [r] = this.getStream(t);
                if (an(r, "setlock")) {
                    const t = hn(24);
                    this.moveExternBytes(t, e, !1);
                    const s = t.getUint16(0, i), o = t.getUint16(2, i), a = t.getUint32(4, i), c = Xe(t.getBigUint64(8, i)), l = Xe(t.getBigUint64(16, i));
                    return r.setlock({
                        type: s,
                        whence: o,
                        start: c,
                        len: l,
                        pid: a
                    }, n);
                }
                return !0;
            }), (t => Cn(t, ut)));
        },
        exports: {
            fdLockSet: {
                async: !0
            }
        }
    }), Mn({
        defineVisitor: () => ({
            value(t, e, n) {
                let r;
                r = "string" == typeof t ? ci[t] : t, r.call(this, e, n);
            }
        })
    });
    const ci = {
        copy(t, e) {
            const n = e[Ft][0];
            if (this[Ct][Lt] && n && !n[Ct][Lt]) throw new ZigMemoryTargetRequired;
            this[Ft][0] = n;
        },
        clear(t) {
            t & at.IsInactive && (this[Ft][0] = void 0);
        },
        reset() {
            this[Ft][0] = void 0, this[Qt] = void 0;
        }
    };
    return Mn({
        defineVisitorArgStruct(t) {
            const e = [];
            let n;
            for (const [r, {slot: i, structure: s}] of t.entries()) s.flags & g && (0 === r ? n = i : e.push(i));
            return {
                value(t, r, i) {
                    if (!(r & at.IgnoreArguments) && e.length > 0) for (const n of e) ai.call(this, n, t, r | at.IsImmutable, i);
                    r & at.IgnoreRetval || void 0 === n || ai.call(this, n, t, r, i);
                }
            };
        }
    }), Mn({
        defineVisitorArray: () => ({
            value(t, e, n) {
                for (let r = 0, i = this.length; r < i; r++) ai.call(this, r, t, e, n);
            }
        })
    }), Mn({
        defineVisitorErrorUnion(t, e) {
            const {slot: n} = t;
            return {
                value(t, r, i) {
                    e.call(this) && (r |= at.IsInactive), r & at.IsInactive && r & at.IgnoreInactive || ai.call(this, n, t, r, i);
                }
            };
        }
    }), Mn({
        defineVisitorOptional(t, e) {
            const {slot: n} = t;
            return {
                value(t, r, i) {
                    e.call(this) || (r |= at.IsInactive), r & at.IsInactive && r & at.IgnoreInactive || ai.call(this, n, t, r, i);
                }
            };
        }
    }), Mn({
        defineVisitorStruct(t) {
            const e = t.filter((t => t.structure?.flags & g)).map((t => t.slot));
            return {
                value(t, n, r) {
                    for (const i of e) ai.call(this, i, t, n, r);
                }
            };
        }
    }), Mn({
        defineVisitorUnion(t, e) {
            const n = [];
            for (const [e, {slot: r, structure: i}] of t.entries()) i?.flags & g && n.push({
                index: e,
                slot: r
            });
            return {
                value(t, r, i) {
                    const s = e?.call(this);
                    for (const {index: e, slot: o} of n) {
                        let n = r;
                        e !== s && (n |= at.IsInactive), n & at.IsInactive && n & at.IgnoreInactive || ai.call(this, o, t, n, i);
                    }
                }
            };
        }
    }), Mn({
        defineVisitorVariadicStruct(t) {
            const e = t[0], n = e.structure.flags & g ? e.slot : void 0;
            return {
                value(t, e, r) {
                    if (!(e & at.IgnoreArguments)) for (const [i, s] of Object.entries(this[Ft])) i !== n && xe in s && ai.call(this, i, t, e | at.IsImmutable, r);
                    e & at.IgnoreRetval || void 0 === n || ai.call(this, n, t, e, r);
                }
            };
        }
    }), t.createEnvironment = function() {
        try {
            return new (Un());
        } catch (t) {
            throw console.error(t), t;
        }
    }, t;
}({}))
