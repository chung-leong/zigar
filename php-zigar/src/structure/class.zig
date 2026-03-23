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
    constructor: ?*Closure = null,
    cast: ?*Closure = null,
    __tostring: ?*Closure = null,
};

pub fn Class(comptime S: type) type {
    return struct {
        // these needs to be initialized, since setStorage() isn't called immediately
        slots: Value = .{},
        closures: Closures = .{},

        pub const scope: ZigClassEntry.ScopeType = .static;

        const Super = structure.StructLike(@This());

        pub fn setStorage(self: *@This(), bytes: *ByteBuffer, slots: *const Value) !void {
            try Super.setStorage(self, bytes, slots);
            self.closures.constructor = try Closure.create(self, construct, "constructor");
            self.closures.cast = try Closure.create(self, cast, "cast");
            self.closures.__tostring = try Closure.create(self, stringify, "stringify");
        }

        pub fn freeObject(obj: *Object) void {
            const self = fromObject(obj);
            inline for (comptime std.meta.fields(@TypeOf(self.closures))) |field| {
                if (@field(self.closures, field.name)) |c| c.release();
            }
            php.release(&self.slots);
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
            const this_struct = try getThis(arg_iter);
            if (@hasDecl(S, "copyArguments")) {
                try this_struct.copyArguments(arg_iter);
            } else {
                @panic("copyArguments() is not implemented: " ++ @typeName(S));
            }
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
            const new_obj = try class.obtainObjectFromString(str);
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
