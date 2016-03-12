
"use strict";

const EventEmitter = require("events"),
    colors = require("colors"),

    //A list of all events
    EVENTS = {
        PREAUTH: ["register", "login", "changePass", "changeEmail", "resetPass"],
        POSTAUTH: ["changePass", "changeEmail", "resetPass", "logout"],
        PERMISSION: ["addPermission", "addPermissionConfirm", "removePermission"],
        REPO: ["createRepo", "deleteRepo", "mergeRepo"],
        SYNC: ["create", "createDirectory", "insert", "erase", "split", "merge", "rename", "move"]
    };

class Request extends EventEmitter {

    //All events start queued
    constructor(client, json) {

        super();

        this.client = client;
        this.json = json;
        this.part = 0;

        this.status = "queued";

    }

    process() {

        this.status = "open";

        // this.client.log("[PROCESS]", this.json.id);

        if (!this.client.authenticated) {

            //Handle PREAUTH events here

            switch (this.json.id) {

                case "register": this.enforceParamsAndCall({name: "string", pass: "string"}, this.client.register); break;
                case "login": this.enforceParamsAndCall({name: "string", pass: "string"}, this.client.login); break;
                case "changePass": this.enforceParamsAndCall({name: "string", pass: "string", newPass: "string"}, this.client.changePassAuth); break;
                case "changeEmail": this.enforceParamsAndCall({name: "string", pass: "string", newEmail: "string"}, this.client.changeEmailAuth); break;
                case "resetPass": this.enforceParamsAndCall({name: "string"}, this.client.resetPass); break;
                default: this.fail({reason: "Request ID is not valid or is not allowed before logging in.", data: this.json}); break;

            }

        } else {

            //Handle all other events here

            this.finish({id: "onReject", reason: "Bad ID.", data: this.json});

        }

    }

    enforceParamsAndCall(paramTypes, callback) {

        let params = [this];

        for (let param in paramTypes)
            if (typeof this.json[param] === "undefined") {
                this.fail({reason: `Missing parameter ${param}.`});
                return;
            } else if (typeof this.json[param] !== paramTypes[param]) {
                this.fail({reason: `Mistyped parameter ${param}. Should be type ${paramTypes[param]}.`});
                return;
            } else params.push(this.json[param]);

        try {

            callback(...params);

        } catch (err) {

            this.error("Undefined callback", this.json.id);
            this.fail({reason: "Server error: undefined callback."});
            return;

        }

    }

    fail(json) {

        this.status = "failed";

        json.data = this.json;

        this.send(json);

        this.emit("fail", this);

    }

    finish(json) {

        this.status = "closed";

        this.send(json);

        // this.client.log("[FINISH]", this.json.id);

        this.emit("finish", this);

    }

    //Set status of all packets; set part if part > 1
    send(json) {

        json = json || {};

        json.status = this.status;

        if (typeof json.id !== "string") json.id = this.json.id;

        if (this.part > 0) json.part = ++this.part;
        else this.part++;

        this.client.send(json);

    }

    error() {

        this.client.error(...[colors.red(`[${this.json.id}]`), ...arguments]);

    }

}

module.exports = Request;
