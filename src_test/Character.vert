#version 300 es

precision highp float;
precision highp int;
 
uniform uvec2 u_gridSize;
uniform uvec2 u_characterSize;

in vec2 a_position;

in uvec2 a_origin;
in uvec2 a_atlasPosition;
in uint a_attributes;
in uvec3 a_foregroundColor;
in uvec3 a_backgroundColor;

flat out uvec2 v_atlasPosition;
flat out uint v_attributes;
flat out uvec3 v_foregroundColor;
flat out uvec3 v_backgroundColor;

out vec2 v_positionInCell;

// Converts from screen (0 to 1 y-down) to ndc (-1 to 1, y-up).
vec2 screenToNdc(vec2 screen) {
  return vec2(
    screen.x * 2.0 - 1.0,
    1.0 - screen.y * 2.0
  );
}

// Converts from ndc (-1 to 1, y-up) to screen (0 to 1 y-down).
vec2 ndcToScreen(vec2 clip) {
  return vec2(
    (clip.x + 1.0) * 0.5,
    (1.0 - clip.y) * 0.5
  );
}
 
void main() {
  uvec2 resolution = u_gridSize * u_characterSize;
  vec2 pixelSize = 1.0 / vec2(resolution);
  vec2 cellSize = vec2(u_characterSize) * pixelSize;

  vec2 screenOrigin = vec2(a_origin) * cellSize;

  vec2 screenPosition = screenOrigin + ndcToScreen(a_position) * cellSize;

  vec2 position = screenToNdc(screenPosition);
  gl_Position = vec4(position.xy, 0.0, 1.0);
  v_atlasPosition = a_atlasPosition;
  v_positionInCell = ndcToScreen(a_position);
  v_attributes = a_attributes;
  v_foregroundColor = a_foregroundColor;
  v_backgroundColor = a_backgroundColor;
}
