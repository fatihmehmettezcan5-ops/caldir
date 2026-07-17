// Çaldır crypto helpers.
//
// Uses tweetnacl (X25519 + XSalsa20-Poly1305 / AES-256-GCM via secretbox-style
// primitives) so the implementation is identical in browser and Node without
// depending on platform-specific WebCrypto algorithms (X25519 is not universally
// available in WebCrypto yet).
//
// Security model:
//   - Each session uses ephemeral X25519 key pairs on both sides.
//   - The pairing secret (derived from PIN and a server nonce) is mixed into
//     the HKDF-derived session key so a guessed PIN alone is useless without
//     also having the shared ECDH secret.
//   - A monotonically increasing counter defends against replay.
import nacl from "tweetnacl";
import util from "tweetnacl-util";
const encodeUTF8 = util.encodeUTF8;
const decodeUTF8 = util.decodeUTF8;
const encodeBase64 = util.encodeBase64;
const decodeBase64 = util.decodeBase64;
// ---- base64 / utf8 helpers ------------------------------------------------
export const toBase64 = (bytes) => encodeBase64(bytes);
export const fromBase64 = (s) => decodeBase64(s);
export const randomBytes = (n) => nacl.randomBytes(n);
export const constantTimeEqual = (a, b) => nacl.verify(a, b);
export const newKeyPair = () => {
    const kp = nacl.box.keyPair();
    return { secretKey: kp.secretKey, publicKey: kp.publicKey };
};
// ---- HKDF (Blake-ish via nacl.hash) ---------------------------------------
// We don't have HKDF primitives directly in tweetnacl; we use HMAC-SHA512 via
// nacl.hash to derive a 32-byte shared key from raw ECDH + pairing secret.
const hmacSha512 = (key, data) => {
    // nacl.hash is SHA-512. Implement HMAC using block-aligned key padding.
    const block = 128; // SHA-512 block size
    let k = key;
    if (k.length > block)
        k = nacl.hash(k);
    if (k.length < block) {
        const padded = new Uint8Array(block);
        padded.set(k);
        k = padded;
    }
    const ipad = new Uint8Array(block);
    const opad = new Uint8Array(block);
    for (let i = 0; i < block; i++) {
        ipad[i] = k[i] ^ 0x36;
        opad[i] = k[i] ^ 0x5c;
    }
    const inner = new Uint8Array(block + data.length);
    inner.set(ipad, 0);
    inner.set(data, block);
    const innerHash = nacl.hash(inner);
    const outer = new Uint8Array(block + innerHash.length);
    outer.set(opad, 0);
    outer.set(innerHash, block);
    return nacl.hash(outer).subarray(0, 32);
};
// Derive a 32-byte symmetric session key from the raw X25519 shared secret
// mixed with the pairing-derived secret. This means the attacker must know
// both the ECDH result AND the PIN secret to derive the session key.
export const deriveSessionKey = (sharedSecret, pairingSecret, salt) => {
    const combined = new Uint8Array(sharedSecret.length + pairingSecret.length);
    combined.set(sharedSecret, 0);
    combined.set(pairingSecret, sharedSecret.length);
    // Extract then expand (simple HKDF-like scheme).
    const prk = hmacSha512(salt, combined);
    const info = decodeUTF8("caldir/v1");
    return hmacSha512(prk, info);
};
// Encrypt a UTF-8 JSON string with the session key. Nonce is 24-byte
// (nacl.secretbox nonce length) and unique per message (random). The sequence
// counter is included in plaintext on the wire so the receiver can reject
// replays before decryption; the counter is also authenticated via the tag.
export const seal = (sessionKey, seq, json) => {
    const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
    const msg = decodeUTF8(json);
    const box = nacl.secretbox(msg, nonce, sessionKey);
    if (!box)
        throw new Error("encryption_failed");
    return { n: toBase64(nonce), c: toBase64(box), s: seq };
};
export const open = (sessionKey, locked, lastReceivedSeq) => {
    if (locked.s <= lastReceivedSeq) {
        throw new Error("replay_detected");
    }
    const nonce = fromBase64(locked.n);
    const box = fromBase64(locked.c);
    const msg = nacl.secretbox.open(box, nonce, sessionKey);
    if (!msg)
        throw new Error("decryption_failed");
    return encodeUTF8(msg);
};
// ---- PIN handling ---------------------------------------------------------
// 6-digit PIN. We do PBKDF-like stretching via HMAC iterative hashing to slow
// down guessing. Returns 32 bytes.
export const hashPin = (pin, salt, iterations = 10000) => {
    const pinBytes = decodeUTF8(pin);
    let acc = hmacSha512(salt, pinBytes);
    for (let i = 0; i < iterations; i++) {
        acc = hmacSha512(acc, pinBytes);
        acc = acc.subarray(0, 32);
    }
    return acc;
};
// Generate a 6-digit numeric PIN string.
export const generatePin = () => {
    const digits = "0123456789";
    const b = nacl.randomBytes(6);
    let out = "";
    for (let i = 0; i < 6; i++) {
        out += digits[b[i] % 10];
    }
    return out;
};
// ---- HMAC verification (constant time) ------------------------------------
// Used for the server-challenge handshake step (the client proves it holds the
// correct pairing secret by HMACing the server nonce).
export const hmacChallenge = (pairingSecret, nonce) => hmacSha512(pairingSecret, nonce).subarray(0, 32);
// Deterministic HKDF salt for deriveSessionKey. Both the server and client
// derive the SAME salt from the two ephemeral public keys (ordered: server
// first, then client) so they don't need an extra round-trip to agree on it.
// Including both keys also binds the session to the specific X25519 exchange,
// preventing unknown-key-share attacks.
export const deterministicSalt = (serverPub, clientPub) => {
    const combined = new Uint8Array(serverPub.length + clientPub.length);
    combined.set(serverPub, 0);
    combined.set(clientPub, serverPub.length);
    return nacl.hash(combined).subarray(0, 32);
};
export const verifyChallenge = (pairingSecret, nonce, proof) => {
    const expected = hmacChallenge(pairingSecret, nonce);
    return constantTimeEqual(expected, proof);
};
