export interface Sprite {
  data: number[];
  width: number;
  height: number;
}

export const makeSprite = (
  spriteMap: string[],
  charMap: Record<string, number>,
) => {
  const height = spriteMap.length;
  const width = spriteMap[0].length;

  const data = Array.from(spriteMap.join("")).map((c) => charMap[c]);

  return {
    data,
    width,
    height,
  };
};
