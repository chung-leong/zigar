fn Point(comptime T: type) type {
    return struct {
        x: T,
        y: T,
        comptime Type: type = T,
    };
}

pub const PointI32 = Point(i32);
pub const PointI64 = Point(i64);
pub const PointF32 = Point(f32);
pub const PointF64 = Point(f64);
