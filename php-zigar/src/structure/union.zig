const std = @import("std");

const accessor = @import("../accessor.zig");
const Transform = accessor.Transform;
const Error = accessor.Error;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const failure = @import("../failure.zig");
const iterator = @import("../iterator.zig");
const ZigObject = @import("../object.zig").ZigObject;
const php = @import("../php.zig");
const ClassEntry = php.ClassEntry;
const HashTable = php.HashTable;
const HashTableIterator = php.HashTableIterator;
const Object = php.Object;
const ObjectIterator = php.ObjectIterator;
const String = php.String;
const Value = php.Value;
const structure = @import("../structure.zig");
const Class = structure.Class;

pub const Union = struct {
    table: Value = undefined,
    buffer: *ByteBuffer = undefined,

    const Super = structure.StructLike(@This());
    const MemberCacheEntry = Super.MemberCacheEntry;

    pub const Static = struct {
        prop_names: []*String = &.{},
        selector: ?struct {
            class: *ZigClassEntry,
            accessors: *accessor.Any,
            possible_values: HashTable,
        } = null,

        pub fn init(self: *@This(), class_obj: *Object) !void {
            const class = ZigClassEntry.fromObject(class_obj);
            var iter = class.getMemberIterator(.instance);
            // look for selector
            const selector_member = while (iter.next()) |member| {
                if (member.flags.is_selector) break member;
            } else null;
            if (selector_member) |sm| {
                const sel_slots = switch (sm.class.type) {
                    .@"enum" => sm.class.getStaticData(structure.Enum).available_tags,
                    else => null,
                };
                // go through the list of members again and get the possible selector values
                var sel_ht = php.createHashTable(php.destructor.value);
                var index: c_long = 0;
                iter.reset();
                while (iter.next()) |member| {
                    if (member.flags.is_selector) continue;
                    if (member.accessors == .property) continue;
                    const member_name = iter.currentName().?;
                    if (sel_slots) |*ht| {
                        const enum_value = try php.getHashEntry(ht, member_name);
                        php.setHashEntry(&sel_ht, member_name, enum_value);
                    } else {
                        const int_value = php.createValueLong(index);
                        php.setHashEntry(&sel_ht, member_name, &int_value);
                    }
                    index += 1;
                }
                self.selector = .{
                    .accessors = &sm.accessors,
                    .class = sm.class,
                    .possible_values = sel_ht,
                };
            }
            // create list of prop names
            self.prop_names = try class.createPropertyList(.instance);
        }

        pub fn deinit(self: *@This()) void {
            if (self.selector) |*selector| {
                php.destroyHashTable(&selector.possible_values);
            }
            if (self.prop_names.len > 0) php.allocator.free(self.prop_names);
        }

        pub fn getEnumClass(self: *@This()) ?*ZigClassEntry {
            if (self.selector) |sel| {
                if (sel.class.type == .@"enum") return sel.class;
            }
            return null;
        }

        pub fn getEnum(self: *@This(), obj: *Object) !Value {
            const sel = self.selector orelse return error.Unexpected;
            const union_struct = ZigObject(Union).fromObject(obj).structure();
            return try sel.accessors.get(union_struct);
        }
    };

    pub fn initialize(self: *@This(), allocator: ?*const std.mem.Allocator, initializer: ?*const Value, read_only: bool) !void {
        const class = ZigClassEntry.fromStructure(self);
        if (class.flags.@"union".has_inaccessible) {
            // allocate structure without copying initializer
            try Super.initialize(self, allocator, null, read_only);
            // mark pointers as inaccessible
            try self.visitPointers(structure.Pointer.restrictAccess, .{}, .{ .include_inactive = true });
            // now we can copy
            if (initializer) |value| try self.setValue(value, .none);
        } else {
            try Super.initialize(self, allocator, initializer, read_only);
        }
    }

    pub fn finalize(self: *@This(), init_called: bool) !void {
        if (!init_called) {
            const class = ZigClassEntry.fromStructure(self);
            if (class.flags.@"union".has_inaccessible) {
                try self.visitPointers(structure.Pointer.restrictAccess, .{}, .{ .include_inactive = true });
            }
        }
    }

    pub fn setValue(self: *@This(), value: *const Value, transform: accessor.Transform) Error!void {
        if (transform == .none) {
            if (try self.copySelf(value)) return;
            const ht = try php.getValueHashTable(value);
            var iter: HashTableIterator = .init(ht, .{});
            if (iter.len != 1) {
                return failure.report("union can only have 1 active field, received {d} initializers", .{
                    iter.len,
                });
            }
            const field_value = iter.next().?;
            const name = iter.currentName() orelse return error.KeyIsNotString;
            self.setProperty(name, field_value, null) catch |err| {
                return self.reportFieldError(name, .write, err);
            };
            const class = ZigClassEntry.fromStructure(self);
            const static = class.getStaticData(@This());
            if (static.selector) |selector| {
                const sel_value = try php.getHashEntry(&selector.possible_values, name);
                try selector.accessors.set(self, sel_value);
            }
        } else {
            try Super.setValue(self, value, transform);
        }
    }

    pub fn visitPointers(self: *@This(), cb: anytype, args: anytype, comptime options: structure.VisitOptions) accessor.Error!void {
        const class = ZigClassEntry.fromStructure(self);
        if (class.flags.common.has_pointer) {
            const static = class.getStaticData(@This());
            const selector = static.selector orelse return error.Unexpected;
            const active_sel_value = switch (options.include_inactive) {
                false => try selector.accessors.get(self),
                true => undefined,
            };
            var iter = class.getMemberIterator(.instance);
            while (iter.next()) |member| {
                if (iter.currentName()) |name| {
                    if (member.class.flags.common.has_pointer) {
                        const run = options.include_inactive or match: {
                            const sel_value = try php.getHashEntry(&selector.possible_values, name);
                            break :match compareSelectors(sel_value, &active_sel_value);
                        };
                        if (run) {
                            const value = try member.accessors.getEx(self, null);
                            defer php.release(&value);
                            const obj = php.getValueObject(&value) catch continue;
                            try structure.invokeMethod(obj, "visitPointers", .{ cb, args, options });
                            if (!options.include_inactive) break;
                        }
                    }
                }
            }
        }
    }

    pub fn readProperty(obj: *Object, name: *String, prop_type: c_int, cache_slot: ?[*]?*anyopaque, retval: *Value) *Value {
        const self = fromObject(obj);
        self.checkSelector(name, cache_slot) catch |err| {
            const class = ZigClassEntry.fromObject(obj);
            retval.* = php.createValueNull();
            if (err != error.InactiveField or !class.flags.@"union".has_tag) {
                // when the union is untagged, it isn't possible to determine programmatically
                // whether a field is set or not when optimize is release; the selector is only
                // available for debug purpose; throwing an error because the operation is illegal
                _ = &self.reportFieldError(name, .read, err);
            }
            return retval;
        };
        return Super.readProperty(obj, name, prop_type, cache_slot, retval);
    }

    pub fn writeProperty(obj: *Object, name: *String, value: *Value, cache_slot: ?[*]?*anyopaque) !*Value {
        const self = fromObject(obj);
        self.checkSelector(name, cache_slot) catch |err| {
            return self.reportFieldError(name, .write, err);
        };
        return Super.writeProperty(obj, name, value, cache_slot);
    }

    pub fn getProperties(obj: *Object) !*HashTable {
        const class = ZigClassEntry.fromObject(obj);
        const self = fromObject(obj);
        const ht = php.createArray();
        var iter = class.getMemberIterator(.instance);
        if (class.flags.@"union".has_tag) {
            // tagged unions return only the active member
            const tag_name = try self.getActiveTagName();
            const member = try class.getMember(.instance, tag_name);
            const value = try member.accessors.get(self);
            php.setHashEntry(ht, tag_name, &value);
        } else {
            // where as untagged ones return all members
            while (iter.next()) |member| {
                if (iter.currentName()) |name| {
                    var value = try member.accessors.get(self);
                    errdefer php.release(&value);
                    php.setHashEntry(ht, name, &value);
                }
            }
        }
        // caller seem to expect a hash table with zero refcount
        ht.gc.refcount = 0;
        return ht;
    }

    pub fn getIterator(obj: *Object) !?*ObjectIterator {
        const class = ZigClassEntry.fromObject(obj);
        const static = class.getStaticData(@This());
        const self = fromObject(obj);
        const active_list = try self.getActiveTagNameList();
        return try iterator.PropertyIterator(@This()).create(obj, active_list, static.prop_names);
    }

    fn getActiveTagNameList(self: *@This()) ![]*String {
        const class = ZigClassEntry.fromStructure(self);
        if (!class.flags.@"union".has_tag) return &.{};
        const static = class.getStaticData(@This());
        const selector = static.selector orelse return error.Unexpected;
        const active_sel_value = try selector.accessors.get(self);
        const tag_obj = try php.getValueObject(&active_sel_value);
        const tag_class = ZigClassEntry.fromObject(tag_obj);
        if (tag_class.type != .@"enum") return error.Unexpected;
        const tag_struct = ZigObject(structure.Enum).fromObject(tag_obj).structure();
        const props = tag_struct.canonical orelse return error.Unexpected;
        const name_many_ptr: [*]*String = @ptrCast(&props.name);
        return name_many_ptr[0..1];
    }

    fn getActiveTagName(self: *@This()) !*String {
        const list = try self.getActiveTagNameList();
        return list[0];
    }

    fn checkSelector(self: *@This(), name: *String, cache_slot: ?[*]?*anyopaque) !void {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        const selector = static.selector orelse return;
        // don't check if the name is a special property
        if (findTransform(name, cache_slot)) |_| return;
        if (self.findMember(name, cache_slot)) |member| {
            if (member.accessors == .property) return;
            const sel_value: *Value = get: {
                // look for cache entry left by findMember()
                const entry = MemberCacheEntry.findSelf(cache_slot, class);
                if (entry) |e| {
                    // the selector value is stored in the extra pointer
                    if (e.extra) |ptr| break :get @ptrCast(@alignCast(ptr));
                }
                const value = try php.getHashEntry(&selector.possible_values, name);
                if (entry) |e| {
                    e.extra = value;
                }
                break :get value;
            };
            const active_sel_value = try selector.accessors.get(self);
            if (!compareSelectors(sel_value, &active_sel_value)) return error.InactiveField;
        }
    }

    fn compareSelectors(sel1: *const Value, sel2: *const Value) bool {
        return switch (php.getValueType(sel1)) {
            .long => sel1.value.lval == sel2.value.lval,
            .object => sel1.value.obj == sel2.value.obj,
            else => unreachable,
        };
    }

    fn reportFieldError(self: *@This(), name: *String, access: accessor.FieldAccess, err: anytype) error{ ExceptionThrown, Unexpected } {
        const member = self.findMember(name, null);
        if (member != null and err == error.InactiveField) {
            const active_name = self.getActiveTagName() catch return error.Unexpected;
            return failure.report("access of union field '{s}' while field '{s}' is active", .{
                php.getStringContent(name),
                php.getStringContent(active_name),
            });
        } else {
            return Super.reportFieldError(self, name, access, err);
        }
    }

    pub const setStorage = Super.setStorage;
    pub const externalize = Super.externalize;
    pub const getExtent = Super.getExtent;
    pub const checkArguments = Super.checkArguments;
    pub const getValue = Super.getValue;
    pub const getProperty = Super.getProperty;
    pub const setProperty = Super.setProperty;
    pub const freeObject = Super.freeObject;
    pub const castObject = Super.castObject;
    pub const getMethod = Super.getMethod;
    pub const hasProperty = Super.hasProperty;
    pub const getPropertyPointer = Super.getPropertyPointer;
    pub const getGarbageCollection = Super.getGarbageCollection;
    const fromObject = Super.fromObject;
    const copySelf = Super.copySelf;
    const returnSelf = Super.returnSelf;
    const returnBytes = Super.returnBytes;
    const findMember = Super.findMember;
    const findTransform = Super.findTransform;
};
