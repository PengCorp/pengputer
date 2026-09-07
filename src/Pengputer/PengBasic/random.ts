/**
 * The random number generator behind RND.
 *
 * Microsoft's RND has three behaviours picked by the sign of its
 * argument, which is unusual enough to be worth stating plainly:
 *
 *     RND(1)   any positive number: the next value
 *     RND(0)   the *same* value again, without advancing
 *     RND(-n)  reseed from n, and return the first value of that run
 *
 * `RND(0)` is the one people forget. It exists so a program can look at
 * the number it just got without spending another one.
 *
 * The generator itself is an xorshift, not Microsoft's. Matching theirs
 * exactly would let us diff against printed sample runs, which is the
 * only real argument for it, and it is not worth the bother until
 * something needs it.
 */
export class Random {
    /* Set properly by seed() in the constructor; TypeScript cannot see that. */
    private state: number = 0;
    private lastValue: number = 0;

    constructor(seed: number = 1) {
        this.seed(seed);
        this.lastValue = this.next();
    }

    /**
     * Reseeds. RANDOMIZE and RND with a negative argument both land here.
     *
     * The seed is mixed and then run forward a few rounds before
     * anything is handed out. Xorshift started from a small number
     * yields small numbers for its first several turns, so without this
     * `RANDOMIZE 7` made `INT(RND(1)*100)+1` come out as 1 -- which is
     * exactly the shape of every dice roll in every listing.
     */
    seed(value: number) {
        this.state = normalizeSeed(value);
        for (let i = 0; i < 8; i += 1) this.next();
    }

    /** The next value, 0 <= r < 1. */
    next(): number {
        let x = this.state;
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        this.state = x | 0;

        this.lastValue = (this.state >>> 0) / 0x100000000;
        return this.lastValue;
    }

    /** The value last handed out, without advancing. */
    repeat(): number {
        return this.lastValue;
    }
}

/** Any number to a well-spread non-zero 32-bit state; xorshift dies at zero. */
function normalizeSeed(value: number): number {
    const mixed = Math.imul(Math.trunc(value) | 0, 0x9e3779b1) | 0;
    return mixed === 0 ? 0x9e3779b9 : mixed;
}
