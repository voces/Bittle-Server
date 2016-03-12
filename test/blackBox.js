
"use strict";

function defaultCallback(result) {

    for (let attribute in this.attributes)
        if (result.json[attribute] !== this.attributes[attribute])
            return false;

    return true;

}

function newTest(message, action, callback) {

    //Test has no associated message
    if (arguments.length === 2) {
        callback = action;
        action = message;
        message = "";
    }

    let _action = action;

    //Cleanup action
    switch (typeof _action) {

        //If functional action is provided, use it
        //  TODO: If message is not defined, set it to the name of function or the first 30 or w/e characters of it
        case "function": break;

        //Otherwise we assume it's a send

        case "object":
            action = () => ws.send(JSON.stringify(_action));
            if (message === "") message = JSON.stringify(_action).substr(0, 90);
            break;

        default:
            action = () => ws.send(_action);
            if (message === "") message = _action.toString().substr(0, 90);
            break;

    }

    //Cleanup callback
    if (typeof callback === "object") callback = defaultCallback.bind({attributes: callback});

    //Create the test and return it
    return new Test(message, action, callback);

}

let tester = new Tester([

    //Basic request enforcement
    ["hi", {id: "onReject", reason: "Invalid JSON."}],
    [12, {id: "onReject", reason: "JSON is not an object."}],
    ['"hi"', {id: "onReject", reason: "JSON is not an object."}],
    [true, {id: "onReject", reason: "JSON is not an object."}],
    [false, {id: "onReject", reason: "JSON is not an object."}],
    [[], {id: "onReject", reason: "JSON is not an object."}],
    ["{}", {id: "onReject", reason: "ID is not defined."}],
    [{}, {id: "onReject", reason: "ID is not defined."}],
    [{id: 7}, {id: "onReject", reason: "ID is not a string."}],
    [{id: ""}, {id: "onReject", reason: "ID is an empty string."}],

    //Invalid request due to not being authorized
    [{id: "potato"}, {id: "potato", status: "failed", reason: "Request ID is not valid or is not allowed before logging in."}],

    //Testing of parameters
    [{id: "register"}, {id: "register", status: "failed", reason: "Missing parameter name."}],
    [{id: "register", name: 15}, {id: "register", status: "failed", reason: "Mistyped parameter name. Should be type string."}],

    //Testing of unimplemented things/tests (may want to flesh this out first?)
    [{id: "register", name: "coer", pass: "passphrase"}, {id: "register", status: "closed"}],
    [{id: "login", name: "coer", pass: "passphrase"}, {id: "login", status: "closed"}],
    [{id: "changePass", name: "coer", pass: "passphrase", newPass: "newPass"}, {id: "changePass", status: "closed"}],
    [{id: "changeEmail", name: "coer", pass: "passphrase", newEmail: "newEmail"}, {id: "changeEmail", status: "closed"}],
    [{id: "resetPass", name: "coer"}, {id: "resetPass", status: "closed"}]

], {newTest: newTest});

let ws = new WebSocket("wss://notextures.io:8086");

ws.addEventListener("open", event => tester.start());
ws.addEventListener("message", event => tester.event(event));
