#version 300 es

precision highp float;
precision highp int;

uniform uvec2 u_characterSize;
uniform sampler2D u_atlas;
uniform sampler2D u_attrAtlas;
uniform uvec2 u_atlasSize;

flat in uvec2 v_atlasPosition;
flat in uvec3 v_foregroundColor;
flat in uvec3 v_backgroundColor;
flat in uint v_attributes;

in vec2 v_positionInCell;
 
out vec4 o_color;

vec4 getColorFromTriplet(uvec3 colorTriplet) {
  return vec4(
    float(colorTriplet.r) / 255.0,
    float(colorTriplet.g) / 255.0,
    float(colorTriplet.b) / 255.0,
    1.0
  );
}

vec2 getTexturePositionForAtlasPosition(uvec2 atlasPosition) {
  return (vec2(atlasPosition) + v_positionInCell.xy) * vec2(u_characterSize) / vec2(u_atlasSize);
}

uint applyCursor(uint index) {
  uint cursorIndex = uint((v_attributes >> 0u) & 0xFu);

  if (cursorIndex == 0u) {
    return index;
  }

  vec4 cursorColor = texture(u_attrAtlas, getTexturePositionForAtlasPosition(uvec2(cursorIndex, 0u)));

  if (cursorColor.r > 0.5) {
    index = index + 1u;
  }

  return index;
}

uint applyDecoration(uint index, uint decorationIndex) {
  uint decoration = uint((v_attributes >> (4u + decorationIndex)) & 0x1u);

  if (decoration == 0u) {
    return index;
  }

  vec4 decorationColor = texture(u_attrAtlas, getTexturePositionForAtlasPosition(uvec2(decorationIndex, 1u)));

  if (decorationColor.r > 0.5) {
    return index + 1u;
  }

  return index;
}

uint applyBorder(uint index, uint borderIndex) {
  uint border = uint((v_attributes >> (8u + borderIndex)) & 0x1u);

  if (border == 0u) {
    return index;
  }

  vec4 borderColor = texture(u_attrAtlas, getTexturePositionForAtlasPosition(uvec2(borderIndex, 2u)));

  if (borderColor.r > 0.5) {
    return index + 1u;
  }

  return index;
}

void main() {
  vec4 atlasColor = texture(u_atlas, getTexturePositionForAtlasPosition(v_atlasPosition));

  uint index = 0u;

  // character

  if (atlasColor.r > 0.5) {
    index = index + 1u;
  }

  // cursor

  index = applyCursor(index);

  // decoration: underline, overline, strikethrough

  index = applyDecoration(index, 0u); // underline
  index = applyDecoration(index, 1u); // overline
  index = applyDecoration(index, 2u); // strikethrough

  // borders

  index = applyBorder(index, 0u); // top
  index = applyBorder(index, 1u); // bottom
  index = applyBorder(index, 2u); // left
  index = applyBorder(index, 3u); // right

  // select final color

  index = index % 2u;

  if (index == 0u) {
    o_color = getColorFromTriplet(v_backgroundColor);
  } else {
    o_color = getColorFromTriplet(v_foregroundColor);
  }
}
