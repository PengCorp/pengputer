/**
 * Where variables live.
 *
 * Two things here are surprising if you have not met a BASIC of this
 * era before.
 *
 * SCALARS AND ARRAYS ARE SEPARATE NAMESPACES.
 *
 *     A = 5
 *     A(3) = 7
 *
 * These are two unrelated variables that happen to share a name, and
 * book programs rely on it -- a loop counter `I' living alongside an
 * array `I()' is common. So there are two maps here, not one.
 *
 * NOTHING IS DECLARED.
 *
 * Reading a variable that has never been assigned is not an error; it
 * is 0, or "" for a string. That is why a typo in a variable name in a
 * BASIC program does not fail, it just quietly reads zero -- and why
 * two-character name significance was so destructive.
 */
import { BasicError } from "./errors";
import type { Sigil } from "./tokens";
import {
    type BasicType,
    type Value,
    coerceToType,
    defaultValue,
    suffixOfType,
    typeOfSigil,
} from "./values";

/** Arrays not given a DIM get this upper bound in every dimension. */
export const DEFAULT_UPPER_BOUND = 10;

interface ArrayVariable {
    /** Element counts, i.e. upper bound + 1, since subscripts start at 0. */
    sizes: number[];
    data: Value[];
}

interface Key {
    key: string;
    type: BasicType;
}

export class Variables {
    private scalars: Map<string, Value> = new Map();
    private arrays: Map<string, ArrayVariable> = new Map();

    /** Set by DEFINT and friends: initial letter to default type. */
    private defaultTypes: Map<string, BasicType> = new Map();

    /**
     * CONST names. Kept apart from `scalars' rather than flagged inside
     * it, so that "is this a constant" is a question about which map a
     * name is in and cannot be got wrong by a write that forgets to
     * check a flag.
     */
    private constants: Map<string, Value> = new Map();

    /**
     * The first subscript of every array: 0, or 1 after OPTION BASE 1.
     *
     * Storage stays zero-based and element zero simply becomes
     * unreachable, which wastes one slot per dimension and keeps every
     * offset calculation exactly as it was.
     */
    private optionBase: 0 | 1 = 0;

    /** CLEAR, NEW and RUN all start from nothing. */
    clear() {
        this.scalars.clear();
        this.arrays.clear();
        this.defaultTypes.clear();
        this.constants.clear();
        this.optionBase = 0;
    }

    /** `DEFINT A-Z'. Letters are inclusive at both ends. */
    setDefaultType(from: string, to: string, type: BasicType) {
        const start = from.toUpperCase().charCodeAt(0);
        const end = to.toUpperCase().charCodeAt(0);
        if (Number.isNaN(start) || Number.isNaN(end) || start > end) {
            throw new BasicError("SYNTAX");
        }
        for (let code = start; code <= end; code += 1) {
            this.defaultTypes.set(String.fromCharCode(code), type);
        }
    }

    /**
     * What type a name has.
     *
     * A sigil always decides. Without one the DEFINT table is consulted,
     * and single precision is the answer if nothing claims that letter.
     */
    getType(name: string, sigil: Sigil): BasicType {
        if (sigil !== "") return typeOfSigil(sigil);
        return this.defaultTypes.get(name.toUpperCase()[0]) ?? "single";
    }

    /**
     * Name plus normalized suffix. `A' and `A!' collapse to the same key
     * because both mean single precision; `A%' and `A$' do not.
     */
    private keyOf(name: string, sigil: Sigil): Key {
        const type = this.getType(name, sigil);
        return { key: name.toUpperCase() + suffixOfType(type), type };
    }

    /* ---------- scalars ---------- */

    getScalar(name: string, sigil: Sigil): Value {
        const { key, type } = this.keyOf(name, sigil);
        const constant = this.constants.get(key);
        if (constant !== undefined) return constant;
        return this.scalars.get(key) ?? defaultValue(type);
    }

    setScalar(name: string, sigil: Sigil, value: Value) {
        const { key, type } = this.keyOf(name, sigil);
        /* A constant is not a variable that refuses writes, it is a
         * different thing that happens to answer to a name -- so an
         * assignment to one is a mistake about what the name is. */
        if (this.constants.has(key)) {
            throw new BasicError("DUPLICATE DEFINITION");
        }
        this.scalars.set(key, coerceToType(value, type));
    }

    /**
     * `CONST N=10'. Defining one twice is an error, and so is defining
     * one over a variable that already exists.
     */
    defineConstant(name: string, sigil: Sigil, value: Value) {
        const { key, type } = this.keyOf(name, sigil);
        if (this.constants.has(key) || this.scalars.has(key)) {
            throw new BasicError("DUPLICATE DEFINITION");
        }
        this.constants.set(key, coerceToType(value, type));
    }

    /* ---------- OPTION BASE ---------- */

