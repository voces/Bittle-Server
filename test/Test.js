
"use strict";

class Test {

    constructor(message, action, callback) {

        this.message = message;
        this.action = action;
        this.callback = callback;

    }

    finish(event) {

        event.json = JSON.parse(event.data);

        return this.callback(event);

    }

}
