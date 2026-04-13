const std = @import("std");

const accessor = @import("../accessor.zig");
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const failure = @import("../failure.zig");
const php = @import("../php.zig");
const Array = php.Array;
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
    const Methods = struct {
        getMessage: Function,
        getCode: Function,
        getFile: Function,
        getLine: Function,
        getTrace: Function,
        getTraceAsString: Function,
        getPrevious: Function,
    };

    pub const Static = struct {
        constant_acc: *accessor.Constant = undefined,
        error_set: *HashTable = undefined,
        methods: *Methods = undefined,

        pub fn init(self: *@This(), class_obj: *Object) !void {
            const class = ZigClassEntry.fromObject(class_obj);
            const member = try class.getMember(.instance, 0);
            if (member.accessors != .constant) return error.Unexpected;
            self.constant_acc = &member.accessors.constant;
            if (class.flags.error_set.is_global) {
                self.error_set = class.host.global_error_set;
            } else {
                const ht_bytes = php.emalloc(@sizeOf(HashTable)) orelse return error.OutOfMemory;
                self.error_set = @ptrCast(@alignCast(ht_bytes));
                self.error_set.* = php.createHashTable(null);
                if (class.static.template.table) |*static_table| {
                    // loop through static members and add errors to error set, keyed by value,
                    // name, and error message
                    var iter = class.getMemberIterator(.static);
                    while (iter.next()) |static_member| {
                        const slot = static_member.slot orelse continue;
                        const err = try php.getProperty(static_table, slot);
                        const err_obj = try php.getValueObject(err);
                        if (ZigClassEntry.fromObject(err_obj).type != .error_set) continue;
                        const name = iter.currentName() orelse return error.MissingName;
                        try self.addCanonical(name, err_obj);
                    }
                }
            }
            self.methods = try php.allocator.create(Methods);
            self.methods.* = .{
                .getMessage = php.createTransformedFunction(handleGetMessage, "getMessage", 0, false),
                .getCode = php.createTransformedFunction(handleGetCode, "getCode", 0, false),
                .getFile = php.createTransformedFunction(handleGetFile, "getFile", 0, false),
                .getLine = php.createTransformedFunction(handleGetLine, "getLine", 0, false),
                .getTrace = php.createTransformedFunction(handleGetTrace, "getTrace", 0, false),
                .getTraceAsString = php.createTransformedFunction(handleGetTraceAsString, "getTraceAsString", 0, false),
                .getPrevious = php.createTransformedFunction(handleGetPrevious, "getPrevious", 0, false),
            };
        }

        pub fn deinit(self: *@This()) void {
            const class = ZigClassEntry.fromStatic(self);
            if (self.error_set != class.host.global_error_set) {
                php.release(self.error_set);
            }
            php.allocator.destroy(self.methods);
        }

        pub fn castValue(self: *@This(), value: *Value) !?Value {
            switch (php.getValueType(value)) {
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
            return switch (php.getValueType(value)) {
                .long => {
                    const err_code = php.getValueLong(value) catch unreachable;
                    if (err_code == 0) return php.createValueNull();
                    if (php.getHashEntry(self.error_set, err_code)) |err| {
                        php.addRef(err);
                        return err.*;
                    } else |_| {
                        // create new error
                        const err_obj = try class.createObject(null, null, false);
                        const err_struct = fromObject(err_obj);
                        try self.constant_acc.int.set(err_struct, value);
                        err_struct.buffer.protect(true);
                        var text_buffer: [64]u8 = undefined;
                        const text = std.fmt.bufPrint(&text_buffer, "UnknownError #{d}", .{err_code}) catch unreachable;
                        const name = php.createString(text);
                        try self.addCanonical(name, err_obj);
                        // add object to template table, which owns the other items as well
                        var err_value = php.createValueObject(err_obj);
                        var table = class.static.template.table orelse init: {
                            const new_table = php.createValueArray(null);
                            class.static.template.table = new_table;
                            break :init new_table;
                        };
                        try php.addElementRef(&table, &err_value);
                        // err_obj should have refcount = 2 at this point
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
                                return failure.report("'{s}' does not correspond to an entry in {s}", .{
                                    try php.getValueStringContent(&message),
                                    name,
                                });
                            }
                        }
                    } else {
                        return failure.report("'{s}' does not implement throwable", .{
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
            const err_value = try self.constant_acc.int.get(err_struct);
            // reference err by integer value
            const err_code = try php.getValueLong(&err_value);
            const global_error_set = class.host.global_error_set;
            const err, const is_new = if (php.getHashEntry(global_error_set, err_code)) |e_ptr|
                .{ e_ptr.*, false }
            else |_|
                .{ php.createValueObject(err_obj), true };
            const message = createDecamelizedMessage(name);
            if (self.error_set != global_error_set) {
                php.setHashEntry(self.error_set, err_code, &err);
                // reference err by name
                php.setHashEntry(self.error_set, name, &err);
                // reference err by message
                php.setHashEntry(self.error_set, message, &err);
            }
            if (is_new) {
                // add error to global error setl; it maintains strong references on the items it hold
                // so we need to bump the ref count
                php.setHashEntryRef(global_error_set, name, &err);
                php.setHashEntryRef(global_error_set, err_code, &err);
                php.setHashEntryRef(global_error_set, message, &err);
                // attach canonical info to err
                const props = try php.allocator.create(Canonical);
                props.* = .{ .message = message };
                err_struct.canonical = props;
            }
        }
    };

    pub fn getValue(self: *@This(), transform: accessor.Transform) !Value {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        switch (transform) {
            .plain, .string => |t| {
                const err_value = try static.constant_acc.get(self.buffer);
                const err_obj = try php.getValueObject(&err_value);
                defer php.release(err_obj);
                const err_struct = fromObject(err_obj);
                const props = err_struct.canonical.?;
                const message = props.message;
                const message_value = php.createValueString(message);
                if (t == .plain) {
                    const ht = php.createArray();
                    php.setHashEntryRef(ht, "message", &message_value);
                    var value = php.createValueArray(ht);
                    try php.convertValue(&value, .object);
                    return value;
                } else if (t == .string) {
                    const file = props.file orelse php.persistent("unknown");
                    const trace = props.trace orelse php.empty_array;
                    const trace_str = php.traceToString(@constCast(trace), true);
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
            },
            .integer => return try static.constant_acc.int.get(self),
            else => {},
        }
        return Super.getValue(self, transform);
    }

    pub fn setValue(self: *@This(), value: *const Value, transform: accessor.Transform) !void {
        if (try self.copySelf(value)) return;
        if (transform == .none) {
            const class = ZigClassEntry.fromStructure(self);
            const static = class.getStaticData(@This());
            try static.constant_acc.set(self.buffer, value);
        } else {
            try Super.setValue(self, value, transform);
        }
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
        if (self.canonical) |props| {
            props.release();
        }
        Super.freeObject(obj);
    }

    pub fn readProperty(obj: *Object, name: *String, prop_type: c_int, cache_slot: ?[*]?*anyopaque, retval: *Value) *Value {
        if (!readErrorProperty(obj, name, prop_type, retval)) {
            return Super.readProperty(obj, name, prop_type, cache_slot, retval);
        }
        return retval;
    }

    pub fn writeProperty(obj: *Object, name: *String, value: *Value, cache_slot: ?[*]?*anyopaque) !*Value {
        if (!try writeErrorProperty(obj, name, value)) {
            return try Super.writeProperty(obj, name, value, cache_slot);
        }
        return value;
    }

    pub fn getMethod(obj_ptr: *[*c]Object, name: *String, _: ?*const Value) !?*Function {
        const obj = obj_ptr.*;
        const class = ZigClassEntry.fromObject(obj);
        const static = class.getStaticData(@This());
        const name_s = php.getStringContent(name);
        inline for (std.meta.fields(Methods)) |field| {
            if (std.mem.eql(u8, name_s, field.name)) {
                return &@field(static.methods, field.name);
            }
        }
        return null;
    }

    pub fn handleGetMessage(ed: *ExecuteData, return_value: *Value) !void {
        const props = try getProperitiesFromValue(&ed.This);
        return_value.* = php.createValueString(props.message);
    }

    pub fn handleGetCode(ed: *ExecuteData, return_value: *Value) !void {
        const obj = try php.getValueObject(&ed.This);
        const self = fromObject(obj);
        const class = ZigClassEntry.fromObject(obj);
        const static = class.getStaticData(@This());
        return_value.* = try static.constant_acc.get(self.buffer);
    }

    pub fn handleGetFile(ed: *ExecuteData, return_value: *Value) !void {
        const props = try getProperitiesFromValue(&ed.This);
        const file = props.file orelse php.persistent("unknown");
        return_value.* = php.createValueString(file);
    }

    pub fn handleGetLine(ed: *ExecuteData, return_value: *Value) !void {
        const props = try getProperitiesFromValue(&ed.This);
        return_value.* = php.createValueLong(@intCast(props.lineno));
    }

    pub fn handleGetTrace(ed: *ExecuteData, return_value: *Value) !void {
        const props = try getProperitiesFromValue(&ed.This);
        const trace = props.trace orelse php.empty_array;
        return_value.* = php.createValueArray(@constCast(trace));
        php.addRef(return_value);
    }

    pub fn handleGetTraceAsString(ed: *ExecuteData, return_value: *Value) !void {
        const props = try getProperitiesFromValue(&ed.This);
        const trace = props.trace orelse php.empty_array;
        const trace_str = php.traceToString(@constCast(trace), true);
        return_value.* = php.createValueString(trace_str);
    }

    pub fn handleGetPrevious(_: *ExecuteData, return_value: *Value) !void {
        return_value.* = php.createValueNull();
    }

    fn readErrorProperty(obj: *Object, name: *String, prop_type: c_int, retval: *Value) bool {
        const props = getProperties(obj) catch return false;
        const name_c = php.getStringContent(name);
        retval.* = if (std.mem.eql(u8, name_c, "string"))
            php.createValueString(props.string orelse php.createString(""))
        else if (std.mem.eql(u8, name_c, "file"))
            php.createValueString(props.file orelse php.persistent("unknown"))
        else if (std.mem.eql(u8, name_c, "line"))
            php.createValueLong(@intCast(props.lineno))
        else
            return false;
        if (prop_type != php.BP_VAR_IS) {
            php.addRef(retval);
        }
        return true;
    }

    fn writeErrorProperty(obj: *Object, name: *String, value: *Value) !bool {
        const props = getProperties(obj) catch return false;
        const name_c = php.getStringContent(name);
        if (std.mem.eql(u8, name_c, "string")) {
            const new_str = try php.getValueString(value);
            if (props.string) |s| php.release(s);
            props.string = new_str;
            php.addRef(new_str);
        } else if (std.mem.eql(u8, name_c, "file") or std.mem.eql(u8, name_c, "line")) {
            return error.WriteProtected;
        } else {
            return false;
        }
        return true;
    }

    fn getProperties(obj: *Object) !*Canonical {
        const self = fromObject(obj);
        if (self.canonical) |c| return c;
        const err_value = try self.getValue(.none);
        defer php.release(&err_value);
        const err_obj = try php.getValueObject(&err_value);
        const err_struct = fromObject(err_obj);
        return err_struct.canonical.?;
    }

    fn getProperitiesFromValue(err: *Value) !*Canonical {
        const obj = try php.getValueObject(err);
        return getProperties(obj);
    }

    pub const getExtent = Super.getExtent;
    pub const setStorage = Super.setStorage;
    pub const initialize = Super.initialize;
    pub const finalize = Super.finalize;
    pub const externalize = Super.externalize;
    pub const checkArguments = Super.checkArguments;
    pub const visitPointers = Super.visitPointers;
    pub const castObject = Super.castObject;
    pub const hasProperty = Super.hasProperty;
    pub const getGarbageCollection = Super.getGarbageCollection;
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
