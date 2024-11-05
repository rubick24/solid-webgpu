import { Vec2 } from './vec2';
// import type { Vec2 as Vec2T } from './vec2'
const x = Vec2.copy([0, 0], [1, 2]); // x: [number, number]
const y = Vec2.copy(Vec2.create(), [1, 2]); // y: Vec2
y.normalize();
x[0];
