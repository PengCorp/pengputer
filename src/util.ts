export const dataURLToImageBitmap = async (dataURL: string) => {
  const res = await fetch(dataURL);
  const blob = await res.blob();
  return await createImageBitmap(blob);
}