    setOptionBase(base: 0 | 1) {
        /* Changing it once arrays exist would silently change what
         * their subscripts mean, so it has to come first. QuickBASIC
         * says "Array already dimensioned" here; this is the 8K-era
         * spelling of the same complaint, and the same error number. */
        if (this.arrays.size > 0) {
            throw new BasicError("REDIM'D ARRAY");
        }
        this.optionBase = base;
    }

    /**
     * `LBOUND(A)' and `UBOUND(A,n)'.
     *
     * Asking about an array that does not exist is an error, which is
     * *not* what happens when you merely use one -- `A(1)' brings an
     * array into being at its default size, and always has. The two
     * differ because using an array says what shape you want and asking
     * about one presumes a shape already decided. Checked against
     * QuickBASIC 4.5, which says "Array not defined"; the first guess
     * here was that it would answer 10, by analogy with reading.
     */
    bound(
        name: string,
        sigil: Sigil,
        which: "lower" | "upper",
        dimension: number,
    ): number {
        const { key } = this.keyOf(name, sigil);
        const array = this.arrays.get(key);
        if (!array) throw new BasicError("ARRAY NOT DEFINED");

        if (dimension < 1 || dimension > array.sizes.length) {
            throw new BasicError("SUBSCRIPT OUT OF RANGE");
        }
        if (which === "lower") return this.optionBase;
        return array.sizes[dimension - 1] - 1;
    }

    /* ---------- arrays ---------- */

    /**
     * Throws an array away, so a later DIM may make it a different
     * size. Erasing one that was never dimensioned is an error -- there
     * is nothing to erase, and the likeliest cause is a typo.
     */
    eraseArray(name: string, sigil: Sigil) {
        const { key } = this.keyOf(name, sigil);
        if (!this.arrays.delete(key)) {
            throw new BasicError("ILLEGAL QUANTITY");
        }
    }

    hasArray(name: string, sigil: Sigil): boolean {
        return this.arrays.has(this.keyOf(name, sigil).key);
    }

    /**
     * `DIM A(10,5)'.
     *
     * The bounds are inclusive upper bounds and subscripts start at 0,
     * so `DIM A(10)' makes **eleven** elements. Nearly every listing of
     * the era writes `DIM A(100)' for a hundred items and simply
     * ignores element zero.
     */
    dimension(name: string, sigil: Sigil, upperBounds: number[]) {
        const { key, type } = this.keyOf(name, sigil);

        if (this.arrays.has(key)) throw new BasicError("REDIM'D ARRAY");

        this.arrays.set(key, this.makeArray(type, upperBounds));
    }

    getElement(name: string, sigil: Sigil, subscripts: number[]): Value {
        const array = this.resolveArray(name, sigil, subscripts.length);
        return array.data[this.offsetOf(array, subscripts)];
    }

    setElement(name: string, sigil: Sigil, subscripts: number[], value: Value) {
        const { type } = this.keyOf(name, sigil);
        const array = this.resolveArray(name, sigil, subscripts.length);
        array.data[this.offsetOf(array, subscripts)] = coerceToType(
            value,
            type,
        );
    }

    /**
     * Finds the array, creating it if this is its first mention.
     *
     * An array used without DIM springs into existence with subscripts
     * 0..10 in as many dimensions as the first reference used. This is
     * why so many programs have no DIM at all: ten was enough.
     */
    private resolveArray(
        name: string,
        sigil: Sigil,
        dimensionCount: number,
    ): ArrayVariable {
        const { key, type } = this.keyOf(name, sigil);

        const existing = this.arrays.get(key);
        if (existing) {
            /* A(1) and A(1,2) are not the same array. */
            if (existing.sizes.length !== dimensionCount) {
                throw new BasicError("SUBSCRIPT OUT OF RANGE");
            }
            return existing;
        }

        const created = this.makeArray(
            type,
            new Array<number>(dimensionCount).fill(DEFAULT_UPPER_BOUND),
        );
        this.arrays.set(key, created);
        return created;
    }

    private makeArray(type: BasicType, upperBounds: number[]): ArrayVariable {
        const sizes = upperBounds.map((bound) => {
            const size = Math.trunc(bound) + 1;
            if (size < 1) throw new BasicError("SUBSCRIPT OUT OF RANGE");
            return size;
        });

        const total = sizes.reduce((a, b) => a * b, 1);
        if (total > 1 << 20) throw new BasicError("OUT OF MEMORY");

        return {
            sizes,
            data: new Array<Value>(total).fill(defaultValue(type)),
        };
    }

    /** Row-major, so the last subscript varies fastest. */
    private offsetOf(array: ArrayVariable, subscripts: number[]): number {
        let offset = 0;
        for (let i = 0; i < subscripts.length; i += 1) {
            const index = Math.trunc(subscripts[i]);
            if (index < this.optionBase || index >= array.sizes[i]) {
                throw new BasicError("SUBSCRIPT OUT OF RANGE");
            }
            offset = offset * array.sizes[i] + index;
        }
        return offset;
    }
}
