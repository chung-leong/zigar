const std = @import("std");

const accessor = @import("../accessor.zig");
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const cache = @import("../cache.zig");
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const failure = @import("../failure.zig");
const Error = failure.Error;
const ArrayBuffer = @import("../js-compat.zig").ArrayBuffer;
const php = @import("../php.zig");
const N = php.getStaticString;
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

    pub const Super = structure.Parent(@This());
    pub const Static = struct {
        constant_acc: *accessor.Constant = undefined,
        error_set: *HashTable = undefined,
        methods: Methods = undefined,

        pub fn init(self: *@This(), class_obj: *Object) !void {
            const class = ZigClassEntry.fromObject(class_obj);
            const member = try class.getMember(.instance, 0);
            if (member.accessors != .constant) return error.Unexpected;
            self.constant_acc = &member.accessors.constant;
            // all error set types references the global set (to check whether an error object has
            // been created already for another set)
            const global_set = if (class.host.global_error_set) |ht| php.reuse(ht) else create: {
                const ht = php.createArray();
                class.host.global_error_set = ht;
                break :create ht;
            };
            if (class.flags.error_set.is_global) {
                self.error_set = global_set;
            } else {
                // since the static template table owns the error objects already, don't
                // create additional references
                self.error_set = php.createNonDestructiveArray();
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
            self.methods = .{
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
            const global_set = class.host.global_error_set.?;
            if (self.error_set != global_set) {
                php.release(self.error_set);
            }
            // the global set should have been picked up by gc already
            if (!php.isGarbage(global_set)) {
                php.release(global_set);
            }
        }

        pub fn castValue(self: *@This(), value: *Value) !?Value {
            switch (php.getValueType(value)) {
                .long, .string => return self.findCanonical(value) catch php.createValueNull(),
                .object => {
                    const obj = php.getValueObject(value) catch unreachable;
                    if (obj.ce == php.getClassEntry(.standard)) {
                        const ht = php.getValueHashTable(value) catch unreachable;
                        if (php.getHashEntry(ht, "error") catch null) |msg| {
                            return try self.castValue(msg);
                        }
                    } else if (php.instanceOf(obj, ArrayBuffer.entry())) {
                        return null; // allow default handling
                    }
                },
                else => {},
            }
            const value_d = php.createValueDebug(value);
            defer php.release(&value_d);
            return failure.report("casting operation requires an interger, string, object, or ArrayBuffer as argument, received {s}", .{
                php.getValueStringContent(&value_d) catch unreachable,
            });
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

        pub fn findCanonical(self: *@This(), key: *const Value) !Value {
            const class = ZigClassEntry.fromStatic(self);
            return switch (php.getValueType(key)) {
                .long => {
                    const err_code = php.getValueLong(key) catch unreachable;
                    if (err_code == 0) return php.createValueNull();
                    if (php.getHashEntry(self.error_set, err_code)) |err| return php.reuse(err).* else |_| {
                        // create new error
                        const err_obj = try class.createObject(null, null, false);
                        const err_struct = fromObject(err_obj);
                        try self.constant_acc.int.set(err_struct, key);
                        err_struct.buffer.protect();
                        var text_buffer: [64]u8 = undefined;
                        const text = std.fmt.bufPrint(&text_buffer, "UnknownError #{d}", .{err_code}) catch unreachable;
                        const name = php.createString(text);
                        try self.addCanonical(name, err_obj);
                        defer php.release(name);
                        // add object to template table, which owns the other items as well
                        var err_value = php.createValueObject(err_obj);
                        var table = class.static.template.table orelse init: {
                            const new_table = php.createValueArray(null);
                            class.static.template.table = new_table;
                            break :init new_table;
                        };
                        try php.addElementRef(&table, &err_value);
                        // err_obj should have refcount = 5 at this point
                        return php.createValueObject(err_obj);
                    }
                },
                .string => {
                    const name = php.getValueString(key) catch unreachable;
                    if (php.getHashEntry(self.error_set, name) catch null) |err| {
                        return php.reuse(err).*;
                    } else if (php.getHashEntry(self.error_set, N("Unexpected")) catch null) |err| {
                        return php.reuse(err).*;
                    } else {
                        const es_name = try self.createCanonicalName();
                        defer php.allocator.free(es_name);
                        return failure.report("'{s}' does not correspond to an entry in {s}", .{
                            php.getStringContent(name),
                            es_name,
                        });
                    }
                },
                .object => {
                    const err_obj = php.getValueObject(key) catch unreachable;
                    if (err_obj.ce == class.entry()) {
                        php.addRef(err_obj);
                        return key.*;
                    }
                    if (php.instanceOf(err_obj, php.getInterface(.throwable))) {
                        if (ZigClassEntry.isZigError(err_obj)) {
                            php.addRef(err_obj);
                            return key.*;
                        } else {
                            const method = php.createValueString(N("getMessage"));
                            const message = try php.invokeMethod(key, &method, &.{});
                            defer php.release(&message);
                            return self.findCanonical(&message);
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

        pub fn findCanonicalInt(self: *@This(), value: *const Value) !Value {
            if (php.isValueNull(value)) return php.createValueLong(0);
            const err = try self.findCanonical(value);
            const err_obj = try php.getValueObject(&err);
            defer php.release(err_obj);
            const err_struct = fromObject(err_obj);
            return self.constant_acc.int.get(err_struct);
        }

        fn addCanonical(self: *@This(), name: *String, err_obj: *Object) !void {
            const class = ZigClassEntry.fromStatic(self);
            const err_struct = fromObject(err_obj);
            const err_value = try self.constant_acc.int.get(err_struct);
            // reference err by integer value
            const err_code = try php.getValueLong(&err_value);
            const global_set = class.host.global_error_set.?;
            const err, const message, const is_new = get: {
                if (php.getHashEntry(global_set, err_code)) |existing_value| {
                    // use error object created earlier for a different error set
                    const existing_obj = php.getValueObject(existing_value) catch unreachable;
                    const existing_struct = fromObject(existing_obj);
                    break :get .{
                        existing_value.*,
                        existing_struct.canonical.?.message,
                        false,
                    };
                } else |_| {
                    break :get .{
                        php.createValueObject(err_obj),
                        createDecamelizedMessage(name),
                        true,
                    };
                }
            };
            if (self.error_set != global_set) {
                php.setHashEntry(self.error_set, err_code, &err);
                // reference err by name
                php.setHashEntry(self.error_set, name, &err);
                // reference err by message
                php.setHashEntry(self.error_set, message, &err);
            }
            if (is_new) {
                // add error to global error setl; it maintains strong references on the items it hold
                // so we need to bump the ref count
                php.setHashEntryRef(global_set, name, &err);
                php.setHashEntryRef(global_set, err_code, &err);
                php.setHashEntryRef(global_set, message, &err);
                // attach canonical info to err
                const canonical = try php.allocator.create(Canonical);
                canonical.* = .{ .message = message };
                err_struct.canonical = canonical;
            }
        }
    };

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
    const PropCache = cache.IdCache(.{ .string, .file, .line }, "", .{});

    pub fn getValue(self: *@This(), transform: accessor.Transform) !Value {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        return switch (transform) {
            .none => try static.constant_acc.get(self.buffer),
            .string => try self.getMessage(),
            .plain => get: {
                const msg = try self.getMessage();
                const ht = php.createArray();
                php.setHashEntry(ht, "error", &msg);
                var value = php.createValueArray(ht);
                // convert to stdclass
                try php.convertValue(&value, .object);
                break :get value;
            },
            .integer => try static.constant_acc.int.get(self),
            .boolean => php.createValueBool(true),
            else => return error.Unsupported,
        };
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

    pub fn getProperty(self: *@This(), name: *String, cache_slot: ?[*]?*anyopaque) Error!Value {
        const canonical = try self.getCanonical();
        if (PropCache.idFromString(name, cache_slot)) |id| {
            const value = switch (id) {
                .string => php.createValueString(canonical.string orelse php.createString("")),
                .file => php.createValueString(canonical.file orelse N("unknown")),
                .line => php.createValueLong(@intCast(canonical.lineno)),
            };
            return php.reuse(&value).*;
        } else {
            return Super.getProperty(self, name, cache_slot);
        }
    }

    pub fn setProperty(self: *@This(), name: *String, value: *Value, cache_slot: ?[*]?*anyopaque) Error!void {
        const canonical = try self.getCanonical();
        if (PropCache.idFromString(name, cache_slot)) |id| {
            switch (id) {
                .string => {
                    const new_str = try php.getValueString(value);
                    if (canonical.string) |s| php.release(s);
                    canonical.string = php.reuse(new_str);
                    return;
                },
                .file, .line => return error.WriteProtected,
            }
        } else {
            return try Super.setProperty(self, name, value, cache_slot);
        }
    }

    pub fn propertyExists(self: *@This(), name: *String, cache_slot: ?[*]?*anyopaque) bool {
        return PropCache.idFromString(name, cache_slot) != null or Super.propertyExists(self, name, cache_slot);
    }

    pub fn acquireDebugInfo(self: *@This()) !void {
        const canonical = self.canonical orelse return error.Unexpected;
        if (canonical.trace) |a| php.release(a);
        errdefer canonical.trace = null;
        canonical.trace = try php.getBacktrace();
        if (canonical.file) |s| php.release(s);
        canonical.file = php.getCurrentFile();
        canonical.lineno = php.getCurrentLine();
    }

    pub fn stringify(self: *@This()) !Value {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        var value = try static.constant_acc.get(self.buffer);
        const err_obj = try php.getValueObject(&value);
        defer php.release(err_obj);
        const err_struct = fromObject(err_obj);
        const canonical = err_struct.canonical.?;
        const message = canonical.message;
        const file = canonical.file orelse N("unknown");
        const trace = canonical.trace orelse php.empty_array;
        var text: []const u8 = undefined;
        if (php.getHashLength(trace) == 0) {
            text = try std.fmt.allocPrint(php.allocator,
                \\ZigError: {s} in {s}:{d}
            , .{
                php.getStringContent(message),
                php.getStringContent(file),
                canonical.lineno,
            });
        } else {
            const trace_str = php.traceToString(@constCast(trace), true);
            defer php.release(trace_str);
            text = try std.fmt.allocPrint(php.allocator,
                \\ZigError: {s} in {s}:{d}
                \\Stack trace:
                \\{s}
            , .{
                php.getStringContent(message),
                php.getStringContent(file),
                canonical.lineno,
                php.getStringContent(trace_str),
            });
        }
        defer php.allocator.free(text);
        return php.createValueStringContent(text);
    }

    pub fn freeObject(obj: *Object) void {
        const self = fromObject(obj);
        if (self.canonical) |canonical| {
            canonical.release();
        }
        Super.freeObject(obj);
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

    pub fn getPropertiesFor(obj: *Object, purpose_i: c_uint) !*HashTable {
        const purpose: php.PropPurpose = @enumFromInt(purpose_i);
        const self = fromObject(obj);
        const ht = php.createArray();
        switch (purpose) {
            .debug, .json => {
                const msg = try self.getMessage();
                php.setHashEntry(ht, "error", &msg);
            },
            else => {},
        }
        return ht;
    }

    pub fn compare(a: *Value, b: *Value) !c_int {
        const obj_a = php.getValueObject(a) catch return -1;
        if (php.getValueType(b) == .string) {
            const struct_a = fromObject(obj_a);
            const canonical_a = try struct_a.getCanonical();
            const sc_a = php.getStringContent(canonical_a.message);
            const sc_b = php.getValueStringContent(b) catch unreachable;
            return switch (std.mem.order(u8, sc_a, sc_b)) {
                .lt => -1,
                .gt => 1,
                .eq => 0,
            };
        }
        const obj_b = php.getValueObject(b) catch return 1;
        if (obj_a == obj_b) return 0;
        if (obj_a.ce != obj_b.ce) {
            return if (@intFromPtr(obj_a.ce) < @intFromPtr(obj_b.ce)) -1 else 1;
        }
        const class = ZigClassEntry.fromObject(obj_a);
        const static = class.getStaticData(@This());
        const struct_a = fromObject(obj_a);
        const struct_b = fromObject(obj_b);
        const value_a = try static.constant_acc.int.get(struct_a);
        const value_b = try static.constant_acc.int.get(struct_b);
        return php.compareValues(&value_a, &value_b);
    }

    pub fn handleGetMessage(ed: *ExecuteData, return_value: *Value) !void {
        const canonical = try getCanonicalFromValue(&ed.This);
        return_value.* = php.createValueString(canonical.message);
    }

    pub fn handleGetCode(ed: *ExecuteData, return_value: *Value) !void {
        const obj = try php.getValueObject(&ed.This);
        const self = fromObject(obj);
        const class = ZigClassEntry.fromObject(obj);
        const static = class.getStaticData(@This());
        return_value.* = try static.constant_acc.get(self.buffer);
    }

    pub fn handleGetFile(ed: *ExecuteData, return_value: *Value) !void {
        const canonical = try getCanonicalFromValue(&ed.This);
        const file = canonical.file orelse N("unknown");
        return_value.* = php.createValueString(file);
    }

    pub fn handleGetLine(ed: *ExecuteData, return_value: *Value) !void {
        const canonical = try getCanonicalFromValue(&ed.This);
        return_value.* = php.createValueLong(@intCast(canonical.lineno));
    }

    pub fn handleGetTrace(ed: *ExecuteData, return_value: *Value) !void {
        const canonical = try getCanonicalFromValue(&ed.This);
        const trace = canonical.trace orelse php.empty_array;
        return_value.* = php.createValueArray(@constCast(trace));
        php.addRef(return_value);
    }

    pub fn handleGetTraceAsString(ed: *ExecuteData, return_value: *Value) !void {
        const canonical = try getCanonicalFromValue(&ed.This);
        const trace = canonical.trace orelse php.empty_array;
        const trace_str = php.traceToString(@constCast(trace), true);
        return_value.* = php.createValueString(trace_str);
    }

    pub fn handleGetPrevious(_: *ExecuteData, return_value: *Value) !void {
        return_value.* = php.createValueNull();
    }

    fn getMessage(self: *@This()) !Value {
        const canonical = try self.getCanonical();
        const message = canonical.message;
        return php.createValueString(message);
    }

    fn getCanonical(self: *@This()) Error!*Canonical {
        if (self.canonical) |c| return c;
        const err_value = try self.getValue(.none);
        defer php.release(&err_value);
        const err_obj = try php.getValueObject(&err_value);
        const err_struct = fromObject(err_obj);
        return err_struct.canonical.?;
    }

    fn getCanonicalFromValue(err: *Value) !*Canonical {
        const obj = try php.getValueObject(err);
        const self = fromObject(obj);
        return self.getCanonical();
    }

    pub const getExtent = Super.getExtent;
    pub const setStorage = Super.setStorage;
    pub const initialize = Super.initialize;
    pub const finalize = Super.finalize;
    pub const externalize = Super.externalize;
    pub const checkArguments = Super.checkArguments;
    pub const visitPointers = Super.visitPointers;
    pub const getConstructor = Super.getConstructor;
    pub const castObject = Super.castObject;
    pub const readProperty = Super.readProperty;
    pub const writeProperty = Super.writeProperty;
    pub const hasProperty = Super.hasProperty;
    pub const getProperties = Super.getProperties;
    pub const getPropertyPointer = Super.getPropertyPointer;
    pub const getGarbageCollection = Super.getGarbageCollection;
    pub const fromObject = Super.fromObject;
    pub const fromValue = Super.fromValue;
    const copySelf = Super.copySelf;
};

fn createDecamelizedMessage(name_obj: *const String) *String {
    const name = php.getStringContent(name_obj);
    var len_required: usize = 0;
    for (name, 0..) |c, i| {
        if (std.ascii.isUpper(c)) {
            len_required += if (i > 0) 2 else 1;
        } else {
            len_required += 1;
        }
    }
    const message = php.createStringWithLength(len_required);
    var buffer = @constCast(php.getStringContent(message));
    var len: usize = 0;
    for (name, 0..) |c, i| {
        if (std.ascii.isUpper(c)) {
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
    buffer.ptr[len] = 0;
    return message;
}
