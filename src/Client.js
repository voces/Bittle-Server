
"use strict";

const EventEmitter = require("events"),
    colors = require("colors"),

    Request = require("./Request");

const EVENTS = {
    AUTH: ["register", "login", "changePass", "changeEmail", "resetPass"],
    PERMISSION: ["addPermission", "addPermissionConfirm", "removePermission"],
    REPO: ["createRepo", "deleteRepo", "mergeRepo"],
    SYNC: ["create", "createDirectory", "insert", "erase", "split", "merge", "rename", "move"]
};

class Client extends EventEmitter {

    constructor(socket) {

        super();

        this.socket = socket;

        socket.on("close", this.onClose.bind(this));
        socket.on("message", this.onMessage.bind(this));
        socket.on("error", this.onError.bind(this));
        socket.on("ping", this.onPing.bind(this));
        socket.on("pong", this.onPong.bind(this));

        this.log("New connection");

        this.authenticated = false;

        this.requestQueue = [];

    }

    get name() {

        if (this.socket.family = "IPv6") return `[${this.socket.ip}]:${this.socket.port}`;

        return `${this.socket.ip}:${this.socket.port}`;

    }

    log() {

        console.log(...[colors.green(`[${this.name}]`), ...arguments]);

    }

    send(json) {

        json.time = Date.now();

        this.socket.send(JSON.stringify(json));

    }

    onClose(code, message) {

        console.log("onClose", code, message);

    }

    newRequest(json) {

        let request = new Request(this, json);

        if (this.requestQueue.push(request) === 1)
            request.process();

        request.on("close", this.finishRequest)

    }

    finishRequest() {

        this.requestQueue.shift();

        if (this.requestQueue.length) this.requestQueue[0].process();

    }

    onMessage(data, flags) {

        data = data.toString();

        let json;

        try {

            json = JSON.parse(data);

        } catch (err) {

            this.send({
                id: "onReject",
                reason: "Invalid JSON.",
                data: data
            });

            return;

        }

        if (typeof json !== "object") console.error("Can this happen?");

        if (json instanceof Array) for (let i = 0; i < json.length; i++) this.newRequest(json[i]);
        else this.newRequest(json);

    }

    onError(error) {

        console.log("onError", error);

    }

    onPing(data, flags) {

        console.log("onPing", data, flags);

    }

    onPong(data, flags) {

        console.log("onPong", data, flags);

    }

}

module.exports = Client;
