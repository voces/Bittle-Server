
"use strict";

const EventEmitter = require("events"),

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

            this.finish({
                id: "onReject",
                reason: "Bad auth ID.",
                data: this.json
            });

        } else {

            //Handle all other events here

            this.finish({
                id: "onReject",
                reason: "Bad ID.",
                data: this.json
            });

        }

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

        if (this.part > 0) json.part = ++this.part;
        else this.part++;

        this.client.send(json);

    }

}

module.exports = Request;
