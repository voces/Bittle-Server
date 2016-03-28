
"use strict";

class Test {

    constructor(message, action, callback, silent) {

        this.message = message;
        this.action = action;
        this.callback = callback;
        this.silent = silent;

    }

    finish(event) {

        event.json = JSON.parse(event.data);

        console.log(event.json);

        return this.callback(event);

    }

}
