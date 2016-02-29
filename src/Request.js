
"use strict";

const EventEmitter = require("events");

class Request extends EventEmitter {

    constructor(client, json) {

        super();

        this.client = client;
        this.json = json;
        this.part = 0;

        this.status = "queued";

        console.log("Request", this.json.id);

    }

    process() {

        this.status = "open";

        this.send();

        this.finish();

    }

    finish(json) {

        this.status = "closed";

        this.send(json);

    }

    send(json) {

        json = json || {};

        json.status = this.status;

        if (this.part > 0) json.part = ++this.part;
        else this.part++;

        this.client.send(json);

        this.emit("close");

    }

}

module.exports = Request;
