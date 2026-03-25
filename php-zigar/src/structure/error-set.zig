const std = @import("std");

const accessor = @import("../accessor.zig");
const ObjectTransform = accessor.ObjectTransform;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const Closure = @import("../closure.zig").Closure;
const ZigObject = @import("../object.zig").ZigObject;
const php = @import("../php.zig");
const Array = php.Array;
const ArgumentIterator = php.ArgumentIterator;
const ClassEntry = php.ClassEntry;
const ExecuteData = php.ExecuteData;
const Function = php.Function;
const HashTable = php.HashTable;
const Object = php.Object;
const String = php.String;
const Value = php.Value;
const structure = @import("../structure.zig");

pub const ErrorSet = struct {
    canonical: ?*Canonical = null,
    buffer: *ByteBuffer = undefined,

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
            php.allocator.destroy(self);
        }
    };

    pub const Static = struct {
        value_acc: *accessor.Primitive = undefined,
        error_set: *HashTable = undefined,
        closures: struct {
            getMessage: *Closure,
            getCode: *Closure,
            getFile: *Closure,
            getLine: *Closure,
            getTrace: *Closure,
            getTraceAsString: *Closure,
            getPrevious: *Closure,
        } = undefined,

        pub fn init(self: *@This(), class_obj: *Object) !void {
            const class = ZigClassEntry.fromObject(class_obj);
            const member = try class.getMember(.instance, 0);
            if (member.accessors != .primitive) return error.InvalidAccessor;
            self.value_acc = &member.accessors.primitive;
            if (class.flags.error_set.is_global) {
                self.error_set = class.host.global_error_set;
                php.addRef(self.error_set);
            } else {
                self.error_set = php.createArray();
                // loop through static members and add errors to error set, keyed by value,
                // name, and error message
                const static_table = class.static.template.table orelse return error.MissingTable;
                var iter = class.getMemberIterator(.static);
                while (iter.next()) |static_member| {
                    const slot = static_member.slot orelse continue;
                    const err = try php.getProperty(static_table, slot);
                    const err_obj = try php.getValueObject(err);
                    if (ZigClassEntry.fromObject(err_obj).type != .error_set) continue;
                    const name = iter.currentName() orelse return error.MissingName;
                    try self.addCanonical(name, err_obj);
                    // decrement ref count on class (since the class holds a ref on the error)
                    class.release();
                }
            }
            inline for (std.meta.fields(@TypeOf(self.closures))) |field| {
                const handler = @field(ErrorSet, field.name);
                @field(self.closures, field.name) = try Closure.create(self, handler, field.name);
            }
        }

        pub fn deinit(self: *@This()) void {
            php.release(self.error_set);
            inline for (std.meta.fields(@TypeOf(self.closures))) |field| {
                const closure = @field(self.closures, field.name);
                closure.release();
            }
        }

        pub fn castValue(self: *@This(), value: *Value) !?Value {
            switch (php.getType(value)) {
                .long => return self.findCanonical(value) catch php.createValueNull(),
                else => {},
            }
            return null;
        }

        pub fn createCanonicalName(self: *@This()) ![]const u8 {
            const class = ZigClassEntry.fromStatic(self);
            if (class.flags.error_set.is_global) return try php.allocator.dupe(u8, "global error set");
            var iter = class.getMemberIterator(.static);
            const list = try php.allocator.alloc([]const u8, iter.len);
            defer php.allocator.free(list);
            var index: usize = 0;
            while (iter.next()) |_| {
                list[index] = php.getStringContent(iter.currentName().?);
                index += 1;
            }
            const joined = try std.mem.join(php.allocator, ", ", list);
            defer php.allocator.free(joined);
            return if (iter.len <= 1)
                try std.fmt.allocPrint(php.allocator, "error{{{s}}}", .{joined})
            else
                try std.fmt.allocPrint(php.allocator, "error{{ {s} }}", .{joined});
        }

        pub fn findCanonical(self: *@This(), value: *const Value) !Value {
            const class = ZigClassEntry.fromStatic(self);
            return switch (php.getType(value)) {
                .long => {
                    const err_code = php.getValueLong(value) catch unreachable;
                    if (err_code == 0) return php.createValueNull();
                    if (php.getHashEntry(self.error_set, err_code)) |err| {
                        php.addRef(err);
                        return err.*;
                    } else |_| {
                        // create new error
                        const err_obj = try class.obtainNewObject();
                        const bytes = ZigObject(ErrorSet).fromObject(err_obj).structure().buffer;
                        try self.value_acc.transform(null).set(bytes, value);
                        var buffer: [64]u8 = undefined;
                        const text = std.fmt.bufPrint(&buffer, "UnknownError #{d}", .{err_code}) catch unreachable;
                        const name = php.createString(text);
                        try self.addCanonical(name, err_obj);
                        // err_obj has refcount = 2 at this point, which is correct
                        return php.createValueObject(err_obj);
                    }
                },
                .object => {
                    const err_obj = php.getValueObject(value) catch unreachable;
                    if (err_obj.ce == class.entry()) return value.*;
                    if (php.instanceOf(err_obj.ce, php.getInterface(.throwable))) {
                        if (ZigClassEntry.isZigError(err_obj.ce)) {
                            return value.*;
                        } else {
                            const method = php.createValuePersistentString("resume");
                            const message = try php.invokeMethod(value, &method, &.{});
                            if (php.getHashEntry(self.error_set, &message)) |err| {
                                php.addRef(err);
                                return err.*;
                            } else |_| {
                                const name = try self.createCanonicalName();
                                defer php.allocator.free(name);
                                return php.throwExceptionFmt("'{s}' does not correspond to an entry in {s} (zig)", .{
                                    try php.getValueStringContent(&message),
                                    name,
                                });
                            }
                        }
                    } else {
                        return php.throwExceptionFmt("'{s}' does not implement throwable (zig)", .{
                            php.getStringContent(err_obj.ce.*.name),
                        });
                    }
                },
                else => return error.InvalidType,
            };
        }

        pub fn findCanonicalBytes(self: *@This(), value: *const Value) !*ByteBuffer {
            const err = try self.findCanonical(value);
            const err_obj = try php.getValueObject(&err);
            const err_struct = fromObject(err_obj);
            return err_struct.buffer;
        }

        fn addCanonical(self: *@This(), name: *String, err_obj: *Object) !void {
            const class = ZigClassEntry.fromStatic(self);
            const err_struct = fromObject(err_obj);
            const err_value = try self.value_acc.transform(null).get(err_struct.buffer);
            // reference err by integer value
            const err_code = try php.getValueLong(&err_value);
            const err, const is_new = if (php.getHashEntry(class.host.global_error_set, err_code)) |e_ptr|
                .{ e_ptr.*, false }
            else |_|
                .{ php.createValueObject(err_obj), true };
            php.setHashEntryRef(self.error_set, err_code, &err);
            // reference err by name
            php.setHashEntryRef(self.error_set, name, &err);
            // reference err by message
            const message = createDecamelizedMessage(name);
            php.setHashEntryRef(self.error_set, message, &err);
            if (is_new) {
                php.setHashEntryRef(class.host.global_error_set, name, &err);
                php.setHashEntryRef(class.host.global_error_set, err_code, &err);
                php.setHashEntryRef(class.host.global_error_set, message, &err);
                // attach canonical info to err
                const props = try php.allocator.create(Canonical);
                props.* = .{ .message = message };
                err_struct.canonical = props;
            }
        }
    };

    pub fn readSelf(self: *@This(), transform: ObjectTransform) !Value {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        const err_value = try static.value_acc.get(self.buffer);
        if (transform == .to_value) return err_value;
        const err_obj = try php.getValueObject(&err_value);
        defer php.release(err_obj);
        const err_struct = fromObject(err_obj);
        return switch (transform) {
            .to_value => unreachable,
            .to_plain => create: {
                const props = err_struct.canonical.?;
                const message = php.useString(props.message, "");
                const message_value = php.createValueString(message);
                const ht = php.createArray();
                php.setHashEntry(ht, "message", &message_value);
                var value = php.createValueArray(ht);
                try php.convertValue(&value, .object);
                break :create value;
            },
            .to_string => create: {
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
                break :create php.createValueStringContent(text);
            },
            .to_integer => try static.value_acc.transform(null).get(err_struct.buffer),
            .to_bytes => try self.returnBytes(),
        };
    }

    pub fn writeSelf(self: *@This(), value: *const Value) !void {
        if (try self.copySelf(value)) return;
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        try static.value_acc.set(self.buffer, value);
    }

    pub fn acquireDebugInfo(self: *@This()) !void {
        const props = self.canonical orelse return error.Unexpected;
        if (props.trace) |a| php.release(a);
        errdefer props.trace = null;
        props.trace = try php.getBacktrace();
        if (props.file) |s| php.release(s);
        props.file = php.getCurrentFile();
        props.lineno = php.getCurrentLine();
    }

    pub fn freeObject(obj: *Object) void {
        const self = fromObject(obj);
        if (self.canonical == null or self.canonical.?.unknown) {
            const class = ZigClassEntry.fromObject(obj);
            class.release();
        }
        if (self.canonical) |props| {
            props.release();
        }
        Super.freeObject(obj);
    }

    pub fn readProperty(obj: *Object, name: *String, prop_type: c_int, cache_slot: ?[*]?*anyopaque, retval: *Value) !*Value {
        const self = fromObject(obj);
        const err_value = try self.readSelf(.to_value);
        const err_obj = try php.getValueObject(&err_value);
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
            return try Super.readProperty(obj, name, prop_type, cache_slot, retval);
        }
        return retval;
    }

    pub fn writeProperty(obj: *Object, name: *String, value: *Value, cache_slot: ?[*]?*anyopaque) !*Value {
        const self = fromObject(obj);
        const err_value = try self.readSelf(.to_value);
        const err_obj = try php.getValueObject(&err_value);
        const err_struct = fromObject(err_obj);
        const props = err_struct.canonical.?;
        const name_c = php.getStringContent(name);
        if (std.mem.eql(u8, name_c, "string")) {
            const new_str = try php.getValueString(value);
            if (props.string) |s| php.release(s);
            props.string = new_str;
            php.addRef(new_str);
        } else {
            return try Super.writeProperty(obj, name, value, cache_slot);
        }
        return value;
    }

    pub fn getMethod(obj_ptr: *[*c]Object, name: *String, _: ?*const Value) !?*Function {
        const obj = obj_ptr.*;
        const class = ZigClassEntry.fromObject(obj);
        const static = class.getStaticData(@This());
        const name_s = php.getStringContent(name);
        inline for (std.meta.fields(@FieldType(Static, "closures"))) |field| {
            if (std.mem.eql(u8, name_s, field.name))
                return @field(static.closures, field.name).function();
        }
        return null;
    }

    pub fn getMessage(_: *Static, arg_iter: *ArgumentIterator) !?Value {
        const props = try getProperites(arg_iter.this);
        const message = php.useString(props.message, "");
        return php.createValueString(message);
    }

    pub fn getCode(static: *Static, arg_iter: *ArgumentIterator) !?Value {
        const obj = try php.getValueObject(arg_iter.this);
        const self = fromObject(obj);
        return try static.value_acc.get(self.buffer);
    }

    pub fn getFile(_: *Static, arg_iter: *ArgumentIterator) !?Value {
        const props = try getProperites(arg_iter.this);
        const file = php.useString(props.file, "(unknown)");
        return php.createValueString(file);
    }

    pub fn getLine(_: *Static, arg_iter: *ArgumentIterator) !?Value {
        const props = try getProperites(arg_iter.this);
        return php.createValueLong(@intCast(props.lineno));
    }

    pub fn getTrace(_: *Static, arg_iter: *ArgumentIterator) !?Value {
        const props = try getProperites(arg_iter.this);
        const trace = php.useArray(props.trace);
        return php.createValueArray(trace);
    }

    pub fn getTraceAsString(_: *Static, arg_iter: *ArgumentIterator) !?Value {
        const props = try getProperites(arg_iter.this);
        const trace = php.useArray(props.trace);
        const trace_str = php.traceToString(trace, true);
        return php.createValueString(trace_str);
    }

    pub fn getPrevious(_: *Static, _: *ArgumentIterator) !?Value {
        return php.createValueNull();
    }

    fn getProperites(err: *Value) !*Canonical {
        const obj = try php.getValueObject(err);
        const self = fromObject(obj);
        return self.canonical.?;
    }

    pub const setStorage = Super.setStorage;
    pub const getExtent = Super.getExtent;
    pub const copyArguments = Super.copyArguments;
    pub const castObject = Super.castObject;
    pub const hasProperty = Super.hasProperty;
    pub const getReferencedObjects = Super.getReferencedObjects;
    const fromObject = Super.fromObject;
    const copySelf = Super.copySelf;
    const returnBytes = Super.returnBytes;
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
    var buffer = @constCast(php.getStringContent(message));
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
    // set sentinel
    buffer.len += 1;
    buffer[len] = 0;
    return message;
}
