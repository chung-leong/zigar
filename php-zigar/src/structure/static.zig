const std = @import("std");

const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClass = @import("../class.zig").ZigClass;
const ZigObject = @import("../object.zig").ZigObject;
const php = @import("../php.zig");
const ArgumentIterator = php.ArgumentIterator;
const ClassEntry = php.ClassEntry;
const ExecuteData = php.ExecuteData;
const Function = php.Function;
const Object = php.Object;
const String = php.String;
const Value = php.Value;
const structure = @import("../structure.zig");

pub const Static = struct {
    // this needs to be initialized, since setStorage() isn't called immediately
    slots: Value = .{},
    function: Function = undefined,

    pub const scope: ZigClass.ScopeType = .static;

    const Super = structure.Parent(@This());

    pub fn setStorage(self: *@This(), bytes: *ByteBuffer, slots: *const Value) !void {
        try Super.setStorage(self, bytes, slots);
        self.function = php.createFunction(cast, "cast", 1);
    }

    pub fn getMethod(obj_ptr: *[*c]Object, name: *String, _: *const Value) !?*Function {
        const obj = obj_ptr.*;
        const self = fromObject(obj);
        const field = self.readMember(name, null) catch return null;
        defer php.release(&field);
        const field_obj = php.getValueObject(&field) catch return null;
        const field_class = ZigClass.fromObject(field_obj);
        if (field_class.type == .function) {
            const func = structure.Function.fromObject(field_obj);
            return &func.function;
        } else if (field_obj.handlers.*.get_closure) |get| {
            // aside from Function, only Static implements getClosure()
            // so we're calling the function below
            var func: [*c]Function = undefined;
            if (get(field_obj, null, &func, null, false) == php.SUCCESS) {
                return func;
            }
        }
        return null;
    }

    pub fn getClosure(obj: *Object, ce_ptr: *[*c]ClassEntry, fn_ptr: *[*c]Function, obj_ptr: *[*c]Object, _: bool) c_int {
        const self = fromObject(obj);
        fn_ptr.* = &self.function;
        ce_ptr.* = obj.ce;
        obj_ptr.* = obj;
        return php.SUCCESS;
    }

    pub fn cast(ed: *ExecuteData, return_value: *Value) !void {
        const self: *@This() = @fieldParentPtr("function", @as(*php.Function, ed.func));
        var arg_iter: ArgumentIterator = .init(ed, false);
        const obj = self.object();
        const class = ZigClass.fromObject(obj);
        const byte_size = class.byte_size orelse return error.InvalidType;
        std.debug.print("cast {d}\n", .{arg_iter.len});
        if (arg_iter.len != 1) {
            php.throwExceptionFmt("casting operation expects 1 argument, received {d}", .{
                arg_iter.len,
            });
            return error.ExceptionThrown;
        }
        const arg = arg_iter.next().?;
        const str = php.getValueString(arg) catch {
            php.throwExceptionFmt("casting operation expects a string as argument, received {s}", .{
                @tagName(php.getType(arg)),
            });
            return error.ExceptionThrown;
        };
        if (str.len != byte_size) {
            php.throwExceptionFmt("{s} '{s}' expects {d} bytes, received a string with {d} bytes", .{
                class.getStructureName(),
                class.getName(),
                byte_size,
                str.len,
            });
            return error.ExceptionThrown;
        }
        const new_obj = try class.createObjectFromString(str);
        return_value.* = php.createValueObject(new_obj);
    }

    pub const fromObject = Super.fromObject;
    pub const freeObject = Super.freeObject;
    pub const readSelf = Super.readSelf;
    pub const readProperty = Super.readProperty;
    pub const writeProperty = Super.writeProperty;
    pub const getPropertyPointer = Super.getPropertyPointer;
    const object = Super.object;
    const readMember = Super.readMember;
};
