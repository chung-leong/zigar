const std = @import("std");

const accessor = @import("../accessor.zig");
const byte_buffer = @import("../byte-buffer.zig");
const ByteBuffer = byte_buffer.ByteBuffer;
const php = @import("../php.zig");
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

    const Super = structure.Parent(@This());
    pub const Static = struct {
        value_acc: *accessor.Primitive = undefined,

        pub fn initialize(self: *@This(), class: *ZigClass) !void {
            const member = try class.getMember(.instance, 0);
            if (member.accessors != .primitive) return error.InvalidAccessor;
            self.value_acc = &member.accessors.primitive;
            // loop through static members and add errors to global error set, keyed by value,
            // name, and error message
            const global_err_ht = &class.host.global_error_set;
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
                    const err_value = try self.value_acc.get(err_struct.bytes);
                    // reference err by integer value
                    const long = try php.getValueLong(&err_value);
                    try php.setHashEntryRef(global_err_ht, long, err);
                    // reference err by name
                    const name_key = php.getHashPositionKey(member_ht, &pos);
                    const name = try php.getValueString(&name_key);
                    try php.setHashEntryRef(global_err_ht, name, err);
                    const message = createDecamelizedMessage(name);
                    try php.setHashEntryRef(global_err_ht, message, err);
                    // attach message to err
                    err_struct.message = message;
                    php.addRef(name);
                    if (!php.moveHashPositionForward(member_ht, &pos)) break;
                }
            }
        }

        fn findErrorByValue(self: *Static, long: c_long) !*Value {
            const class = ZigClass.fromStatic(self);
            const global_err_ht = &class.host.global_error_set;
            return php.getHashEntry(global_err_ht, long);
        }

        fn findErrorByMessage(self: *Static, name: []const u8) !*Value {
            const class = ZigClass.fromStatic(self);
            const global_err_ht = &class.host.global_error_set;
            return php.getHashEntry(global_err_ht, name);
        }
    };

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
                if (exception.ce == class.entry()) {
                    const err_struct = fromObject(exception);
                    break :find try static.value_acc.get(err_struct.bytes);
                } else if (php.instanceOf(exception.ce, php.getInterface(.exception))) {
                    const prop_name = php.createString("message");
                    defer php.release(prop_name);
                    const msg_value = php.readObjectProperty(exception, prop_name);
                    const message = try php.getValueStringContent(&msg_value);
                    if (static.findErrorByMessage(message)) |err| {
                        const err_obj = try php.getValueObject(err);
                        const err_struct = fromObject(err_obj);
                        break :find try static.value_acc.get(err_struct.bytes);
                    } else |_| {
                        php.throwExceptionFmt("'{s}' does not correspond to error in global set (zig)", .{
                            message,
                        });
                        return;
                    }
                } else {
                    php.throwExceptionFmt("'{s}' is not exception (zig)", .{
                        php.getStringContent(obj.ce.*.name),
                    });
                    return;
                }
            } else |_| if (php.getType(value) == .long) {
                break :find value.*;
            } else {
                return error.InvalidType;
            }
        };
        try static.value_acc.set(self.bytes, &err_value);
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
                len_required += 2;
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
                buffer[len] = ' ';
                len += 1;
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
    pub const freeObject = Super.freeObject;
    pub const readProperty = Super.readProperty;
    pub const writeProperty = Super.writeProperty;
};
