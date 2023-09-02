pub const Vector4 = @Vector(4, i32);

pub fn add(a: *Vector4, b: *Vector4) void {
    a.* += b.*;
}

pub fn double(a: *Vector4) void {
    a.* *= @splat(2);
}
