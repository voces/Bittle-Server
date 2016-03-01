
"use strict";

const EventEmitter = require("events"),
    colors = require("colors"),

    Request = require("./Request");

class Client extends EventEmitter {

    //Bind some events and set defaults
    constructor(socket) {

        super();

        this.socket = socket;

        socket.on("close", this.onClose.bind(this));
        socket.on("message", this.onMessage.bind(this));
        socket.on("error", this.onError.bind(this));
        // socket.on("ping", this.onPing.bind(this));
        // socket.on("pong", this.onPong.bind(this));

        this.authenticated = false;

        this.requestQueue = [];

        this.log("New connection");

    }

    //A general getter; will use a .user property once authentication is a go,
    //  otherwise we just use the IP
    get name() {

        if (this.socket.family = "IPv6")
            return `[${this.socket.ip}]:${this.socket.port}`;

        return `${this.socket.ip}:${this.socket.port}`;

    }

    //Decorate log events with a stamp of the client
    log() {

        console.log(...[colors.green(`[${this.name}]`), ...arguments]);

    }

    //Set all out-going communications with the time
    send(json) {

        json.time = Date.now();

        let s = JSON.stringify(json);

        this.log("[SEND]", s);

        this.socket.send(s);

    }

    onClose(code, message) {

        console.log("onClose", code, message);

    }

    //A factory-like way of handling requests, since a client must queue them
    newRequest(json) {

        //Assert all events have an id
        if (typeof json.id === "undefined") {

            this.send({
                id: "onReject",
                reason: "No ID.",
                data: json
            });

            return;

        }

        let request = new Request(this, json);

        //Bind a finish listener first
        request.on("finish", this.finishRequest.bind(this));

        //If the request queue was empty, start processing!
        if (this.requestQueue.push(request) === 1)
            request.process();

    }

    finishRequest() {

        this.requestQueue.shift();

        //If there is still something in the queue, process it
        if (this.requestQueue.length) this.requestQueue[0].process();

    }

    //Assert all messages as proper JSON
    onMessage(data, flags) {

        data = data.toString();

        this.log("[RECV]", data);

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

        //Push individual events into a queue
        if (json instanceof Array) for (let i = 0; i < json.length; i++) this.newRequest(json[i]);
        else this.newRequest(json);

    }

    onError(error) {

        console.log("onError", error);

    }

    // onPing(data, flags) {
    //
    //     console.log("onPing", data, flags);
    //
    // }
    //
    // onPong(data, flags) {
    //
    //     console.log("onPong", data, flags);
    //
    // }

}

module.exports = Client;
