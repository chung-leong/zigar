const std = @import("std");

const accessor = @import("../accessor.zig");
const Transform = accessor.Transform;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const cache = @import("../cache.zig");
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const ZigObject = @import("../object.zig").ZigObject;
const php = @import("../php.zig");
const HashTableIterator = php.HashTableIterator;
const Object = php.Object;
const String = php.String;
const Value = php.Value;
const structure = @import("../structure.zig");

pub const Slice = struct {
    table: Value = undefined,
    buffer: *ByteBuffer = undefined,

    pub const Super = structure.ArrayLike(@This());
    pub const Static = struct {
        value_acc: *accessor.Any = undefined,
        element_class: *ZigClassEntry = undefined,
        element_size: usize = undefined,
        element_shift: ?u6 = undefined,

        pub const StaticPropCache = cache.IdCache(.{.child}, "__", .{});

        pub fn init(self: *@This(), class_obj: *Object) !void {
            const class = ZigClassEntry.fromObject(class_obj);
            const member = try class.getMember(.instance, 0);
            self.value_acc = &member.accessors;
            self.element_class = member.class;
            self.element_size = class.byte_size orelse 1;
            self.element_shift = init: {
                const shift = std.math.log2_int(usize, self.element_size);
                const one: usize = 1;
                break :init if (one << shift == self.element_size) shift else null;
            };
        }

        pub fn getStaticProperty(self: *@This(), name: *String, cache_slot: ?[*]?*anyopaque) !Value {
            if (StaticPropCache.idFromString(name, cache_slot)) |id| {
                return switch (id) {
                    .child => get: {
                        php.addRef(self.element_class.object);
                        break :get php.createValueObject(self.element_class.object);
                    },
                };
            } else {
                return error.Missing;
            }
        }

        pub fn staticPropertyExists(_: *@This(), name: *String, cache_slot: ?[*]?*anyopaque) bool {
            return StaticPropCache.idFromString(name, cache_slot) != null;
        }
    };

    pub fn initialize(self: *@This(), allocator: ?*const std.mem.Allocator, initializer: ?*const Value, read_only: bool) !void {
        const class = ZigClassEntry.fromStructure(self);
        if (initializer) |value| {
            // anyopaque is represented by a slice with no size
            const element_size = class.byte_size orelse 1;
            const value_type = php.getValueType(value);
            if (value_type == .string and class.flags.slice.is_string) {
                const str = php.getValueString(value) catch unreachable;
                const str_bytes = php.getStringContent(str);
                if (element_size == 1) {
                    if (read_only) {
                        self.buffer.referenceString(str);
                    } else {
                        try self.buffer.allocate(allocator, str_bytes.len);
                        try self.buffer.copyBytes(str_bytes);
                    }
                } else if (element_size == 2) {
                    const len = std.unicode.calcWtf16LeLen(str_bytes) catch return error.IncorrectEncoding;
                    try self.buffer.allocate(allocator, len * 2);
                    const bytes = try self.buffer.data(0, true);
                    const wtf16_ptr: [*]u16 = @ptrCast(@alignCast(bytes.ptr));
                    const wtf16_slice = wtf16_ptr[0..len];
                    _ = std.unicode.wtf8ToWtf16Le(wtf16_slice, str_bytes) catch return error.IncorrectEncoding;
                } else unreachable;
            } else {
                // initialize with an array, let setValue() throw an error if it's not an array
                const len: usize = get: {
                    const arr = php.getValueArray(value) catch break :get 0;
                    const element_count = if (php.isNormalArray(arr)) arr.nNumOfElements else 1;
                    break :get element_size * element_count;
                };
                try self.buffer.allocate(allocator, len);
                try self.setValue(value, .none);
            }
            if (read_only) self.buffer.protect(true);
        } else {
            try self.buffer.allocate(allocator, 0);
        }
    }

    pub fn getExtent(self: *@This()) ByteBuffer.Extent {
        return .{
            .address = @intFromPtr(self.buffer.bytes.ptr),
            .len = self.getLength(),
        };
    }

    pub fn getLength(self: *@This()) usize {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        const len = self.buffer.bytes.len;
        return if (static.element_shift) |shift|
            len >> shift
        else
            len / static.element_size;
    }

    pub fn getElement(self: *@This(), index: usize) !Value {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        return try static.value_acc.getElement(self, index);
    }

    pub fn getElementEx(self: *@This(), index: usize, transform: ?Transform) !Value {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        return try static.value_acc.getElementEx(self, index, transform);
    }

    pub fn setElement(self: *@This(), index: usize, value: *Value) !void {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        try static.value_acc.setElement(self, index, value);
    }

    pub fn setValue(self: *@This(), value: *const Value, transform: accessor.Transform) accessor.Error!void {
        if (transform == .none) {
            if (php.getValueArray(value) catch null) |ht| {
                if (!php.isNormalArray(ht)) {
                    const array = php.createArray();
                    _ = php.appendHashEntryRef(array, value);
                    const array_value = php.createValueArray(array);
                    defer php.release(array);
                    return Super.setValue(self, &array_value, transform);
                }
            }
        }
        return Super.setValue(self, value, transform);
    }

    pub const setStorage = Super.setStorage;
    pub const finalize = Super.finalize;
    pub const externalize = Super.externalize;
    pub const checkArguments = Super.checkArguments;
    pub const getValue = Super.getValue;
    pub const getProperty = Super.getProperty;
    pub const setProperty = Super.setProperty;
    pub const propertyExists = Super.propertyExists;
    pub const visitPointers = Super.visitPointers;
    pub const readElement = Super.readElement;
    pub const writeElement = Super.writeElement;
    pub const hasElement = Super.hasElement;
    pub const countElements = Super.countElements;
    pub const getProperties = Super.getProperties;
    pub const freeObject = Super.freeObject;
    pub const castObject = Super.castObject;
    pub const readProperty = Super.readProperty;
    pub const writeProperty = Super.writeProperty;
    pub const hasProperty = Super.hasProperty;
    pub const getGarbageCollection = Super.getGarbageCollection;
    pub const getIterator = Super.getIterator;
    const fromObject = Super.fromObject;
    const getIndex = Super.getIndex;
};
