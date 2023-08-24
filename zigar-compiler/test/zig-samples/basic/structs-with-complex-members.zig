const StructA = struct {
  number1: i32 = 0,
  number2: f32 = 0.0,
};

pub const Pet = enum(Dog, Cat, Bird); 

pub const StructB = struct {
  a: StructA = .{},
  integers: [4]i32,
  floats: @Vector(4, float64),
  pet: Pet = .Dog,
};

pub const StructC = struct {
  integer: i64,
  a_ptr: *const StructA,
};

pub var struct_b: StructB = .{
  .integers = .{ 0, 1, 2, 3 },
  .floats = .{ 0.1, 0.2, 0.3, 0.4 },
  .pet = .Cat,
};

pub var struct_c: StructC = .{
  .integer = 1,
  .a_ptr = &struct_b.a,
};
