// Çaldır session (platform-agnostic).
//
// Pure handshake + encrypted-channel state machine for a single WebSocket
// connection. Platform concerns (where the WS came from, how the platform
// actually performs device control) are injected via the `Platform` and a
// `send` callback. This lets the exact same logic run on Node (ws) and inside
// Android (Capacitor plugin).
import nacl from "tweetnacl";
import { PROTOCOL_VERSION, deriveSessionKey, deterministicSalt, fromBase64, toBase64, newKeyPair, seal, open, constantTimeEqual, } from "./index.js";
export class Session {
    id;
    platform;
    pairing;
    send;
    hs = null;
    sessionKey = null;
    constructor(opts) {
        this.id = opts.id;
        this.platform = opts.platform;
        this.pairing = opts.pairing;
        this.send = opts.send;
    }
    async handleFrame(frame) {
        switch (frame.type) {
            case "hello":
                return this.handleHello(frame);
            case "pin_verify":
                return this.handlePinVerify(frame);
            case "keyx":
                return this.handleKeyx(frame);
            case "enc":
                return this.handleEncrypted(frame.payload);
            case "bye":
                return;
            case "error":
                return;
            default:
                return this.send({
                    type: "error",
                    code: "bad_frame",
                    message: "unknown frame",
                });
        }
    }
    handleHello(frame) {
        if (frame.v !== PROTOCOL_VERSION) {
            this.send({ type: "error", code: "version", message: "protocol version mismatch" });
            return;
        }
        const nonce = this.pairing.getPendingNonce();
        const salt = this.pairing.getPendingSalt();
        if (!nonce || !salt) {
            this.send({ type: "error", code: "no_pairing", message: "pairing not active" });
            return;
        }
        this.hs = {
            serverKeys: newKeyPair(),
            clientPub: null,
            pairingSecret: null,
            sendSeq: 0,
            recvSeq: 0,
        };
        this.send({
            type: "challenge",
            nonce: toBase64(nonce),
            salt: toBase64(salt),
        });
    }
    handlePinVerify(frame) {
        if (!this.hs) {
            this.send({ type: "error", code: "no_session", message: "hello first" });
            return;
        }
        if (!/^\d{6}$/.test(frame.pin)) {
            this.send({ type: "pin_nack", reason: "format" });
            return;
        }
        if (!this.pairing.verifyPin(frame.pin)) {
            this.send({ type: "pin_nack", reason: "wrong_pin" });
            return;
        }
        let clientPub;
        try {
            clientPub = fromBase64(frame.pub);
            if (clientPub.length !== 32)
                throw new Error("bad");
        }
        catch {
            this.send({ type: "pin_nack", reason: "bad_pub" });
            return;
        }
        const consumed = this.pairing.consumePending();
        if (!consumed) {
            this.send({ type: "pin_nack", reason: "expired" });
            return;
        }
        this.hs.pairingSecret = consumed.pairingSecret;
        this.hs.clientPub = clientPub;
        this.send({ type: "pin_ack", pub: toBase64(this.hs.serverKeys.publicKey) });
    }
    handleKeyx(frame) {
        if (!this.hs || !this.hs.pairingSecret) {
            this.send({ type: "error", code: "no_pairing", message: "pair first" });
            return;
        }
        let clientPub;
        try {
            clientPub = fromBase64(frame.pub);
            if (clientPub.length !== 32)
                throw new Error("bad");
        }
        catch {
            this.send({ type: "error", code: "bad_keyx", message: "bad pub" });
            return;
        }
        if (this.hs.clientPub && !constantTimeEqual(this.hs.clientPub, clientPub)) {
            this.send({ type: "error", code: "key_switch", message: "pubkey switched" });
            return;
        }
        this.hs.clientPub = clientPub;
        const shared = nacl.box.before(clientPub, this.hs.serverKeys.secretKey);
        const salt = deterministicSalt(this.hs.serverKeys.publicKey, clientPub);
        this.sessionKey = deriveSessionKey(shared, this.hs.pairingSecret, salt);
        this.send({ type: "keyx", pub: toBase64(this.hs.serverKeys.publicKey) });
        this.send({ type: "ready" });
    }
    async handleEncrypted(payload) {
        if (!this.sessionKey || !this.hs) {
            this.send({ type: "error", code: "not_ready", message: "channel not ready" });
            return;
        }
        if (payload.s <= this.hs.recvSeq) {
            this.send({ type: "error", code: "replay", message: "stale sequence" });
            return;
        }
        let json;
        try {
            json = open(this.sessionKey, payload, this.hs.recvSeq);
            this.hs.recvSeq = payload.s;
        }
        catch {
            this.send({ type: "error", code: "decrypt", message: "cannot decrypt" });
            return;
        }
        let msg;
        try {
            msg = JSON.parse(json);
        }
        catch {
            return;
        }
        if (msg.type === "cmd") {
            const res = await dispatchCommand(this.platform, msg);
            this.sendEncrypted(res);
        }
    }
    sendEncrypted(msg) {
        if (!this.sessionKey || !this.hs)
            return;
        const seq = this.hs.sendSeq + 1;
        this.hs.sendSeq = seq;
        const locked = seal(this.sessionKey, seq, JSON.stringify(msg));
        this.send({ type: "enc", payload: locked });
    }
    sendEvent(event) {
        this.sendEncrypted(event);
    }
    get isReady() {
        return this.sessionKey !== null && this.hs !== null;
    }
}
async function dispatchCommand(platform, cmd) {
    try {
        const result = await execCommand(platform, cmd.cmd, cmd.args);
        return { type: "ok", id: cmd.id, result };
    }
    catch (e) {
        const message = e instanceof Error ? e.message : "unknown_error";
        return { type: "err", id: cmd.id, code: "exec", message };
    }
}
async function execCommand(platform, cmd, args) {
    const b = (k) => args[k] === true || args[k] === "true" || args[k] === 1;
    const n = (k) => typeof args[k] === "number" ? args[k] : Number(args[k] ?? NaN);
    const s = (k) => typeof args[k] === "string" ? args[k] : "";
    switch (cmd) {
        case "wifi.set":
            return { enabled: await platform.setWifi(b("enabled")) };
        case "cellular.set":
            return { enabled: await platform.setCellular(b("enabled")) };
        case "bluetooth.set":
            return { enabled: await platform.setBluetooth(b("enabled")) };
        case "volume.set":
            return platform.setVolume(n("level"), (s("stream") || "ring"));
        case "device.ring":
            await platform.ring();
            return {};
        case "battery.get":
            return platform.getBattery();
        case "device.lock":
            await platform.lock();
            return {};
        case "file.list":
            return platform.listFiles(s("path") || "/");
        case "file.download":
            return platform.readFile(s("path"));
        case "file.upload":
            return platform.writeFile(s("name"), new Uint8Array());
        case "location.get":
            return platform.getLocation();
        case "notify.send":
            await platform.sendNotification(s("title"), s("body"));
            return {};
        case "ping":
            return { pong: Date.now() };
        default: {
            const _exhaustive = cmd;
            throw new Error(`unhandled_command:${_exhaustive}`);
        }
    }
}
