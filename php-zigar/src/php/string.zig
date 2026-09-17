pub const std = @import("std");

const c = @import("c.zig");
const pd = c.declarations;
const pi = c.imports;
const deref = c.deref;
const castTo = c.castTo;
const emalloc = @import("allocator.zig").emalloc;
const unsupported = @import("failure.zig").unsupported;
const Value = @import("value.zig").Value;

pub const String = struct {
    pub fn slice(self: *const @This()) [:0]const u8 {
        const s: [*]const u8 = @ptrCast(&self.impl.val[0]);
        const len = self.impl.len;
        return @ptrCast(s[0..len]);
    }

    pub fn length(self: *const @This()) usize {
        return self.impl.len;
    }

    pub fn isInterned(self: *const @This()) bool {
        return (self.impl.gc.u.type_info & pd.IS_STR_INTERNED) != 0;
    }

    pub fn create(s: []const u8) *@This() {
        return switch (s.len) {
            0 => castTo(@This(), deref(pi.zend_empty_string)),
            1 => castTo(@This(), deref(pi.zend_one_char_string)[s[0]]),
            else => create: {
                const ns = createUnitialized(s.len);
                if (s.len > 0) {
                    const new_slice = ns.slice();
                    @memcpy(new_slice, s);
                    new_slice.ptr[s.len] = '\x00';
                }
                break :create ns;
            },
        };
    }

    pub fn createUnitialized(len: usize) *@This() {
        return switch (len) {
            0 => castTo(@This(), deref(pi.zend_empty_string)),
            else => create: {
                const struct_size = @offsetOf(String, "val") + len + 1;
                const aligned_size = std.mem.alignForward(usize, struct_size, c.ZEND_MM_ALIGNMENT);
                const zs: *String = @ptrCast(@alignCast(emalloc(aligned_size, @src())));
                zs.* = .{
                    .gc = .{ .refcount = 1, .u = .{ .type_info = c.GC_STRING } },
                    .h = 0,
                    .len = len,
                };
                break :create zs;
            },
        };
    }

    pub fn createInterned(s: []const u8) *String {
        const zend_string_init_interned = deref(pi.zend_string_init_interned);
        const zstr = zend_string_init_interned.?(s.ptr, s.len, false);
        return castTo(@This(), zstr);
    }

    pub fn createFromAny(arg: anytype) @This() {
        const AT = @TypeOf(arg);
        return switch (@typeInfo(AT)) {
            .pointer => |pt| switch (pt.child) {
                String => arg.reuse(),
                u8 => switch (pt.size) {
                    .slice => create(arg),
                    .c, .many => create(std.mem.sliceTo(arg, 0)),
                    else => unsupported(AT),
                },
                else => switch (@typeInfo(pt.child)) {
                    .array => |ar| switch (ar.child) {
                        u8 => create(&arg),
                        else => unsupported(AT),
                    },
                    else => unsupported(AT),
                },
            },
            .@"struct" => switch (AT) {
                Value => arg.stringify(),
            },
            else => unsupported(AT),
        };
    }

    pub fn reuse(self: *@This()) *@This() {
        self.addRef();
        return self;
    }

    pub fn addRef(self: *@This()) void {
        self.impl.gc.refcount += 1;
    }

    pub fn release(self: *@This()) void {
        const zstr = &self.impl;
        pi.zend_string_release(zstr);
    }

    pub fn subtractRef(self: *@This()) void {
        self.impl.gc.refcount -= 1;
    }

    pub fn match(self: *const @This(), s2: *const @This()) bool {
        return self.matchSlice(s2.slice());
    }

    pub fn matchSlice(self: *const @This(), s2: []const u8) bool {
        return std.mem.eql(u8, self.slice(), s2);
    }

    pub fn toValue(self: *const @This()) Value {
        return .fromString(self);
    }

    pub fn toNumeric(self: *const @This()) !union(enum) {
        integer: c_long,
        float: f64,
    } {
        const s = self.slice();
        var long: c_long = undefined;
        var double: f64 = undefined;
        const result = if (s[0] > '9')
            pd.IS_UNDEF
        else
            pi._is_numeric_string_ex(s.ptr, s.len, &long, &double, false, null, null);
        return switch (result) {
            pd.IS_LONG => .{ .integer = long },
            pd.IS_DOUBLE => .{ .float = double },
            else => error.NotNumeric,
        };
    }

    pub fn parseBoolean(self: *const @This()) bool {
        const zstr = @constCast(&self.impl);
        return pi.zend_ini_parse_bool(zstr);
    }

    pub fn parseInteger(self: *const @This()) c_long {
        const s = &self.slice();
        return pi.zend_atol(s.ptr, s.len);
    }

    pub fn static(comptime s: []const u8) *@This() {
        const ns = struct {
            // need to use var since PHP will try to set additional flags
            var str: StringWithLength(s.len) = .{
                .gc = .{
                    .refcount = 0,
                    .u = .{
                        .type_info = pd.IS_STRING | pd.IS_STR_PERMANENT | pd.IS_STR_INTERNED | pd.GC_NOT_COLLECTABLE,
                    },
                },
                .h = calculateHash(s),
                .val = init: {
                    const len = s.len;
                    var buf: [len + 1]u8 = undefined;
                    @memcpy(buf[0..len], s);
                    buf[len] = 0;
                    break :init buf;
                },
            };
        };
        return @ptrCast(@constCast(&ns.str));
    }

    pub fn calculateHash(s: []const u8) c_ulong {
        if (@inComptime()) {
            // we can't use the function from PHP at comptime because it uses memcpy() when the target is ARM64
            var hash: c_ulong = 5381;
            for (s) |char| hash = hash *% 33 +% char;
            hash |= switch (@sizeOf(c_ulong)) {
                8 => 0x8000000000000000,
                4 => 0x80000000,
                else => unreachable,
            };
            return hash;
        } else {
            return pi.zend_inline_hash_func(s.ptr, s.len);
        }
    }

    fn StringWithLength(comptime len: usize) type {
        return extern struct {
            gc: pd.zend_refcounted_h = undefined,
            h: pd.zend_ulong = undefined,
            len: usize = len,
            val: [len + 1]u8 = undefined,
        };
    }

    impl: pd.zend_string,
};
