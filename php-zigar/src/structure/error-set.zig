const std = @import("std");

const accessor = @import("../accessor.zig");
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClass = @import("../class.zig").ZigClass;
const ZigObject = @import("../object.zig").ZigObject;
const php = @import("../php.zig");
const Array = php.Array;
const ClassEntry = php.ClassEntry;
const ExecuteData = php.ExecuteData;
const Function = php.Function;
const HashPosition = php.HashPosition;
const HashTable = php.HashTable;
const Object = php.Object;
const String = php.String;
const Value = php.Value;
const structure = @import("../structure.zig");

pub const ErrorSet = struct {
    bytes: *ByteBuffer = undefined,
    canonical: ?*Canonical = null,

    const Super = structure.Parent(@This());
    const Canonical = struct {
        message: *String,
        string: ?*String = null,
        file: ?*String = null,
        lineno: u32 = 0,
        trace: ?*Array = null,
        unknown: bool = false,

        pub fn release(self: *@This()) void {
            php.release(self.message);
            if (self.string) |s| php.release(s);
            if (self.file) |s| php.release(s);
            if (self.trace) |a| php.release(a);
        }
    };
    pub const Static = struct {
        value_acc: *accessor.Primitive = undefined,
        methods: *Methods = undefined,

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
                    // attach canonical info to err
                    const props = try php.allocator.create(Canonical);
                    props.* = .{ .message = message };
                    err_struct.canonical = props;
                    // decrement ref count on class (since the class holds a ref on the error)
                    class.release();
                    if (!php.moveHashPositionForward(member_ht, &pos)) break;
                }
            }
            self.methods = try php.allocator.create(Methods);
            inline for (std.meta.fields(Methods)) |field| {
                const handler = @field(ErrorSet, field.name);
                @field(self.methods, field.name) = php.createFunction(handler, field.name);
            }
        }

        pub fn deinit(self: *@This()) void {
            const class = ZigClass.fromStatic(self);
            php.release(class.host.global_error_set.?);
            php.allocator.destroy(self.methods);
        }

        pub fn readErrorValue(self: *@This(), err_obj: *Object) !Value {
            const err_struct = fromObject(err_obj);
            return try self.value_acc.get(err_struct.bytes);
        }

        pub fn findError(self: *@This(), key: anytype) !*Object {
            const class = ZigClass.fromStatic(self);
            const global_err_ht = class.host.global_error_set.?;
            const err_value = try php.getHashEntry(global_err_ht, key);
            return try php.getValueObject(err_value);
        }

        pub fn acquireError(self: *@This(), err_code: c_long) !*Object {
            const obj = try self.findError(err_code);
            const err_obj = try getCanonical(obj);
            const err_struct = fromObject(err_obj);
            const props = err_struct.canonical.?;
            if (props.trace) |a| php.release(a);
            errdefer props.trace = null;
            props.trace = try php.getBacktrace();
            if (props.file) |s| php.release(s);
            props.file = php.getCurrentFile();
            props.lineno = php.getCurrentLine();
            return err_obj;
        }
    };

    pub fn freeObject(obj: *Object) void {
        const self = fromObject(obj);
        self.bytes.release();
        if (self.canonical == null or self.canonical.?.unknown) {
            const class = ZigClass.fromObject(obj);
            class.release();
        }
        if (self.canonical) |props| {
            props.release();
        }
    }

    pub fn readProperty(obj: *Object, name: *String, prop_type: c_int, cache_slot: ?[*]?*anyopaque, retval: *Value) !*Value {
        _ = prop_type;
        _ = cache_slot;
        const err_obj = try getCanonical(obj);
        const err_struct = fromObject(err_obj);
        const props = err_struct.canonical.?;
        const name_c = php.getStringContent(name);
        if (std.mem.eql(u8, name_c, "string")) {
            const string = php.useString(props.string, "");
            retval.* = php.createValueString(string);
        } else if (std.mem.eql(u8, name_c, "file")) {
            const file = php.useString(props.file, "(unknown)");
            retval.* = php.createValueString(file);
        } else if (std.mem.eql(u8, name_c, "line")) {
            retval.* = php.createValueLong(@intCast(props.lineno));
        } else {
            std.debug.print("readProperty {s}\n", .{name_c});
            retval.* = php.createValueNull();
        }
        return retval;
    }

    pub fn writeProperty(obj: *Object, name: *String, value: *Value, cache_slot: ?[*]?*anyopaque) !*Value {
        _ = cache_slot;
        const err_obj = try getCanonical(obj);
        const err_struct = fromObject(err_obj);
        const props = err_struct.canonical.?;
        const name_c = php.getStringContent(name);
        if (std.mem.eql(u8, name_c, "string")) {
            const new_str = try php.getValueString(value);
            if (props.string) |s| php.release(s);
            props.string = new_str;
            php.addRef(new_str);
        }
        return value;
    }

    pub fn readSelf(obj: *Object) !Value {
        const err_obj = try getCanonical(obj);
        php.addRef(err_obj);
        return php.createValueObject(err_obj);
    }

    fn getCanonical(obj: *Object) !*Object {
        const self = fromObject(obj);
        if (self.canonical != null) return obj;
        const class = ZigClass.fromObject(obj);
        const static = class.getStaticData(@This());
        const err_value = try static.value_acc.get(self.bytes);
        const err_code = try php.getValueLong(&err_value);
        return static.findError(err_code) catch new: {
            // unknown error number--attach a canonical struct
            var buffer: [32]u8 = undefined;
            const text = std.fmt.bufPrint(&buffer, "Unknown error #{d}", .{err_code}) catch unreachable;
            const message = php.createString(text);
            const props = try php.allocator.create(Canonical);
            props.* = .{ .message = message, .unknown = true };
            self.canonical = props;
            break :new obj;
        };
    }

    pub fn writeSelf(obj: *Object, value: *const Value) !void {
        const self = fromObject(obj);
        const class = ZigClass.fromObject(obj);
        const static = class.getStaticData(@This());
        const err_value = find: {
            if (php.getValueObject(value)) |exception| {
                if (php.instanceOf(exception.ce, php.getInterface(.throwable))) {
                    if (ZigClass.isZigError(exception.ce)) {
                        break :find try static.readErrorValue(exception);
                    } else {
                        const msg_value = try php.invokeMethod(exception, "getMessage", .{});
                        const message = try php.getValueStringContent(&msg_value);
                        if (static.findError(message)) |err_obj| {
                            break :find try static.readErrorValue(err_obj);
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
                return error.InvalidTypeForErrorSet;
            }
        };
        try static.value_acc.set(self.bytes, &err_value);
    }

    pub fn stringify(obj: *Object) !Value {
        const err_obj = try getCanonical(obj);
        const err_struct = fromObject(err_obj);
        const props = err_struct.canonical.?;
        const message = php.useString(props.message, "");
        defer php.release(message);
        const file = php.useString(props.file, "(unknown)");
        defer php.release(file);
        const trace = php.useArray(props.trace);
        defer php.release(trace);
        const trace_str = php.traceToString(trace, true);
        defer php.release(trace_str);
        const text = try std.fmt.allocPrint(
            php.allocator,
            \\ZigError: {s} in {s}:{d}
            \\Stack trace:
            \\{s}
        ,
            .{
                php.getStringContent(message),
                php.getStringContent(file),
                props.lineno,
                php.getStringContent(trace_str),
            },
        );
        defer php.allocator.free(text);
        return php.createValueStringContent(text);
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
        const err_obj = try getCanonical(obj);
        const err_struct = fromObject(err_obj);
        const message = php.useString(err_struct.canonical.?.message, "");
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
        const err_obj = try getCanonical(obj);
        const err_struct = fromObject(err_obj);
        const file = php.useString(err_struct.canonical.?.file, "(unknown)");
        return_value.* = php.createValueString(file);
    }

    pub fn getLine(ed: *ExecuteData, return_value: *Value) !void {
        const obj = try php.getValueObject(&ed.This);
        const err_obj = try getCanonical(obj);
        const err_struct = fromObject(err_obj);
        return_value.* = php.createValueLong(@intCast(err_struct.canonical.?.lineno));
    }

    pub fn getTrace(ed: *ExecuteData, return_value: *Value) !void {
        const obj = try php.getValueObject(&ed.This);
        const err_obj = try getCanonical(obj);
        const err_struct = fromObject(err_obj);
        const trace = php.useArray(err_struct.canonical.?.trace);
        return_value.* = php.createValueArray(trace);
    }

    pub fn getTraceAsString(ed: *ExecuteData, return_value: *Value) !void {
        const obj = try php.getValueObject(&ed.This);
        const err_obj = try getCanonical(obj);
        const err_struct = fromObject(err_obj);
        const trace = php.useArray(err_struct.canonical.?.trace);
        const trace_str = php.traceToString(trace, true);
        return_value.* = php.createValueString(trace_str);
    }

    pub fn getPrevious(_: *ExecuteData, return_value: *Value) !void {
        return_value.* = php.createValueNull();
    }

    pub const fromObject = Super.fromObject;
    pub const setStorage = Super.setStorage;
    // pub const readProperty = Super.readProperty;
    // pub const writeProperty = Super.writeProperty;
};

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
