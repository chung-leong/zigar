const std = @import("std");

const accessor = @import("../accessor.zig");
const Transform = accessor.Transform;
const Error = accessor.Error;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const cache = @import("../cache.zig");
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

    pub const Super = structure.StructLike(@This());
    pub const Static = struct {
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
                var sel_ht = php.createHashTable(null);
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
        }

        pub fn deinit(self: *@This()) void {
            if (self.selector) |*selector| {
                php.destroyHashTable(&selector.possible_values);
            }
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
    pub const MemberCache = cache.MemberCache;
    pub const TransformCache = cache.TransformCache;

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
        try Super.finalize(self, init_called);
    }

    pub fn setValue(self: *@This(), value: *const Value, transform: accessor.Transform) Error!void {
        if (transform == .none) {
            if (try self.copySelf(value)) return;
            const class = ZigClassEntry.fromStructure(self);
            const static = class.getStaticData(@This());
            if (class.purpose == .any_image) {
                const selector = static.selector orelse return error.Unexpected;
                const name = php.persistent("gd");
                try Super.setProperty(self, name, value, null);
                const sel_value = try php.getHashEntry(&selector.possible_values, name);
                try selector.accessors.set(self, sel_value);
                return;
            }
            const ht = try php.getValueHashTable(value);
            var iter: HashTableIterator = .init(ht, .{});
            if (iter.len != 1) {
                return failure.report("union can only have 1 active field, received {d} initializers", .{
                    iter.len,
                });
            }
            const field_value = iter.next().?;
            const name = iter.currentName() orelse return error.KeyIsNotString;
            Super.setProperty(self, name, field_value, null) catch |err| {
                return self.reportFieldError(name, .write, err);
            };
            if (static.selector) |selector| {
                const sel_value = try php.getHashEntry(&selector.possible_values, name);
                try selector.accessors.set(self, sel_value);
            }
        } else {
            try Super.setValue(self, value, transform);
        }
    }

    pub fn getProperty(self: *@This(), name: *String, cache_slot: ?[*]?*anyopaque) accessor.Error!Value {
        self.checkSelector(name, cache_slot) catch |err| {
            const class = ZigClassEntry.fromStructure(self);
            if (err == error.InactiveField) {
                if (class.flags.@"union".has_tag) {
                    return php.createValueNull();
                } else {
                    // when the union is untagged, it isn't possible to determine programmatically
                    // whether a field is set or not when optimize is release; the selector is only
                    // available for debug purpose; throwing an error because the operation is illegal
                    return self.reportFieldError(name, .read, err);
                }
            }
            return @errorCast(err);
        };
        return Super.getProperty(self, name, cache_slot);
    }

    pub fn setProperty(self: *@This(), name: *String, value: *const Value, cache_slot: ?[*]?*anyopaque) !void {
        self.checkSelector(name, cache_slot) catch |err| {
            return self.reportFieldError(name, .write, err);
        };
        return Super.setProperty(self, name, value, cache_slot);
    }

    pub fn isMemberActive(self: *@This(), name: *String, member: *ZigClassEntry.Member) bool {
        const class = ZigClassEntry.fromStructure(self);
        if (class.flags.@"union".has_tag) {
            if (member.accessors == .property) return true;
            self.checkSelector(name, null) catch return false;
        }
        return true;
    }

    pub fn visitPointers(self: *@This(), cb: anytype, args: anytype, comptime options: structure.VisitOptions) accessor.Error!void {
        const class = ZigClassEntry.fromStructure(self);
        if (class.flags.common.has_pointer) {
            const static = class.getStaticData(@This());
            const selector = static.selector orelse return error.Unexpected;
            const active_sel_value = switch (options.include_inactive) {
                false => try selector.accessors.get(self),
                true => php.createValueNull(),
            };
            defer php.release(&active_sel_value);
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

    fn checkSelector(self: *@This(), name: *String, cache_slot: ?[*]?*anyopaque) !void {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        const selector = static.selector orelse return;
        // don't check if the name is a special property
        if (TransformCache.idFromString(name, cache_slot)) |_| return;
        if (self.findMember(name, cache_slot)) |member| {
            if (member.accessors == .property) return;
            const sel_value: *Value = get: {
                // look for cache entry left by findMember()
                const entry = MemberCache.findSelf(cache_slot, class);
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
            defer php.release(&active_sel_value);
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
            const active_name = find: {
                const class = ZigClassEntry.fromStructure(self);
                const static = class.getStaticData(@This());
                const selector = static.selector.?;
                const active_sel_value = selector.accessors.get(self) catch unreachable;
                defer php.release(&active_sel_value);
                var iter: HashTableIterator = .init(&selector.possible_values, .{});
                break :find while (iter.next()) |sel_value| {
                    if (compareSelectors(sel_value, &active_sel_value)) {
                        break iter.currentName().?;
                    }
                } else unreachable;
            };
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
    pub const propertyExists = Super.propertyExists;
    pub const getConstructor = Super.getConstructor;
    pub const freeObject = Super.freeObject;
    pub const castObject = Super.castObject;
    pub const getMethod = Super.getMethod;
    pub const readProperty = Super.readProperty;
    pub const writeProperty = Super.writeProperty;
    pub const hasProperty = Super.hasProperty;
    pub const getProperties = Super.getProperties;
    pub const getPropertyPointer = Super.getPropertyPointer;
    pub const getGarbageCollection = Super.getGarbageCollection;
    pub const getIterator = Super.getIterator;
    const fromObject = Super.fromObject;
    const copySelf = Super.copySelf;
    const findMember = Super.findMember;
};
