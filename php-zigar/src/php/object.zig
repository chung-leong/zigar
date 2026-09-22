pub const std = @import("std");

const php = @import("root.zig");
const Array = php.Array;
const c = php.c;
const pi = php.imports;
const deref = php.deref;
const ClassEntry = php.ClassEntry;
const efree = php.efree;
const failure = php.failure;
const unsupported = failure.unsupported;
const Function = php.Function;
const String = php.String;
const Value = php.Value;

pub const Object = struct {
    pub fn create(ce: *const ClassEntry, params: []const Value) !*@This() {
        var zval: c.zval = undefined;
        const result = pi.object_init_ex(&zval, @ptrCast(@constCast(ce)));
        if (result != c.SUCCESS) return error.CannotCreateObject;
        const zobj = zval.value.obj;
        const handlers = zobj.*.handlers;
        const handler = handlers.*.get_constructor;
        const ctor = handler.?(zobj);
        if (ctor) |f| {
            const zparams: [*]c.zval = @ptrCast(@constCast(params.ptr));
            const len: u32 = @truncate(params.len);
            switch (@hasDecl(c, "zend_call_known_function_ex")) {
                true => pi.zend_call_known_function_ex(f, zobj, zobj.*.ce, null, len, zparams, null, 0),
                false => pi.zend_call_known_function(f, zobj, zobj.*.ce, null, len, zparams, null),
            }
        }
        return @ptrCast(zobj);
    }

    pub fn createFromName(name: anytype, params: []const Value) !*@This() {
        const ce = ClassEntry.find(name) orelse return error.ClassNotFound;
        return .create(ce, params);
    }

    pub fn retain(self: *@This()) *@This() {
        self.addRef();
        return self;
    }

    pub fn addRef(self: *@This()) void {
        self.impl.gc.refcount += 1;
    }

    pub fn release(self: *@This()) void {
        const zobj = &self.impl;
        pi.zend_object_release(zobj);
    }

    pub fn subtractRef(self: *@This()) void {
        self.impl.gc.refcount -= 1;
    }

    pub fn toValue(self: *const @This()) Value {
        return .fromObject(self);
    }

    pub fn isInstanceOf(self: *const @This(), ce: *const ClassEntry) bool {
        const zobj = &self.impl;
        const zce: *const c.zend_class_entry = @ptrCast(ce);
        return (zobj.ce == zce) or pi.instanceof_function_slow(zobj.ce, zce);
    }

    pub fn hasStandardInterface(self: *const @This(), iface: ClassEntry.StandardInterface) bool {
        return self.isInstanceOf(iface.get());
    }

    pub fn hasElement(self: *const @This(), key: anytype) !bool {
        const zobj = @constCast(&self.impl);
        const k: Value = .createFromAny(key);
        defer k.release();
        var value: Value = undefined;
        const std_handlers = standardHandlers();
        const handlers = zobj.handlers.?;
        const handler = handlers.read_dimension orelse return error.NoArrayAccess;
        if (std_handlers.read_dimension == handler) {
            if (zobj.ce.*.arrayaccess_funcs_ptr == null) return error.NoArrayAccess;
        }
        const rv = handler(zobj, @ptrCast(k.value), c.BP_VAR_IS, &value);
        return rv != null;
    }

    pub fn getElement(self: *const @This(), key: anytype) !Value {
        const zobj = @constCast(&self.impl);
        const k: Key = .createFromAny(key);
        defer k.release();
        var value: Value = undefined;
        const std_handlers = standardHandlers();
        const handlers = zobj.handlers.?;
        const handler = handlers.read_dimension orelse return error.NoArrayAccess;
        if (std_handlers.read_dimension == handler) {
            if (zobj.ce.*.arrayaccess_funcs_ptr == null) return error.NoArrayAccess;
        }
        const zk: *c.zval = @ptrCast(&k.value);
        const rv = handler(zobj, zk, c.BP_VAR_R, &value);
        if (rv == null) return error.Missing;
        return rv.*;
    }

    pub fn getProperty(self: *const @This(), name: anytype) !Value {
        const zobj = @constCast(&self.impl);
        const n: *String = .createFromAny(name);
        defer n.release();
        var value: Value = undefined;
        const zn: *c.zend_string = @ptrCast(n);
        const zval: *c.zval = @ptrCast(&value);
        const result = pi.zend_read_property_ex(zobj.ce, zobj, zn, true, zval);
        if (result != c.SUCCESS) return error.Missing;
        return value;
    }

    pub fn getProperties(self: *const @This()) *Array {
        var value = self.toValue();
        const zval: *c.zval = @ptrCast(&value);
        const ht = pi.zend_get_properties_for(zval, c.ZEND_PROP_PURPOSE_ARRAY_CAST).?;
        return @ptrCast(ht);
    }

    pub fn standardHandlers() *const Handlers {
        return deref(&pi.std_object_handlers).?;
    }

    pub fn MethodCallCache(comptime names: anytype) type {
        const Entries = init: {
            var field_names: [names.len][]const u8 = undefined;
            var field_types: [names.len]type = undefined;
            var field_attrs: [names.len]std.lang.Type.Struct.FieldAttributes = undefined;
            inline for (names, 0..) |name, i| {
                field_names[i] = @tagName(name);
                field_types[i] = Function.CallCache;
                field_attrs[i] = .{};
            }
            break :init @Struct(.auto, null, &field_names, &field_types, &field_attrs);
        };
        return struct {
            pub fn init(context: Value) !@This() {
                var entries: Entries = undefined;
                const field_names = comptime std.meta.fieldNames(Entries);
                var init_count: usize = 0;
                errdefer {
                    inline for (0..field_names.len) |i| {
                        if (i == init_count) break;
                        @field(entries, field_names[i]).deinit();
                    }
                }
                var arr: *Array = .create();
                defer arr.release();
                arr.set(0, context);
                inline for (field_names) |field_name| {
                    const name: Value = .fromString(.static(field_name));
                    arr.set(1, name);
                    @field(entries, field_name) = try .init(arr.toValue());
                    init_count += 1;
                }
                return .{ .method = entries };
            }

            pub fn deinit(self: *@This()) void {
                const field_names = comptime std.meta.fieldNames(Entries);
                inline for (field_names) |field_name| @field(self.method, field_name).deinit();
            }

            method: Entries,
        };
    }
    pub const Handlers = c.zend_object_handlers;
    const Key = struct {
        pub fn createFromAny(arg: anytype) @This() {
            const AT = @TypeOf(arg);
            return switch (@typeInfo(AT)) {
                .int, .comptime_int => .{ .value = .fromInteger(@intCast(arg)) },
                else => .{ .value = .fromString(.createFromAny(arg)) },
            };
        }

        pub fn release(self: @This()) void {
            self.value.release();
        }

        value: Value,
    };

    impl: c.zend_object,
};
