const std = @import("std");
pub const api_version = 1;

//-----------------------------------------------------------------------------
//  Enum and structs used by both Zig and C++ code
//  (need to keep these in sync with their C++ definitions)
//-----------------------------------------------------------------------------
const Result = enum(c_int) {
    OK,
    Failure,
};
const NumberType = enum(c_int) {
    I8,
    U8,
    I16,
    U16,
    I32,
    U32,
    I64,
    U64,
    F32,
    F64,
};
const Call = *opaque {};
const Value = *opaque {};

//-----------------------------------------------------------------------------
//  Value-pointer table that's filled on the C++ side
//-----------------------------------------------------------------------------
const Callbacks = extern struct {
    get_slot: *const fn (call: Call, slot_id: usize, dest: *Value) callconv(.C) Result,
    set_slot: *const fn (call: Call, slot_id: usize, object: Value) callconv(.C) Result,

    create_namespace: *const fn (call: Call, dest: *Value) callconv(.C) Result,
    create_class: *const fn (call: Call, name: Value, thunk: Thunk, dest: *Value) callconv(.C) Result,
    create_function: *const fn (call: Call, name: Value, len: usize, thunk: Thunk, dest: *Value) callconv(.C) Result,
    create_enumeration: *const fn (call: Call, name: Value, thunk: Thunk, dest: *Value) callconv(.C) Result,

    add_construct: *const fn (call: Call, container: Value, name: Value, construct: Value) callconv(.C) Result,
    add_accessors: *const fn (call: Call, container: Value, name: Value, getter: ?Thunk, setter: ?Thunk) callconv(.C) Result,
    add_static_accessors: *const fn (call: Call, container: Value, name: Value, getter: ?Thunk, setter: ?Thunk) callconv(.C) Result,
    add_enumeration_item: *const fn (call: Call, container: Value, name: Value, value: Value, dest: *Value) callconv(.C) Result,

    allocate_memory: *const fn (call: Call, size: usize, dest: *TypedArray) callconv(.C) Result,
    reallocate_memory: *const fn (call: Call, size: usize, dest: *TypedArray) callconv(.C) Result,
    free_memory: *const fn (call: Call, dest: *TypedArray) callconv(.C) Result,
};
var callbacks: Callbacks = undefined;

//-----------------------------------------------------------------------------
//  For generating unique id for structs
//-----------------------------------------------------------------------------
const slotCounter = blk: {
    comptime var next = 1;
    const counter = struct {
        // results of comptime functions are memoized
        // the same struct will yield the same number
        fn get(comptime S: anytype) comptime_int {
            _ = S;
            const slot = next;
            next += 1;
            return slot;
        }
    };
    break :blk counter;
};

//-----------------------------------------------------------------------------
//  Compile-time functions
//-----------------------------------------------------------------------------
fn str(comptime num: u8) [:0]const u8 {
    return std.fmt.comptimePrint("{d}", num);
}

fn getArgumentType(comptime function: anytype) type {
    _ = function;
}

fn setReturnValue(comptime arg_struct: anytype, comptime result: anytype) void {
    if (@hasField(arg_struct, "error_name")) |value| {
        setReturnValue(arg_struct, value);
    } else |err| {
        arg_struct.error_name = @errorName(err);
    }
    if (@hasField(arg_struct, "no_retval")) {
        if (result) |value| {
            setReturnValue(arg_struct, value);
        } else {
            arg_struct.retval_null = true;
        }
    } else {
        arg_struct.retval = result;
    }
}

//
fn repointStruct(call: Call, arg_struct: anytype, arg_obj: Value) void {
    _ = arg_obj;
    _ = arg_struct;
    _ = call;
}

fn depointStruct(call: Call, arg_struct: anytype, arg_obj: Value) void {
    _ = arg_obj;
    _ = arg_struct;
    _ = call;
}

//-----------------------------------------------------------------------------
//  Thunk creation functions (compile-time)
//-----------------------------------------------------------------------------
fn createThunk(comptime S: type, comptime name: []const u8) Thunk {
    const function = @field(S, name);
    const ArgT = getArgumentType(function);
    const Args = std.meta.ArgsTuple(@TypeOf(function));
    const ThunkType = struct {
        fn invokeFunction(call: Call, arg_obj: Value) callconv(.C) void {
            var arg_struct: ArgT = undefined;
            var args: Args = undefined;
            const fields = std.meta.fields(Args);
            const count = fields.len;
            _ = count;
            repointStruct(call, arg_struct, arg_obj);
            inline for (fields, 0..) |field, j| {
                _ = j;
                _ = field;
            }
            var result = @call(std.builtin.CallModifier.auto, function, args);
            setReturnValue(arg_struct, result);
            depointStruct(call, arg_struct, arg_obj);
        }
    };
    return ThunkType.invokeFunction;
}

//-----------------------------------------------------------------------------
//  Data types that appear in the exported module struct
//-----------------------------------------------------------------------------
const Thunk = *const fn (call: Call) callconv(.C) void;
const Factory = *const fn (call: Call, dest: *Namespace) callconv(.C) Result;
const Module = extern struct {
    version: c_int,
    callbacks: *Callbacks,
    factory: Factory,
};

pub fn createRootFactory(comptime S: type) Factory {
    _ = S;
    const RootFactory = struct {
        fn exportModule(call: Call, dest: *Namespace) callconv(.C) Result {
            if (getStructure(call, S, "root")) |ns| {
                dest.* = ns;
                return .OK;
            } else |_| {
                return .Failure;
            }
        }
    };
    return RootFactory.exportModule;
}

pub fn createModule(comptime S: type) Module {
    return .{
        .version = api_version,
        .callbacks = &callbacks,
        .factory = createRootFactory(S),
    };
}
