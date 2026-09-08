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

    /** CLEAR, NEW and RUN all start from nothing. */
    clear() {
        this.scalars.clear();
        this.arrays.clear();
        this.defaultTypes.clear();
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
     * Name plus normalised suffix. `A' and `A!' collapse to the same key
     * because both mean single precision; `A%' and `A$' do not.
     */
    private keyOf(name: string, sigil: Sigil): Key {
        const type = this.getType(name, sigil);
        return { key: name.toUpperCase() + suffixOfType(type), type };
    }

    /* ---------- scalars ---------- */

    getScalar(name: string, sigil: Sigil): Value {
        const { key, type } = this.keyOf(name, sigil);
        return this.scalars.get(key) ?? defaultValue(type);
    }

    setScalar(name: string, sigil: Sigil, value: Value) {
        const { key, type } = this.keyOf(name, sigil);
        this.scalars.set(key, coerceToType(value, type));
    }

    /* ---------- arrays ---------- */

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
            if (index < 0 || index >= array.sizes[i]) {
                throw new BasicError("SUBSCRIPT OUT OF RANGE");
            }
            offset = offset * array.sizes[i] + index;
        }
        return offset;
    }
}
