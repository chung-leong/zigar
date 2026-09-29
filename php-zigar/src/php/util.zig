pub fn argCount(comptime F: type) usize {
    return switch (@typeInfo(F)) {
        .pointer => |pt| argCount(pt.child),
        .@"fn" => @typeInfo(F).@"fn".param_types.len,
        else => @compileError("Not a function or function pointer"),
    };
}

pub fn ArgType(comptime F: type, comptime index: usize) type {
    return switch (@typeInfo(F)) {
        .pointer => |pt| ArgType(pt.child, index),
        .@"fn" => get: {
            const types = @typeInfo(F).@"fn".param_types;
            if (index >= types.len) @compileError("Not argument");
            break :get types[index] orelse @compileError("Generic function");
        },
        else => @compileError("Not a function or function pointer"),
    };
}

pub fn ReturnType(comptime F: type) type {
    return switch (@typeInfo(F)) {
        .pointer => |pt| ReturnType(pt.child),
        .@"fn" => @typeInfo(F).@"fn".return_type orelse @compileError("Cannot determine return value type"),
        else => @compileError("Not a function or function pointer"),
    };
}

pub fn WithoutError(comptime T: type) type {
    return switch (@typeInfo(T)) {
        .error_union => |eu| eu.payload,
        else => T,
    };
}
