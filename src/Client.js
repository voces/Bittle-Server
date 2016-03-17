
"use strict";

const EventEmitter = require("events"),
    colors = require("colors"),
    bcrypt = require("bcryptjs"),

    Request = require("./Request");

class Client extends EventEmitter {

    //Bind some events and set defaults
    constructor(server, socket) {

        super();

        this.server = server;
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

    register(request, name, pass) {

        Promise.all([

            this.server.db.userGet(name),
            this.saltPass(name, pass)

        ]).then(result => {

            let users = result[0],
                hash = result[1];

            if (users.length) {
                request.fail("Name is already taken.");
                return;
            }

            this.server.db.userCreate(name, hash, request.json.email).then(
                result => request.finish(),
                error => {this.error(error); request.fail("Unable write to database.");}
            );

        }, error => {this.error(error); request.fail("Unable to query database.");});

    }

    login(request, name, pass) {

        this.server.db.userGet(name).then(users => {

            if (users.length === 0) {

                request.fail("Account does not exist.");
                return;

            }

            if (users.length > 1) {

                this.error("Duplicate users?", name, users);
                request.fail("Duplicate users found.");
                return;

            }

            this.comparePass(name, pass, users[0].pass).then(matched => {

                if (matched) request.finish();
                else request.fail("Incorrect pass.");

            }, error => {this.error(error); request.fail("Unable to query database.");});
        }, error => {this.error(error); request.fail("Unable to query database.");});

    }

    changePassAuth(request, name, pass, newPass) {request.fail("Feature not yet coded.");}
    changeEmailAuth(request, name, pass, newEmail) {request.fail("Feature not yet coded.");}
    resetPass(request, name) {request.fail("Feature not yet coded.");}

    saltPass(name, pass) {

        return new Promise((resolve, reject) => {

            bcrypt.genSalt(10, (err, salt) => {
                bcrypt.hash(`B1tt1e${name.substr(0, 5)}${pass}`, salt, (err, hash) => {

                    if (err) reject(err);
                    else resolve(hash);

                });
            });

        });

    }

    comparePass(name, pass, hash) {

        return new Promise((resolve, reject) => {

            bcrypt.compare(`B1tt1e${name.substr(0, 5)}${pass}`, hash, (err, res) => {

                if (err) reject(err);
                else resolve(res);

            });

        });

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
        request.on("fail", this.failRequest.bind(this));

        //If the request queue was empty, start processing!
        if (this.requestQueue.push(request) === 1)
            request.process();

    }

    failRequest() {

        //TODO: Abort a transaction when implemented

        this.requestQueue.shift();

        //If there is still something in the queue, process it
        if (this.requestQueue.length) this.requestQueue[0].process();

    }

    finishRequest() {

        this.requestQueue.shift();

        //If there is still something in the queue, process it
        if (this.requestQueue.length) this.requestQueue[0].process();

    }

    //Assert all messages as proper JSON
    onMessage(data, flags) {

        data = data.toString();

        if (data.indexOf("pass") >= 0) this.log("[RECV]", data.substr(0, data.indexOf("pass") + 6), "[REDACTED]");
        else this.log("[RECV]", data);

        let json;

        try {json = JSON.parse(data);}
        catch (err) {return this.send({id: "onReject", reason: "Invalid JSON.", data: data})};

        if (typeof json !== "object" || json instanceof Array) return this.send({id: "onReject", reason: "JSON is not an object.", data: data});
        if (typeof json.id === "undefined") return this.send({id: "onReject", reason: "ID is not defined.", data: data});
        if (typeof json.id !== "string") return this.send({id: "onReject", reason: "ID is not a string.", data: data});
        if (json.id === "") return this.send({id: "onReject", reason: "ID is an empty string.", data: data});

        this.newRequest(json);

        //Push individual events into a queue
        // if (json instanceof Array)
        //
        //     for (let i = 0; i < json.length; i++)
        //
        //         if (typeof json[i] === "object") this.newRequest(json[i]);
        //         else {
        //
        //             this.send({
        //                 id: "onReject",
        //                 reason: "SubRequest is not an object.",
        //                 data: json[i]
        //             });
        //
        //             return;
        //
        //         }
        //
        // else this.newRequest(json);

    }

    onClose(code, message) {

        this.log("Connection closed");

    }

    onError(error) {

        this.log("onError", error);

    }

    //Set all out-going communications with the time
    send(json) {

        json.time = Date.now();

        let s = JSON.stringify(json);

        this.log("[SEND]", s);

        this.socket.send(s);

    }

    //Decorate log events with a stamp of the client
    log() {

        console.log(...[colors.green(`[${this.name}]`), ...arguments]);

    }

    //Decorate error events with a stamp of the client
    error() {

        console.error(...[colors.green(`[${this.name}]`), ...arguments]);

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
