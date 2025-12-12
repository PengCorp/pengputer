#version 300 es

precision highp float;
precision highp int;

uniform uvec2 u_characterSize;
uniform sampler2D u_atlas;
uniform uvec2 u_atlasSize;

flat in uvec2 v_atlasPosition;
in vec2 v_positionInCell;
 
out vec4 o_color;

void main() {
  vec2 texturePosition = (vec2(v_atlasPosition) + v_positionInCell.xy) * vec2(u_characterSize) / vec2(u_atlasSize);
  vec4 atlasColor = texture(u_atlas, texturePosition);

  o_color = vec4(atlasColor.r, atlasColor.r, atlasColor.r, 1.0);
}
