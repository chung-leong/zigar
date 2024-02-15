pub const Vector = @Vector(3, f32);

pub fn dot(v1: Vector, v2: Vector) f32 {
    return @reduce(.Add, v1 * v2);
}

pub fn cross(v1: Vector, v2: Vector) Vector {
    const p1 = @shuffle(f32, v1, undefined, @Vector(3, i32){ 1, 2, 0 }) * @shuffle(f32, v2, undefined, @Vector(3, i32){ 2, 0, 1 });
    const p2 = @shuffle(f32, v1, undefined, @Vector(3, i32){ 2, 0, 1 }) * @shuffle(f32, v2, undefined, @Vector(3, i32){ 1, 2, 0 });
    return p1 - p2;
}
