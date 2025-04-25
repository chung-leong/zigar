const std = @import("std");
const api_translator = @import("api-translator.zig");

pub fn main() !void {
    // create instance of generator
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    var generator: *api_translator.CodeGenerator(.{
        .include_paths = &.{"../../node_modules/node-api-headers/include"},
        .header_paths = &.{"node_api.h"},
        .zigft_path = "code-gen/",
        .c_error_type = "napi_status",
        .c_root_struct = "napi_env",
        .filter_fn = filter,
        .type_name_fn = getTypeName,
        .fn_name_fn = getFnName,
        .enum_name_fn = getEnumName,
        .error_name_fn = getErrorName,
        .enum_is_packed_struct_fn = isPackedStruct,
        .param_is_slice_len_fn = getPtrParamIndex,
        .param_is_optional_fn = isParamOptional,
        .param_is_input_fn = isParamInput,
        .doc_comment_fn = getDocComment,
    }) = try .init(gpa.allocator());
    defer generator.deinit();
    // analyze the headers
    try generator.analyze();
    // save translated code to file
    const path = try std.fs.path.resolve(generator.allocator, &.{
        generator.cwd,
        "gen-napi-output.zig",
    });
    var file = try std.fs.createFileAbsolute(path, .{});
    try generator.print(file.writer());
    file.close();
}

const camelize = api_translator.camelize;
const snakify = api_translator.snakify;
const prefixes = .{
    "node_api_",
    "napi_key_",
    "napi_tsfn_",
    "napi_",
};
const packed_structs = .{
    "napi_property_attributes",
    "napi_key_filter",
};
const slice_len_before_fns = .{
    "napi_create_external_buffer",
    "napi_create_buffer_copy",
    "napi_call_function",
    "napi_new_instance",
    "napi_make_callback",
};
const slice_len_after_fns = .{
    "napi_create_string_latin1",
    "napi_create_string_utf8",
    "napi_create_string_utf16",
    "napi_create_external_arraybuffer",
    "napi_create_function",
    "napi_define_class",
    "napi_fatal_error",
};
const alway_optional_params = .{
    "finalize_hint",
    "code",
};
const optional_params = .{
    .{ .fn_name = "node_api_post_finalizer", .arg_indices = .{ 2, 3 } },
    .{ .fn_name = "napi_add_finalizer", .arg_indices = .{ 2, 4 } },
    .{ .fn_name = "napi_define_class", .arg_indices = .{4} },
    .{ .fn_name = "napi_wrap", .arg_indices = .{ 3, 4 } },
    .{ .fn_name = "napi_property_descriptor", .arg_indices = .{ 0, 1 } },
    .{ .fn_name = "napi_create_function", .arg_indices = .{1} },
    .{ .fn_name = "napi_create_external", .arg_indices = .{ 2, 3 } },
    .{ .fn_name = "napi_create_external_arraybuffer", .arg_indices = .{ 3, 4 } },
    .{ .fn_name = "napi_create_threadsafe_function", .arg_indices = .{ 6, 7, 8, 9 } },
    .{ .fn_name = "napi_fatal_error", .arg_indices = .{0} },
    // function pointers
    .{ .fn_name = "napi_finalize", .arg_indices = .{2} },
    .{ .fn_name = "napi_threadsafe_function_call_js", .arg_indices = .{ 2, 3 } },
};
const inout_params = .{
    .{ .fn_name = "napi_module_register", .arg_indices = .{0} },
};

fn filter(name: []const u8) bool {
    return inline for (prefixes) |prefix| {
        if (std.mem.startsWith(u8, name, prefix)) break true;
    } else false;
}

fn getFnName(allocator: std.mem.Allocator, name: []const u8) ![]const u8 {
    return inline for (prefixes) |prefix| {
        if (std.mem.startsWith(u8, name, prefix))
            break camelize(allocator, name, prefix.len, false);
    } else name;
}

fn getTypeName(allocator: std.mem.Allocator, name: []const u8) ![]const u8 {
    return inline for (prefixes) |prefix| {
        if (std.mem.startsWith(u8, name, prefix))
            break camelize(allocator, name, prefix.len, true);
    } else name;
}

fn getEnumName(allocator: std.mem.Allocator, name: []const u8) ![]const u8 {
    return inline for (prefixes) |prefix| {
        if (std.mem.startsWith(u8, name, prefix))
            break snakify(allocator, name, prefix.len);
    } else name;
}

fn getErrorName(allocator: std.mem.Allocator, name: []const u8) ![]const u8 {
    return getTypeName(allocator, name);
}

fn isPackedStruct(enum_name: []const u8) bool {
    return inline for (packed_structs) |packed_struct| {
        if (std.mem.eql(u8, enum_name, packed_struct)) break true;
    } else false;
}

fn getPtrParamIndex(fn_name: []const u8, _: ?[]const u8, arg_index: usize, type_name: []const u8) ?usize {
    if (!std.mem.eql(u8, type_name, "usize")) return null;
    return inline for (slice_len_before_fns) |before_fn_name| {
        if (std.mem.eql(u8, fn_name, before_fn_name)) break arg_index + 1;
    } else inline for (slice_len_after_fns) |after_fn_name| {
        if (std.mem.eql(u8, fn_name, after_fn_name)) break arg_index - 1;
    } else null;
}

fn isParamOptional(fn_name: []const u8, param_name: ?[]const u8, param_index: usize, _: []const u8) ?bool {
    if (param_name) |n|
        inline for (alway_optional_params) |name| if (std.mem.eql(u8, n, name)) return true;
    return inline for (optional_params) |f| {
        if (std.mem.eql(u8, fn_name, f.fn_name))
            if (std.mem.indexOfScalar(usize, &f.arg_indices, param_index) != null) break true;
    } else null;
}

fn isParamInput(fn_name: []const u8, _: ?[]const u8, param_index: usize, _: []const u8) bool {
    return inline for (inout_params) |f| {
        if (std.mem.eql(u8, fn_name, f.fn_name))
            if (std.mem.indexOfScalar(usize, &f.arg_indices, param_index) != null) break true;
    } else false;
}

fn getDocComment(allocator: std.mem.Allocator, old_name: []const u8, _: []const u8) std.mem.Allocator.Error!?[]const u8 {
    return try std.fmt.allocPrint(allocator, "https://nodejs.org/api/n-api.html#{s}", .{old_name});
}
