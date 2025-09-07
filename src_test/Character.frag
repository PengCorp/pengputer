#version 300 es

precision highp float;
precision highp int;

uniform uvec2 u_characterSize;
uniform sampler2D u_atlas;
uniform uvec2 u_atlasSize;

flat in uvec3 v_backgroundColor;
flat in uvec3 v_foregroundColor;
flat in uvec2 v_atlasPosition;
in vec2 v_positionInCell;
in vec4 v_clipPosition;
 
out vec4 o_color;

vec4 rgbToColor(uvec3 rgb) {
  vec3 rgbFloat = vec3(rgb);
  return vec4(rgbFloat / 255.0, 1.0);
}

void main() {
  vec4 fgColor = rgbToColor(v_foregroundColor);
  vec4 bgColor = rgbToColor(v_backgroundColor);

  vec2 texturePosition = (v_positionInCell.xy * vec2(u_characterSize) + vec2(v_atlasPosition) * vec2(u_characterSize)) / vec2(u_atlasSize);
  vec4 atlasColor = texture(u_atlas, texturePosition);
  o_color = mix(
    bgColor,
    fgColor,
    atlasColor.r
  );
}
