const std = @import("std");

const accessor = @import("../accessor.zig");
const ObjectTransform = accessor.ObjectTransform;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const Closure = @import("../closure.zig").Closure;
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

const Closures = struct {
    constructor: ?*Closure,
    cast: ?*Closure,
    __tostring: ?*Closure,

    pub fn release(self: *@This()) void {
        inline for (comptime std.meta.fieldNames(@This())) |name| {
            if (@field(self, name)) |c| c.release();
        }
    }
};

pub fn Class(comptime S: type) type {
    return struct {
        closures: Closures = undefined,
        table: Value = undefined,

        pub const scope: ZigClassEntry.ScopeType = .static;

        const Super = structure.StructLike(@This());

        pub fn finalize(self: *@This()) !void {
            self.closures.constructor = try Closure.create(self, construct, "constructor");
            self.closures.cast = try Closure.create(self, cast, "cast");
            self.closures.__tostring = try Closure.create(self, stringify, "stringify");
        }

        pub fn freeObject(obj: *Object) void {
            const self = fromObject(obj);
            self.closures.release();
            Super.freeObject(obj);
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
                return func.closure.function();
            } else if (field_obj.handlers.*.get_closure != php.std_object_handlers.get_closure) {
                // aside from Function, only Class implements getClosure()
                const class_struct = fromObject(field_obj);
                if (class_struct.closures.cast) |c| return c.function();
            }
            return null;
        }

        pub fn getClosure(obj: *Object, _: *[*c]ClassEntry, fn_ptr: *[*c]Function, _: *[*c]Object, _: bool) c_int {
            // the class reference object functions as a casting operator when called
            const self = fromObject(obj);
            if (self.closures.cast) |c| {
                fn_ptr.* = c.function();
                return php.SUCCESS;
            } else {
                return php.FAILURE;
            }
        }

        pub fn construct(_: *@This(), arg_iter: *ArgumentIterator) !void {
            if (!@hasDecl(S, "checkArguments")) unreachable;
            const this_struct = try getThis(arg_iter);
            // see if an allocator is specified
            const custom_allocator = try extractAllocator(arg_iter);
            try this_struct.checkArguments(arg_iter);
            const arg = arg_iter.next() orelse null;
            try this_struct.initialize(custom_allocator, arg);
            if (custom_allocator != null) {
                // make buffers allocated from custom allocator external
                _ = try this_struct.externalize();
            }
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

        pub fn cast(self: *@This(), arg_iter: *ArgumentIterator) !?Value {
            const class = ZigClassEntry.fromStructure(self);
            const byte_size = class.byte_size orelse return error.InvalidType;
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
                if (try static.castValue(arg)) |value| return value;
            }
            const str = php.getValueString(arg) catch {
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
            const new_obj = try class.createPreinitializedObject(buf, null);
            try class.registerObject(new_obj);
            return php.createValueObject(new_obj);
        }

        pub fn stringify(_: *@This(), arg_iter: *ArgumentIterator) !?Value {
            const this_struct = try getThis(arg_iter);
            return try this_struct.readSelf(.to_string);
        }

        fn getThis(arg_iter: *ArgumentIterator) !*S {
            const obj = try php.getValueObject(arg_iter.this);
            return &ZigObject(S).fromObject(obj).zig_portion;
        }

        pub const readSelf = Super.readSelf;
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
