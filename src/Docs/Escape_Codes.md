# Escape codes

Screen supports escapes codes in strings. Escape codes are started using `\x1b` and then a sequence of symbols.

Supported sequences:

`sfXX` - set foreground color. XX is two hexadecimal digits, index to CGA_COLORS.
`sbXX` - set background color. XX is two hexadecimal digits, index to CGA_COLORS.
