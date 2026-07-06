#!/usr/bin/env python3
"""
Convert a BDF bitmap font into Screen-compatible PNG atlases (white glyphs on
transparent background) plus a TypeScript module with character value maps,
matching the format consumed by src/Screen/Font.ts (see src/Screen/terminus6x12.ts
and src/Screen/vga9x16.ts for hand-authored examples of the target format).

Usage:
    python bdf_to_atlas.py ter-u16n.bdf --name terminus8x16 --out-dir src/Screen
"""

from __future__ import annotations

import argparse
import unicodedata
from dataclasses import dataclass
from pathlib import Path

from PIL import Image

# Categories whose codepoints render as invisible/combining/unassigned and are
# escaped as \uXXXX in generated source instead of being embedded literally.
ESCAPE_CATEGORIES = {
    "Cc",
    "Cf",
    "Cs",
    "Co",
    "Cn",
    "Mn",
    "Mc",
    "Me",
    "Zl",
    "Zp",
}


@dataclass
class Glyph:
    codepoint: int
    bw: int
    bh: int
    xoff: int
    yoff: int
    bits: list[int]  # one int per bitmap row, MSB-first, bw significant bits


def parse_bdf(path: Path) -> tuple[int, int, int, int, list[Glyph]]:
    lines = path.read_text(encoding="utf-8").splitlines()

    font_bbox: tuple[int, int, int, int] | None = None
    glyphs: list[Glyph] = []

    i = 0
    n = len(lines)
    while i < n:
        line = lines[i]

        if line.startswith("FONTBOUNDINGBOX"):
            _, w, h, xoff, yoff = line.split()
            font_bbox = (int(w), int(h), int(xoff), int(yoff))

        elif line.startswith("STARTCHAR"):
            encoding: int | None = None
            bbx: tuple[int, int, int, int] | None = None
            bits: list[int] = []

            i += 1
            while not lines[i].startswith("ENDCHAR"):
                l = lines[i]
                if l.startswith("ENCODING"):
                    encoding = int(l.split()[1])
                elif l.startswith("BBX"):
                    _, bw, bh, bxoff, byoff = l.split()
                    bbx = (int(bw), int(bh), int(bxoff), int(byoff))
                elif l == "BITMAP":
                    assert bbx is not None, "BITMAP before BBX"
                    _, bh_, _, _ = bbx
                    for _ in range(bh_):
                        i += 1
                        hexrow = lines[i].strip()
                        bits.append(int(hexrow, 16) if hexrow else 0)
                i += 1

            # Skip unencoded glyphs (ENCODING -1): no codepoint to map them to.
            if encoding is not None and encoding >= 0 and bbx is not None:
                glyphs.append(Glyph(encoding, bbx[0], bbx[1], bbx[2], bbx[3], bits))

        i += 1

    assert font_bbox is not None, "missing FONTBOUNDINGBOX"
    fw, fh, fxoff, fyoff = font_bbox
    return fw, fh, fxoff, fyoff, glyphs


def glyph_to_cell(glyph: Glyph, cw: int, ch: int, fxoff: int, fyoff: int) -> list[list[bool]]:
    """Places a glyph's bitmap into a fixed-size (cw x ch) boolean pixel grid,
    aligned using its BBX offsets relative to the font's overall bounding box."""

    cell = [[False] * cw for _ in range(ch)]

    nbytes = (glyph.bw + 7) // 8
    total_bits = nbytes * 8

    row_base = (fyoff + ch) - (glyph.yoff + glyph.bh)
    col_base = glyph.xoff - fxoff

    for r, rowbits in enumerate(glyph.bits):
        cell_row = row_base + r
        if cell_row < 0 or cell_row >= ch:
            continue
        for c in range(glyph.bw):
            bit = (rowbits >> (total_bits - 1 - c)) & 1
            if not bit:
                continue
            cell_col = col_base + c
            if 0 <= cell_col < cw:
                cell[cell_row][cell_col] = True

    return cell


def js_char_literal(codepoint: int) -> str:
    ch = chr(codepoint)
    if ch == "\\":
        return '"\\\\"'
    if ch == '"':
        return '"\\""'

    category = unicodedata.category(ch)
    if category in ESCAPE_CATEGORIES:
        if codepoint > 0xFFFF:
            return f'"\\u{{{codepoint:x}}}"'
        return f'"\\u{codepoint:04X}"'

    return f'"{ch}"'


