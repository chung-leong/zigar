const std = @import("std");

const accessor = @import("../accessor.zig");
const byte_buffer = @import("../byte-buffer.zig");
const ByteBuffer = byte_buffer.ByteBuffer;
const php = @import("../php.zig");
const ClassEntry = php.ClassEntry;
const ExecuteData = php.ExecuteData;
const Function = php.Function;
const HashPosition = php.HashPosition;
const HashTable = php.HashTable;
const Object = php.Object;
const String = php.String;
const Value = php.Value;
const structure = @import("../structure.zig");
const zig_class = @import("../zig-class.zig");
const ZigClass = zig_class.ZigClass;

pub const ErrorSet = struct {
    bytes: *ByteBuffer = undefined,
    message: ?*String = null,
    circular_ref: bool = false,

    const Super = structure.Parent(@This());
    pub const Static = struct {
        value_acc: *accessor.Primitive = undefined,
        methods: Methods = undefined,

        const Methods = struct {
            getMessage: Function,
            getCode: Function,
            getFile: Function,
            getLine: Function,
            getTrace: Function,
            getTraceAsString: Function,
            getPrevious: Function,
        };

        pub fn init(self: *@This(), class: *ZigClass) !void {
            const member = try class.getMember(.instance, 0);
            if (member.accessors != .primitive) return error.InvalidAccessor;
            self.value_acc = &member.accessors.primitive;
            // loop through static members and add errors to global error set, keyed by value,
            // name, and error message
            const global_err_ht = get: {
                if (class.host.global_error_set) |ht| {
                    php.addRef(ht);
                    break :get ht;
                } else {
                    const ht = php.createArray();
                    class.host.global_error_set = ht;
                    break :get ht;
                }
            };
            var pos: HashPosition = undefined;
            const member_ht = &class.static.members;
            const static_slots = class.static.template.slots orelse return error.MissingSlots;
            php.initializeHashPosition(member_ht, &pos);
            while (php.getHashPositionValue(member_ht, &pos)) |member_value| {
                const static_member = try php.getValuePointer(*ZigClass.Member, member_value);
                if (static_member.slot) |slot| {
                    const err = try php.getProperty(static_slots, slot);
                    const err_obj = try php.getValueObject(err);
                    const err_struct = fromObject(err_obj);
                    // decrement ref count on class
                    class.release();
                    err_struct.circular_ref = true;
                    const err_value = try self.value_acc.get(err_struct.bytes);
                    // reference err by integer value
                    const long = try php.getValueLong(&err_value);
                    try php.setHashEntryRef(global_err_ht, long, err);
                    // reference err by name
                    var name_key = php.getHashPositionKey(member_ht, &pos);
                    defer php.release(&name_key);
                    const name = try php.getValueString(&name_key);
                    try php.setHashEntryRef(global_err_ht, name, err);
                    const message = createDecamelizedMessage(name);
                    try php.setHashEntryRef(global_err_ht, message, err);
                    // attach message to err
                    err_struct.message = message;
                    if (!php.moveHashPositionForward(member_ht, &pos)) break;
                }
            }
            inline for (std.meta.fields(Methods)) |field| {
                const handler = @field(ErrorSet, field.name);
                @field(self.methods, field.name) = php.createFunction(handler, field.name, class.entry());
            }
        }

        pub fn deinit(self: *@This()) void {
            const class = ZigClass.fromStatic(self);
            php.release(class.host.global_error_set.?);
        }

        fn findErrorByValue(self: *Static, long: c_long) !*Value {
            const class = ZigClass.fromStatic(self);
            const global_err_ht = class.host.global_error_set.?;
            return php.getHashEntry(global_err_ht, long);
        }

        fn findErrorByMessage(self: *Static, name: []const u8) !*Value {
            const class = ZigClass.fromStatic(self);
            const global_err_ht = class.host.global_error_set.?;
            return php.getHashEntry(global_err_ht, name);
        }
    };

    pub fn freeObject(obj: *Object) void {
        Super.freeObject(obj);
        const self = fromObject(obj);
        if (self.message) |m| php.release(m);
    }

    pub fn readSelf(obj: *Object) !Value {
        const self = fromObject(obj);
        const class = ZigClass.fromObject(obj);
        const static = class.getStaticData(@This());
        const value = try static.value_acc.get(self.bytes);
        const long = try php.getValueLong(&value);
        if (static.findErrorByValue(long)) |err| {
            php.addRef(err);
            return err.*;
        } else |_| {
            return php.createValueObject(obj);
        }
    }

    pub fn writeSelf(obj: *Object, value: *const Value) !void {
        const self = fromObject(obj);
        const class = ZigClass.fromObject(obj);
        var static = class.getStaticData(@This());
        const err_value = find: {
            if (php.getValueObject(value)) |exception| {
                if (php.instanceOf(exception.ce, php.getInterface(.throwable))) {
                    if (exception.ce.*.unnamed_0.parent == &ZigClass.parent_entry) {
                        const err_struct = fromObject(exception);
                        break :find try static.value_acc.get(err_struct.bytes);
                    } else {
                        const msg_value = try php.invokeMethod(exception, "getMessage", .{});
                        const message = try php.getValueStringContent(&msg_value);
                        if (static.findErrorByMessage(message)) |err| {
                            const err_obj = try php.getValueObject(err);
                            const err_struct = fromObject(err_obj);
                            break :find try static.value_acc.get(err_struct.bytes);
                        } else |_| {
                            return php.throwExceptionFmt("'{s}' does not correspond to error in global set (zig)", .{
                                message,
                            });
                        }
                    }
                } else {
                    return php.throwExceptionFmt("'{s}' does not implement throwable (zig)", .{
                        php.getStringContent(obj.ce.*.name),
                    });
                }
            } else |_| if (php.getType(value) == .long) {
                break :find value.*;
            } else {
                return error.InvalidType;
            }
        };
        try static.value_acc.set(self.bytes, &err_value);
    }

    pub fn getMethod(obj_ptr: *[*c]Object, name: *String, _: *const Value) !?*Function {
        const obj = obj_ptr.*;
        const class = ZigClass.fromObject(obj);
        const static = class.getStaticData(@This());
        const name_s = php.getStringContent(name);
        inline for (std.meta.fields(Static.Methods)) |field| {
            if (std.mem.eql(u8, name_s, field.name))
                return &@field(static.methods, field.name);
        }
        return null;
    }

    pub fn getMessage(ed: *ExecuteData, return_value: *Value) !void {
        const obj = try php.getValueObject(&ed.This);
        const self = fromObject(obj);
        const message = self.message orelse get: {
            // get message from static object
            var value = try readSelf(obj);
            defer php.release(&value);
            const err_obj = try php.getValueObject(&value);
            const err_struct = fromObject(err_obj);
            break :get err_struct.message orelse return error.Unexpected;
        };
        php.addRef(message);
        return_value.* = php.createValueString(message);
    }

    pub fn getCode(ed: *ExecuteData, return_value: *Value) !void {
        const obj = try php.getValueObject(&ed.This);
        const self = fromObject(obj);
        const class = ZigClass.fromObject(obj);
        const static = class.getStaticData(@This());
        return_value.* = try static.value_acc.get(self.bytes);
    }

    pub fn getFile(ed: *ExecuteData, return_value: *Value) !void {
        const obj = try php.getValueObject(&ed.This);
        const class = ZigClass.fromObject(obj);
        _ = class;
        // TODO: return file name of Zig file
        return_value.* = php.createValueStringContent("unknown");
    }

    pub fn getLine(_: *ExecuteData, return_value: *Value) !void {
        return_value.* = php.createValueLong(0);
    }

    pub fn getTrace(_: *ExecuteData, return_value: *Value) !void {
        return_value.* = php.createValueArray();
    }

    pub fn getTraceAsString(_: *ExecuteData, return_value: *Value) !void {
        return_value.* = php.createValueStringContent("");
    }

    pub fn getPrevious(_: *ExecuteData, return_value: *Value) !void {
        return_value.* = php.createValueNull();
    }

    fn createDecamelizedMessage(name_obj: *const String) *String {
        const name = php.getStringContent(name_obj);
        var len_required: usize = 0;
        for (name, 0..) |c, i| {
            const conversion_needed = check: {
                var needed = false;
                if (std.ascii.isUpper(c)) {
                    // previous letter is not uppercase
                    if (i == 0 or !std.ascii.isUpper(name[i - 1])) {
                        // next letter is not uppercase
                        if (i == name.len - 1 or !std.ascii.isUpper(name[i + 1])) {
                            needed = true;
                        }
                    }
                }
                break :check needed;
            };
            if (conversion_needed) {
                len_required += if (i > 0) 2 else 1;
            } else {
                len_required += 1;
            }
        }
        const message = php.createStringWithLength(len_required);
        const buffer = @constCast(php.getStringContent(message));
        var len: usize = 0;
        for (name, 0..) |c, i| {
            const conversion_needed = check: {
                var needed = false;
                if (std.ascii.isUpper(c)) {
                    if (i == 0 or !std.ascii.isUpper(name[i - 1])) {
                        if (i == name.len - 1 or !std.ascii.isUpper(name[i + 1])) {
                            needed = true;
                        }
                    }
                }
                break :check needed;
            };
            if (conversion_needed) {
                if (i > 0) {
                    buffer[len] = ' ';
                    len += 1;
                }
                buffer[len] = std.ascii.toLower(c);
                len += 1;
            } else {
                buffer[len] = c;
                len += 1;
            }
        }
        return message;
    }

    pub const fromObject = Super.fromObject;
    pub const setStorage = Super.setStorage;
    pub const readProperty = Super.readProperty;
    pub const writeProperty = Super.writeProperty;
};
