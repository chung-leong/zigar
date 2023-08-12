pub const Vector4 = @Vector(4, i32);

pub fn multiply(a: Vector4, b: Vector4) Vector4 {
    return a * b;
}

pub fn add(a: Vector4, b: Vector4) Vector4 {
    return a + b;
}
