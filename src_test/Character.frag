#version 300 es

precision highp float;

uniform uvec2 u_gridSize;

flat in uvec3 v_backgroundColor;
flat in uvec3 v_foregroundColor;
in vec2 v_positionInCell;
in vec4 v_clipPosition;
 
out vec4 o_color;

vec3 rgbToColor(uvec3 rgb) {
  vec3 rgbFloat = vec3(rgb);
  return rgbFloat / 255.0;
}

void main() {
  vec3 fgColor = rgbToColor(v_foregroundColor);
  vec3 bgColor = rgbToColor(v_backgroundColor);
  o_color = mix(
    vec4(bgColor.rgb, 1.0),
    vec4(fgColor.rgb, 1.0),
    v_positionInCell.y * v_positionInCell.x
  );
}
