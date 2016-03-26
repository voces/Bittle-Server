"use strict";

const EventEmitter = require("events");

let lastKey = 0;

class Key extends EventEmitter {

    constructor(timeout, noAutoExpire) {
        super();
        
        this.id = Date.now();

        while (this.id === lastKey)
            this.id++;

        lastKey = this.id;

        if (typeof timeout === "undefined") this.timeout = 30000;
        else this.timeout = timeout;

        if (!noAutoExpire) this.timer = setTimeout(this.expire, this.timeout);

    }

    expire() {
        this.expired = true;
    }

}

module.exports = Key;
