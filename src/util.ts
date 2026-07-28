// stupid TS magic that fixes 22 errors
export type PartialBy<T, K extends keyof T> =
    T extends unknown
      ? Omit<T, K> & Partial<Pick<T, K>>
      : never;

export const dataURLToImageBitmap = async (url: string) => {
    const res = await fetch(url);
    const blob = await res.blob();
    return await createImageBitmap(blob);
};
