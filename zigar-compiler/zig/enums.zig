pub const StructureType = enum(u32) {
    primitive = 0,
    array,
    @"struct",
    @"union",
    error_union,
    error_set,
    @"enum",
    optional,
    pointer,
    slice,
    vector,
    @"opaque",
    arg_struct,
    variadic_struct,
    function,
};

pub const StructurePurpose = enum(u32) {
    unknown,
    promise,
    generator,
    abort_signal,
    allocator,
    iterator,
    file,
    directory,

    pub fn isOptional(self: @This()) bool {
        return switch (self) {
            .promise, .generator, .abort_signal, .allocator => true,
            else => false,
        };
    }
};

pub const StructureFlags = packed union {
    common: Common,
    primitive: Primitive,
    array: Array,
    @"struct": Struct,
    @"union": Union,
    error_union: ErrorUnion,
    error_set: ErrorSet,
    @"enum": Enum,
    optional: Optional,
    pointer: Pointer,
    slice: Slice,
    vector: Vector,
    @"opaque": Opaque,
    arg_struct: ArgStruct,
    variadic_struct: VariadicStruct,
    function: Function,

    pub const Common = packed struct(u32) {
        has_value: bool = true,
        has_object: bool = false,
        has_pointer: bool = false,
        has_slot: bool = false,
        has_proxy: bool = false,
        _: u27 = 0,
    };
    pub const Primitive = packed struct(u32) {
        has_value: bool = true,
        has_object: bool = false,
        has_pointer: bool = false,
        has_slot: bool = false,
        has_proxy: bool = false,
        is_size: bool = false,
        _: u26 = 0,
    };
    pub const Array = packed struct(u32) {
        has_value: bool = false,
        has_object: bool = false,
        has_pointer: bool = false,
        has_slot: bool = false,
        has_proxy: bool = true,
        has_sentinel: bool = false,
        is_string: bool = false,
        is_typed_array: bool = false,
        is_clamped_array: bool = false,
        _: u23 = 0,
    };
    pub const Struct = packed struct(u32) {
        has_value: bool = false,
        has_object: bool = false,
        has_pointer: bool = false,
        has_slot: bool = false,
        has_proxy: bool = false,
        is_extern: bool = false,
        is_packed: bool = false,
        is_tuple: bool = false,
        is_optional: bool = false,
        _: u23 = 0,
    };
    pub const Union = packed struct(u32) {
        has_value: bool = false,
        has_object: bool = false,
        has_pointer: bool = false,
        has_slot: bool = false,
        has_proxy: bool = false,
        has_selector: bool = false,
        has_tag: bool = false,
        has_inaccessible: bool = false,
        is_extern: bool = false,
        is_packed: bool = false,
        _: u22 = 0,
    };
    pub const ErrorUnion = packed struct(u32) {
        has_value: bool = true,
        has_object: bool = false,
        has_pointer: bool = false,
        has_slot: bool = false,
        has_proxy: bool = false,
        _: u27 = 0,
    };
    pub const ErrorSet = packed struct(u32) {
        has_value: bool = true,
        has_object: bool = false,
        has_pointer: bool = false,
        has_slot: bool = false,
        has_proxy: bool = false,
        is_global: bool = false,
        _: u26 = 0,
    };
    pub const Enum = packed struct(u32) {
        has_value: bool = true,
        has_object: bool = false,
        has_pointer: bool = false,
        has_slot: bool = false,
        has_proxy: bool = false,
        is_open_ended: bool = false,
        _: u26 = 0,
    };
    pub const Optional = packed struct(u32) {
        has_value: bool = true,
        has_object: bool = false,
        has_pointer: bool = false,
        has_slot: bool = false,
        has_proxy: bool = false,
        has_selector: bool = false,
        _: u26 = 0,
    };
    pub const Pointer = packed struct(u32) {
        has_value: bool = false,
        has_object: bool = false,
        has_pointer: bool = true,
        has_slot: bool = true,
        has_proxy: bool = true,
        has_length: bool = false,
        is_multiple: bool = false,
        is_single: bool = false,
        is_const: bool = false,
        is_nullable: bool = false,
        _: u22 = 0,
    };
    pub const Slice = packed struct(u32) {
        has_value: bool = false,
        has_object: bool = false,
        has_pointer: bool = false,
        has_slot: bool = false,
        has_proxy: bool = true,
        has_sentinel: bool = false,
        is_string: bool = false,
        is_typed_array: bool = false,
        is_clamped_array: bool = false,
        is_opaque: bool = false,
        _: u22 = 0,
    };
    pub const Vector = packed struct(u32) {
        has_value: bool = false,
        has_object: bool = false,
        has_pointer: bool = false,
        has_slot: bool = false,
        has_proxy: bool = false,
        is_typed_array: bool = false,
        is_clamped_array: bool = false,
        _: u25 = 0,
    };
    pub const Opaque = packed struct(u32) {
        has_value: bool = false,
        has_object: bool = false,
        has_pointer: bool = false,
        has_slot: bool = false,
        has_proxy: bool = false,
        _: u27 = 0,
    };
    pub const ArgStruct = packed struct(u32) {
        has_value: bool = false,
        has_object: bool = false,
        has_pointer: bool = true,
        has_slot: bool = true,
        has_proxy: bool = false,
        has_options: bool = false,
        is_throwing: bool = false,
        is_async: bool = false,
        _: u24 = 0,
    };
    pub const VariadicStruct = packed struct(u32) {
        has_value: bool = false,
        has_object: bool = false,
        has_pointer: bool = true,
        has_slot: bool = true,
        has_proxy: bool = false,
        has_options: bool = false,
        is_throwing: bool = false,
        is_async: bool = false,
        _: u24 = 0,
    };
    pub const Function = packed struct(u32) {
        has_value: bool = false,
        has_object: bool = false,
        has_pointer: bool = false,
        has_slot: bool = false,
        has_proxy: bool = false,
        _: u27 = 0,
    };
};

pub const MemberType = enum(u32) {
    void = 0,
    bool,
    int,
    uint,
    float,
    object,
    type,
    literal,
    null,
    undefined,
    unsupported,
};

pub const MemberFlags = packed struct(u32) {
    is_required: bool = false,
    is_read_only: bool = false,
    is_part_of_set: bool = false,
    is_selector: bool = false,
    is_method: bool = false,
    is_expecting_instance: bool = false,
    is_sentinel: bool = false,
    is_backing_int: bool = false,
    is_string: bool = false,
    is_plain: bool = false,
    is_typed_array: bool = false,
    is_clamped_array: bool = false,
    _: u20 = 0,
};
