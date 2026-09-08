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
 * The generator itself is an xorshift, not Microsoft's. The argument
 * for matching theirs would be diffing against printed sample runs --
 * except the book predates GW-BASIC by five years, so copying GW's
 * would not line those up either. Left alone.
 *
 * What *is* Microsoft's, and checked against a real GW-BASIC, is the
 * behaviour around it: the three argument forms, and the fact that RUN
 * restarts the sequence so an unseeded program deals the same cards
 * every time.
 */
/** Where the sequence starts on a fresh machine, and after RUN. */
const DEFAULT_SEED = 1;

export class Random {
    /* Set properly by seed() in the constructor; TypeScript cannot see that. */
    private state: number = 0;
    private lastValue: number = 0;

    constructor(seed: number = DEFAULT_SEED) {
        this.seed(seed);
        this.lastValue = this.next();
    }

    /**
     * Back to where a fresh machine starts. RUN calls this, which is
     * why an unseeded program deals the same cards every time.
     *
     * Reseeding in place rather than making a new Random matters: the
     * function library captured this object when it was built, so a
     * replacement would leave RND drawing from the old one.
     */
    reset() {
        this.seed(DEFAULT_SEED);
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
