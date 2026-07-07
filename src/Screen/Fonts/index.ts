export * from "./vga9x8";
export * from "./vga9x16";
export * from "./terminus6x12";
export * from "./terminus8x16";

import { loadVga9x8 } from "./vga9x8";
import { loadVga9x16 } from "./vga9x16";
import { loadTerminus6x12 } from "./terminus6x12";
import { loadTerminus8x16 } from "./terminus8x16";

export async function loadFonts() {
    await Promise.all([
        loadVga9x8(),
        loadVga9x16(),
        loadTerminus6x12(),
        loadTerminus8x16(),
    ]);
}
