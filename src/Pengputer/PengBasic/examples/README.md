# PengBASIC examples

Listings to paste into `pbasic`. Copy a whole file, paste it at the `Ok`
prompt, then type `RUN`.

Every file ends with a trailing newline so the last line is submitted
rather than left sitting at the cursor unentered. None of them ends with
`RUN` — pasting a listing should leave you with a program, not run one.

`LIST` afterwards shows the program back exactly as it was typed,
spacing and all.

Each of these is also a test: `examples.test.ts` pastes every listing,
runs it, and checks the output, so a broken example fails the suite.

| Listing         | Shows                                                 |
| --------------- | ----------------------------------------------------- |
| `squares.bas`   | The smallest thing that is a program                  |
| `table.bas`     | Nested `FOR`, and `;` holding a line together         |
| `triangle.bas`  | An inner loop whose limit is the outer counter        |
| `fib.bas`       | Carrying values between iterations                    |
| `gosub.bas`     | `GOSUB` and `RETURN`                                  |
| `ifelse.bas`    | `IF`/`THEN`/`ELSE` on one line                        |
| `powers.bas`    | `WHILE`/`WEND`                                        |
| `sort.bas`      | Arrays, `DIM`, `SWAP`, a bubble sort                  |
| `menu.bas`      | `ON…GOTO` as a jump table                             |
| `greet.bas`     | `INPUT`, with a prompt of its own                     |
| `months.bas`    | `DATA`, `READ` and `RESTORE`                          |
| `deffn.bas`     | `DEF FN`, a function of your own                      |
| `strings.bas`   | `LEN`, `LEFT$`, `MID$`, `INSTR`, `STRING$`            |
| `guess.bas`     | `RND`, `INT` and `RANDOMIZE` — the classic            |
| `invoice.bas`   | `PRINT USING`                                         |
| `colors.bas`    | `CLS`, `LOCATE`, `COLOR` — all sixteen                |
| `bounce.bas`    | A ball, `DELAY` to pace it, `INKEY$` to stop it       |
| `chars.bas`     | The whole character set, and the blocks you draw with |
| `precision.bas` | What a single-precision number can and cannot hold    |
| `aceyducey.bas` | A real book program, typed in exactly as printed      |

`precision.bas` is the one to run if the arithmetic ever looks wrong.
Ten tenths print as `1` and compare unequal to 1, which is not a bug in
either the interpreter or the listing — it is what a 32-bit float does,
and 1978 listings were written against exactly that.

`aceyducey.bas` is _Acey Ducey_, from **BASIC Computer Games** (1978),
transcribed as it appears on the page — dead line 640 and the typo in
line 60 included. It is the one listing here nobody wrote for PengBASIC,
which is what makes it worth having: it either runs or the dialect is
wrong.

`guess.bas` seeds the generator with `RANDOMIZE 7` so it plays the same
way every time. Delete line 20 to get a different number each run.

`DELAY <ms>` is ours, not Microsoft's. Listings of the era paced
themselves with `FOR I=1 TO 500: NEXT`, which finishes instantly here —
so anything meant to be watched needs a `DELAY` in its main loop.

`DOWNLOAD` writes whatever is in memory out as a `.bas` file, and
`UPLOAD` reads one back after a `NEW` — so a program you write here can
be kept, and a listing can come in without going through the clipboard.
