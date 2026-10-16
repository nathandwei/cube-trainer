// AES-128 single-block cipher, standing in for the aes-js dependency the library used (only for 16-byte CBC chunks
// with a fresh IV each time, which is how every GAN gen2-4 packet is sealed). Byte-oriented FIPS-197; a few
// packets a second need no lookup-table speedups. aes.test.ts checks it against the FIPS-197 and SP 800-38A vectors.

const BLOCK = 16;
const ROUNDS = 10;

function xtime(b: number): number {
    return ((b << 1) ^ (b & 0x80 ? 0x1b : 0)) & 0xff;
}

function gmul(a: number, b: number): number {
    let product = 0;
    let x = a;
    let y = b;
    while (y > 0) {
        if (y & 1) product ^= x;
        x = xtime(x);
        y >>= 1;
    }
    return product;
}

function buildSboxes(): { sbox: Uint8Array; inverse: Uint8Array } {
    const sbox = new Uint8Array(256);
    const inverse = new Uint8Array(256);
    // Walk the multiplicative group with generator 3 to get each byte's inverse, then apply the affine map.
    let p = 1;
    let q = 1;
    do {
        p = p ^ xtime(p);
        q ^= q << 1;
        q ^= q << 2;
        q ^= q << 4;
        q &= 0xff;
        if (q & 0x80) q ^= 0x09;
        const rotl = (v: number, s: number) => ((v << s) | (v >> (8 - s))) & 0xff;
        const value = q ^ rotl(q, 1) ^ rotl(q, 2) ^ rotl(q, 3) ^ rotl(q, 4) ^ 0x63;
        sbox[p] = value;
        inverse[value] = p;
    } while (p !== 1);
    sbox[0] = 0x63;
    inverse[0x63] = 0;
    return { sbox, inverse };
}

const { sbox: SBOX, inverse: INV_SBOX } = buildSboxes();

function expandKey(key: Uint8Array): Uint8Array {
    if (key.length !== BLOCK) throw new Error(`AES-128 needs a 16-byte key, got ${key.length}`);
    const words = new Uint8Array(BLOCK * (ROUNDS + 1));
    words.set(key);
    let rcon = 1;
    for (let i = BLOCK; i < words.length; i += 4) {
        let t0 = words[i - 4]!;
        let t1 = words[i - 3]!;
        let t2 = words[i - 2]!;
        let t3 = words[i - 1]!;
        if (i % BLOCK === 0) {
            [t0, t1, t2, t3] = [SBOX[t1]! ^ rcon, SBOX[t2]!, SBOX[t3]!, SBOX[t0]!];
            rcon = xtime(rcon);
        }
        words[i] = words[i - BLOCK]! ^ t0;
        words[i + 1] = words[i - BLOCK + 1]! ^ t1;
        words[i + 2] = words[i - BLOCK + 2]! ^ t2;
        words[i + 3] = words[i - BLOCK + 3]! ^ t3;
    }
    return words;
}

function addRoundKey(state: Uint8Array, roundKeys: Uint8Array, round: number): void {
    for (let i = 0; i < BLOCK; i++) state[i]! ^= roundKeys[round * BLOCK + i]!;
}

function subBytes(state: Uint8Array, box: Uint8Array): void {
    for (let i = 0; i < BLOCK; i++) state[i] = box[state[i]!]!;
}

// The state is column-major: byte (row r, column c) sits at index 4c + r.
function shiftRows(state: Uint8Array, inverse: boolean): void {
    const copy = state.slice();
    for (let r = 1; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
            const from = inverse ? (c - r + 4) % 4 : (c + r) % 4;
            state[4 * c + r] = copy[4 * from + r]!;
        }
    }
}

function mixColumns(state: Uint8Array, inverse: boolean): void {
    const m = inverse ? [14, 11, 13, 9] : [2, 3, 1, 1];
    for (let c = 0; c < 4; c++) {
        const col = [state[4 * c]!, state[4 * c + 1]!, state[4 * c + 2]!, state[4 * c + 3]!];
        for (let r = 0; r < 4; r++) {
            state[4 * c + r] =
                gmul(col[r]!, m[0]!) ^ gmul(col[(r + 1) % 4]!, m[1]!) ^ gmul(col[(r + 2) % 4]!, m[2]!) ^ gmul(col[(r + 3) % 4]!, m[3]!);
        }
    }
}

export class Aes128 {
    readonly #roundKeys: Uint8Array;

    constructor(key: Uint8Array) {
        this.#roundKeys = expandKey(key);
    }

    encryptBlock(block: Uint8Array): Uint8Array {
        if (block.length !== BLOCK) throw new Error(`AES blocks are 16 bytes, got ${block.length}`);
        const state = new Uint8Array(block);
        addRoundKey(state, this.#roundKeys, 0);
        for (let round = 1; round <= ROUNDS; round++) {
            subBytes(state, SBOX);
            shiftRows(state, false);
            if (round < ROUNDS) mixColumns(state, false);
            addRoundKey(state, this.#roundKeys, round);
        }
        return state;
    }

    decryptBlock(block: Uint8Array): Uint8Array {
        if (block.length !== BLOCK) throw new Error(`AES blocks are 16 bytes, got ${block.length}`);
        const state = new Uint8Array(block);
        addRoundKey(state, this.#roundKeys, ROUNDS);
        for (let round = ROUNDS - 1; round >= 0; round--) {
            shiftRows(state, true);
            subBytes(state, INV_SBOX);
            addRoundKey(state, this.#roundKeys, round);
            if (round > 0) mixColumns(state, true);
        }
        return state;
    }
}

/** AES-128-CBC over exactly one 16-byte chunk (what `new ModeOfOperation.cbc(key, iv)` did per chunk in aes-js). */
export class AesCbcChunk {
    readonly #aes: Aes128;
    readonly #iv: Uint8Array;

    constructor(key: Uint8Array, iv: Uint8Array) {
        if (iv.length !== BLOCK) throw new Error(`The IV must be 16 bytes, got ${iv.length}`);
        this.#aes = new Aes128(key);
        this.#iv = new Uint8Array(iv);
    }

    encrypt(chunk: Uint8Array): Uint8Array {
        const mixed = new Uint8Array(BLOCK);
        for (let i = 0; i < BLOCK; i++) mixed[i] = chunk[i]! ^ this.#iv[i]!;
        return this.#aes.encryptBlock(mixed);
    }

    decrypt(chunk: Uint8Array): Uint8Array {
        const plain = this.#aes.decryptBlock(chunk);
        for (let i = 0; i < BLOCK; i++) plain[i]! ^= this.#iv[i]!;
        return plain;
    }
}
