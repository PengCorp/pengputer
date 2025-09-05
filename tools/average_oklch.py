import math

def parse_oklch(s: str):
    # Input like "oklch(L C H)"
    s = s.strip().removeprefix("oklch(").removesuffix(")")
    parts = s.split()
    return tuple(map(float, parts))  # (L, C, H)

def format_oklch(L, C, H):
    return f"oklch({L:.6f} {C:.6f} {H:.6f})"

def average_oklch(c1, c2):
    L1, C1, H1 = c1
    L2, C2, H2 = c2

    # Average lightness and chroma directly
    L = (L1 + L2) / 2
    C = (C1 + C2) / 2

    # Convert hue to radians for averaging
    H1_rad = math.radians(H1)
    H2_rad = math.radians(H2)

    x = math.cos(H1_rad) + math.cos(H2_rad)
    y = math.sin(H1_rad) + math.sin(H2_rad)

    H = math.degrees(math.atan2(y, x)) % 360

    return (L, C, H)

if __name__ == "__main__":
    while True:
        col1 = input("Enter first color (oklch(L C H)): ")
        col2 = input("Enter second color (oklch(L C H)): ")

        c1 = parse_oklch(col1)
        c2 = parse_oklch(col2)

        avg = average_oklch(c1, c2)
        print("Average color:", format_oklch(*avg), '\n')