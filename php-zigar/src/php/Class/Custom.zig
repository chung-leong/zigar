const std = @import("std");

const php = @import("../root.zig");
const c = php.c;
const deref = php.deref;
const pi = php.imports;
const php_al = php.allocator;
const Array = php.Array;
const Allocator = php.Allocator;
const Class = php.Class;
const failure = php.failure;
const Function = php.Function;
const Object = php.Object;
const String = php.String;
const Value = php.Value;
const ReturnType = php.util.ReturnType;

pub fn @"fn"(comptime T: type) type {
    const decl_names = std.meta.declarations(T);
    return struct {
        pub fn name(self: *const @This()) *String {
            return self.class.name();
        }

        pub fn parent(self: *const @This()) *Class {
            return self.class.parent();
        }

        pub fn flags(self: *const @This()) Class.Flags {
            return self.class.flags();
        }

        pub fn create(class_name: *String, parent_class: ?*Class) !*@This() {
            const self = php_al.create(@This()) catch unreachable;
            errdefer php_al.destroy(self);
            self.* = try init(class_name, parent_class);
            return self;
        }

        pub fn addRef(self: *@This()) void {
            self.class.impl.refcount += 1;
        }

        pub fn release(self: *@This()) void {
            self.class.impl.refcount -= 1;
            if (self.class.impl.refcount == 0) {
                php_al.destroy(self);
            }
        }

        pub fn register(self: *@This()) !void {
            const cg = php.globals("compiler");
            const list: *Array = @ptrCast(cg.class_table);
            const lc_name = self.name().duplicateLowerCase();
            defer lc_name.release();
            if (list.has(lc_name)) return error.NameConflict;
            list.set(lc_name, .fromPointer(&self.class.impl));
            self.addRef();
        }

        pub fn unregister(self: *@This()) void {
            const cg = php.globals("compiler");
            const list: *Array = @ptrCast(cg.class_table);
            const lc_name = self.name().duplicateLowerCase();
            defer lc_name.release();
            list.delete(lc_name);
            self.release();
        }

        pub fn createObject(class: *Class) callconv(.c) ?*Object {
            _ = class;
            const result = Instance.create(.{});
            const custom_obj = switch (@typeInfo(@TypeOf(result))) {
                .error_union => result catch |err| {
                    failure.throw(err);
                    return null;
                },
                else => result,
            };
            return &custom_obj.object;
        }

        pub fn getIterator(class: *Class, this: *Value, by_ref: c_int) callconv(.c) ?*Object.Iterator {
            _ = class;
            _ = by_ref;
            const result = Instance.getIterator(this.object());
            return failure.inspect(result, null);
        }

        pub fn getMethod(class: *Class, method_name: *String) callconv(.c) ?*const Function {
            const self: *@This() = @ptrCast(class);
            if (methods.find(method_name)) |func| return func;
            if (!@hasDecl(T, "getStaticMethod")) {
                failure.throw(error.UndefinedMethod);
                return null;
            }
            const result = self.custom.getStaticMethod(&self.custom, method_name);
            return failure.inspect(result, null);
        }

        fn init(class_name: *String, parent_class: ?*Class) !@This() {
            // determine what interfaces the class supports based on implementation of certain methods
            const interfaces = init: {
                const has_array_access = @hasDecl(T, "readDimension") or @hasDecl(T, "writeDimension");
                const has_countable = @hasDecl(T, "countDimension");
                const has_traversable = Instance.has_iterator;
                comptime var count: usize = 0;
                if (has_array_access) count += 1;
                if (has_countable) count += 1;
                if (has_traversable) count += 1;
                var interfaces: [count]*const Class = undefined;
                comptime var i: usize = 0;
                if (has_array_access) {
                    interfaces[i] = .interface(.array_access);
                    i += 1;
                }
                if (has_countable) {
                    interfaces[i] = .interface(.countable);
                    i += 1;
                }
                if (has_traversable) {
                    interfaces[i] = .interface(.traversable);
                    i += 1;
                }
                break :init &interfaces;
            };
            var self: @This() = undefined;
            const class_flags: Class.Flags = .{
                .linked = true,
                .no_dynamic_properties = true,
                .resolved_interfaces = true,
                .resolved_parent = true,
                .not_serializable = !@hasDecl(T, "serialize"),
                .abstract = decl_names.len == 0,
            };
            const class_pce = parent_class orelse Class.builtin(.standard);
            const zce = &self.class.impl;
            zce.* = .{};
            zce.type = c.ZEND_INTERNAL_CLASS;
            zce.refcount = 1;
            zce.name = @ptrCast(class_name);
            zce.ce_flags = @bitCast(class_flags);
            zce.num_interfaces = @intCast(interfaces.len);
            zce.unnamed_0.parent = @ptrCast(@constCast(class_pce));
            zce.unnamed_1.create_object = @ptrCast(&createObject);
            zce.get_iterator = @ptrCast(&getIterator);
            zce.get_static_method = @ptrCast(&getMethod);
            zce.unnamed_2.interfaces = switch (interfaces.len) {
                0 => null,
                else => @ptrCast(@constCast(&interfaces)),
            };
            pi._zend_hash_init(&zce.properties_info, c.HT_MIN_SIZE, null, false);
            pi._zend_hash_init(&zce.constants_table, c.HT_MIN_SIZE, null, false);
            pi._zend_hash_init(&zce.function_table, c.HT_MIN_SIZE, deref(&pi.zend_function_dtor), false);
            self.custom = switch (@hasDecl(T, "staitcInit")) {
                true => switch (@typeInfo(ReturnType(@TypeOf(T.staitcInit)))) {
                    .error_union => try .staitcInit(),
                    else => .staitcInit(),
                },
                false => if (Static == void) {} else .{},
            };
            return self;
        }

        pub const Static = init: {
            var S: ?type = null;
            for (decl_names) |decl_name| {
                if (getMethodName(decl_name) orelse getGetterName(decl_name) orelse getSetterName(decl_name)) |_| {
                    const Decl = @TypeOf(@field(T, decl_name));
                    const New = switch (@typeInfo(Decl)) {
                        .pointer => |pt| pt.child,
                        else => @compileError("Self must be a pointer, received: " ++ @typeName(Decl)),
                    };
                    if (S) |Current| {
                        if (New != Current) @compileError("Multiple static type detected: " ++ @typeName(Current) ++ ", " ++ @typeName(New));
                    } else {
                        S = New;
                    }
                }
            }
            break :init S orelse void;
        };
        pub const Instance = Object.Custom(T);

        fn getMethodName(comptime decl_name: [:0]const u8) ?[:0]const u8 {
            const Decl = @TypeOf(@field(T, decl_name));
            if (@typeInfo(Decl) == .@"fn") {
                const prefix = "static call ";
                if (std.mem.startsWith(u8, decl_name, prefix)) return decl_name[prefix.len..];
            }
            return null;
        }

        fn getGetterName(comptime decl_name: [:0]const u8) ?[:0]const u8 {
            const Decl = @TypeOf(@field(T, decl_name));
            if (@typeInfo(Decl) == .@"fn") {
                const prefix = "static get ";
                if (std.mem.startsWith(u8, decl_name, prefix)) {
                    const correct = check: {
                        const f = @typeInfo(Decl).@"fn";
                        // check param count: self
                        if (f.param_types.len != 1) break :check false;
                        // check self pointer
                        switch (@TypeOf(f.param_types[0].?)) {
                            .pointer => |pt| if (pt.child != T) break :check false,
                            else => break :check false,
                        }
                    };
                    if (!correct) @compileError("Invalid getter: @\"" ++ decl_name ++ "\": " ++ @typeName(Decl));
                    return decl_name[prefix.len..];
                }
            }
            return null;
        }

        fn getSetterName(comptime decl_name: [:0]const u8) ?[:0]const u8 {
            const Decl = @TypeOf(@field(T, decl_name));
            if (@typeInfo(Decl) == .@"fn") {
                const prefix = "static set ";
                if (std.mem.startsWith(u8, decl_name, prefix)) {
                    const correct = check: {
                        const f = @typeInfo(Decl).@"fn";
                        // check param count: self + value
                        if (f.param_types.len != 2) break :check false;
                        // check self pointer
                        switch (@TypeOf(f.param_types[0].?)) {
                            .pointer => |pt| if (pt.child != T) break :check false,
                            else => break :check false,
                        }
                        // check return value
                        switch (@TypeOf(f.return_type.?)) {
                            .void => break :check true,
                            .error_union => |eu| break :check eu.child == void,
                            else => break :check false,
                        }
                    };
                    if (!correct) @compileError("Invalid setter: @\"" ++ decl_name ++ "\": " ++ @typeName(Decl));
                    return decl_name[prefix.len..];
                }
            }
            return null;
        }

        const getter_names = init: {
            var count: usize = 0;
            for (decl_names) |decl_name| {
                if (getGetterName(decl_name) != null) count += 1;
            }
            var i: usize = 0;
            var names: [count][:0]const u8 = undefined;
            for (decl_names) |decl_name| {
                if (getGetterName(decl_name)) |n| {
                    names[i] = n;
                    i += 1;
                }
            }
            break :init names;
        };
        const setter_names = init: {
            var count: usize = 0;
            for (decl_names) |decl_name| {
                if (getSetterName(decl_name) != null) count += 1;
            }
            var i: usize = 0;
            var names: [count][:0]const u8 = undefined;
            for (decl_names) |decl_name| {
                if (getSetterName(decl_name)) |n| {
                    names[i] = n;
                    i += 1;
                }
            }
            break :init names;
        };
        const method_names = init: {
            var count: usize = 0;
            for (decl_names) |decl_name| {
                if (getMethodName(decl_name) != null) count += 1;
            }
            var i: usize = 0;
            var names: [count][:0]const u8 = undefined;
            for (decl_names) |decl_name| {
                if (getMethodName(decl_name)) |n| {
                    names[i] = n;
                    i += 1;
                }
            }
            break :init names;
        };
        const Methods = Object.MethodSet(method_names);
        const methods: Methods = .fromType(T, "static call ");

        class: Class align(@max(@alignOf(Class), @alignOf(Static))),
        custom: Static,

        comptime {
            if (@offsetOf(@This(), "class") != 0) {
                @compileError("class is in the wrong position");
            }
        }
    };
}