def paginate(glyphs: list[Glyph], cols: int, rows_per_page: int) -> list[list[Glyph]]:
    per_page = cols * rows_per_page
    return [glyphs[i : i + per_page] for i in range(0, len(glyphs), per_page)]


def render_atlas(page: list[Glyph], cols: int, cw: int, ch: int, fxoff: int, fyoff: int) -> Image.Image:
    rows = -(-len(page) // cols)  # ceil div
    img = Image.new("RGBA", (cols * cw, rows * ch), (255, 255, 255, 0))
    pixels = img.load()

    for idx, glyph in enumerate(page):
        col, row = idx % cols, idx // cols
        cell = glyph_to_cell(glyph, cw, ch, fxoff, fyoff)
        ox, oy = col * cw, row * ch
        for y in range(ch):
            for x in range(cw):
                if cell[y][x]:
                    pixels[ox + x, oy + y] = (255, 255, 255, 255)

    return img


def build_ts_module(name: str, cw: int, ch: int, pages: list[list[Glyph]], cols: int) -> str:
    pascal_name = name[0].upper() + name[1:]

    lines: list[str] = []
    lines.append('import { Font } from "./Font";')
    for i in range(len(pages)):
        lines.append(f'import {name}Atlas{i} from "./{name}_{i}.png";')
    lines.append('import { type charArray } from "../types";')
    lines.append("")
    lines.append("/* cSpell:disable */")
    lines.append("")

    for i, page in enumerate(pages):
        rows_count = -(-len(page) // cols)
        lines.append(f"// {cols} characters wide, {rows_count} characters high")
        lines.append(f"const {name}Page{i}ValueMap: charArray[] = [")
        for r in range(rows_count):
            row_glyphs = page[r * cols : (r + 1) * cols]
            row_str = ", ".join(js_char_literal(g.codepoint) for g in row_glyphs)
            lines.append(f"    [{row_str}],")
        lines.append("];")
        lines.append("")

    lines.append("/* cSpell:enable */")
    lines.append("")
    lines.append(f"export const {name} = new Font({cw}, {ch});")
    lines.append("")
    lines.append(f"export const load{pascal_name} = async () => {{")
    for i in range(len(pages)):
        lines.append(
            f'    await {name}.loadAtlas("{name}_{i}", {name}Atlas{i}, {name}Page{i}ValueMap);'
        )
    lines.append("};")
    lines.append("")

    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bdf", type=Path, help="Path to the input .bdf font file")
    parser.add_argument(
        "--name",
        default=None,
        help="Base name for output files and generated identifiers "
        "(default: derived from FAMILY_NAME + glyph size, e.g. terminus8x16)",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=None,
        help="Output directory (default: same directory as the input .bdf)",
    )
    parser.add_argument(
        "--cols",
        type=int,
        default=32,
        help="Preferred atlas grid columns (default: 32, matching existing fonts)",
    )
    parser.add_argument(
        "--max-size",
        type=int,
        default=1024,
        help="Maximum atlas width/height in pixels (default: 1024)",
    )
    args = parser.parse_args()

    fw, fh, fxoff, fyoff, glyphs = parse_bdf(args.bdf)
    glyphs.sort(key=lambda g: g.codepoint)

    name = args.name
    if name is None:
        family = "font"
        for line in args.bdf.read_text(encoding="utf-8").splitlines():
            if line.startswith("FAMILY_NAME"):
                family = line.split('"')[1].lower().replace(" ", "")
                break
        name = f"{family}{fw}x{fh}"

    out_dir = args.out_dir or args.bdf.parent
    out_dir.mkdir(parents=True, exist_ok=True)

    cols = max(1, min(args.cols, args.max_size // fw))
    rows_per_page = max(1, args.max_size // fh)

    pages = paginate(glyphs, cols, rows_per_page)

    for i, page in enumerate(pages):
        img = render_atlas(page, cols, fw, fh, fxoff, fyoff)
        png_path = out_dir / f"{name}_{i}.png"
        img.save(png_path)
        print(f"wrote {png_path} ({img.width}x{img.height}px, {len(page)} glyphs)")

    ts_source = build_ts_module(name, fw, fh, pages, cols)
    ts_path = out_dir / f"{name}.ts"
    ts_path.write_text(ts_source, encoding="utf-8")
    print(f"wrote {ts_path} ({len(glyphs)} glyphs across {len(pages)} page(s))")


if __name__ == "__main__":
    main()
