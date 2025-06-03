# Escape codes

Screen supports escapes codes in strings. Escape codes are started using `\x1B` and then a sequence of symbols.

Supported sequences:

`sfXX` - set foreground color. XX is two hexadecimal digits, index to CGA_COLORS.
`sbXX` - set background color. XX is two hexadecimal digits, index to CGA_COLORS.
`i` - switches foreground and background colors around. "Inverted".
`bs` - switches foreground color to more intense one if available. "Bold Set".
`br` - switches foreground color to more plain one if available. "Bold Reset".
`r` - resets color to default light gray on black, resets blink to off. "Reset".
`f` - toggle blink. "Flash".
