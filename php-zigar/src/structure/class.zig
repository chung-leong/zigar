const std = @import("std");

const accessor = @import("../accessor.zig");
const ObjectTransform = accessor.ObjectTransform;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const ZigObject = @import("../object.zig").ZigObject;
const php = @import("../php.zig");
const ArgumentIterator = php.ArgumentIterator;
const ClassEntry = php.ClassEntry;
const ExecuteData = php.ExecuteData;
const Function = php.Function;
const Object = php.Object;
const ObjectIterator = php.ObjectIterator;
const String = php.String;
const Value = php.Value;
const structure = @import("../structure.zig");

pub fn Class(comptime S: type) type {
    return struct {
        closure: Closure = undefined,
        table: Value = undefined,

        pub const scope: ZigClassEntry.ScopeType = .static;
        pub const Super = structure.StructLike(@This());
        pub const Methods = struct {
            constructor: Function,
            __tostring: Function,
        };
        pub const Self = @This();
        pub const Closure = struct {
            self: *Self,
            php_portion: Function,
        };

        var methods: ?Methods = null;

        pub fn finalize(self: *@This(), _: bool) !void {
            self.closure = .{
                .self = self,
                .php_portion = php.createTransformedFunction(handleCast, "cast", 1, false),
            };
        }

        pub fn getMethod(obj_ptr: *[*c]Object, name: *String, _: ?*const Value) !?*Function {
            const obj = obj_ptr.*;
            const self = fromObject(obj);
            const field = self.readMember(name, null) catch return null;
            defer php.release(&field);
            const field_obj = php.getValueObject(&field) catch return null;
            const field_class = ZigClassEntry.fromObject(field_obj);
            if (field_class.type == .function) {
                const func = ZigObject(structure.Function).fromObject(field_obj).structure();
                return &func.closure.php_portion;
            } else if (field_obj.handlers.*.get_closure != php.std_object_handlers.get_closure) {
                // aside from Function, only Class implements getClosure()
                const class_struct = fromObject(field_obj);
                return &class_struct.closure.php_portion;
            }
            return null;
        }

        pub fn getClosure(obj: *Object, _: *[*c]ClassEntry, fn_ptr: *[*c]Function, _: *[*c]Object, _: bool) c_int {
            // the class reference object functions as a casting operator when called
            const self = fromObject(obj);
            fn_ptr.* = &self.closure.php_portion;
            return php.SUCCESS;
        }

        fn extractAllocator(arg_iter: *ArgumentIterator) !?*std.mem.Allocator {
            var special_args: struct {
                allocator: ?Value = null,
            } = .{};
            arg_iter.extractNamedArguments(&special_args, .{ .allocator = true });
            defer if (special_args.allocator) |a| php.release(&a);
            const src_value = special_args.allocator orelse return null;
            const src_obj = try php.getValueObject(&src_value);
            const src_class = ZigClassEntry.fromObject(src_obj);
            if (src_class.type != .@"struct" or src_class.purpose != .allocator) {
                return error.NotAllocator;
            }
            const src_struct = ZigObject(structure.Struct).fromObject(src_obj).structure();
            return @ptrCast(@alignCast(src_struct.buffer.bytes.ptr));
        }

        pub fn getMethods() *Methods {
            if (methods == null) {
                methods = .{
                    // constructor needs to be variadic since it can accept named arguments in lieu of an array
                    .constructor = php.createTransformedFunction(handleConstructor, "__construct", 0, true),
                    .__tostring = php.createTransformedFunction(handleToString, "__toString", 0, false),
                };
            }
            return &methods.?;
        }

        pub fn handleCast(ed: *ExecuteData, return_value: *Value) !void {
            const func: *Function = @ptrCast(ed.func);
            const closure: *Closure = @fieldParentPtr("php_portion", func);
            const self: *@This() = closure.self;
            const class = ZigClassEntry.fromStructure(self);
            const byte_size = class.byte_size orelse return error.InvalidType;
            var arg_iter: ArgumentIterator = .init(ed);
            if (arg_iter.len != 1) {
                return php.throwExceptionFmt("casting operation expects 1 argument, received {d}", .{
                    arg_iter.total,
                });
            }
            const arg = arg_iter.next().?;
            const static = class.getStaticData(S);
            const Static = @TypeOf(static.*);
            // certain types like enum can cast from other types
            if (@hasDecl(Static, "castValue")) {
                if (try static.castValue(arg)) |value| {
                    return_value.* = value;
                    return;
                }
            }
            const str = php.getValueString(arg) catch {
                // TODO: refactor this
                const cast_args = switch (@hasDecl(Static, "cast_args")) {
                    true => static.getCastArgs(),
                    false => "a string",
                };
                return php.throwExceptionFmt("casting operation expects {s} as argument, received {s}", .{
                    cast_args,
                    @tagName(php.getType(arg)),
                });
            };
            if (str.len != byte_size) {
                return php.throwExceptionFmt("{s} '{s}' expects {d} bytes, received a string with {d} bytes", .{
                    class.getStructureName(),
                    class.getName(),
                    byte_size,
                    str.len,
                });
            }
            const buf = try ByteBuffer.create(class.alignment);
            buf.referenceString(str);
            const new_obj = try class.createObjectFromBuffer(buf, null);
            return_value.* = php.createValueObject(new_obj);
        }

        pub fn handleConstructor(ed: *ExecuteData, _: *Value) !void {
            if (!@hasDecl(S, "checkArguments")) unreachable;
            const this_struct = try getThis(&ed.This);
            // see if an allocator is specified
            var arg_iter: ArgumentIterator = .init(ed);
            const custom_allocator = try extractAllocator(&arg_iter);
            try this_struct.checkArguments(&arg_iter);
            const arg = arg_iter.next() orelse null;
            try this_struct.initialize(custom_allocator, arg);
            if (@hasDecl(S, "finalize")) {
                try this_struct.finalize(true);
            }
            if (custom_allocator != null) {
                // make buffers allocated from custom allocator external
                try this_struct.externalize();
            }
        }

        pub fn handleToString(ed: *ExecuteData, return_value: *Value) !void {
            const this_struct = try getThis(&ed.This);
            return_value.* = try this_struct.readSelf(.to_string);
        }

        fn getThis(value: *const Value) !*S {
            const obj = try php.getValueObject(value);
            return ZigObject(S).fromObject(obj).structure();
        }

        pub const setStorage = Super.setStorage;
        pub const readSelf = Super.readSelf;
        pub const freeObject = Super.freeObject;
        pub const readProperty = Super.readProperty;
        pub const writeProperty = Super.writeProperty;
        pub const hasProperty = Super.hasProperty;
        pub const getProperties = Super.getProperties;
        pub const getPropertyPointer = Super.getPropertyPointer;
        pub const getReferencedObjects = Super.getReferencedObjects;
        const fromObject = Super.fromObject;
        const object = Super.object;
        const readMember = Super.readMember;
    };
}
