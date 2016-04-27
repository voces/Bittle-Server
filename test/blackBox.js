/*eslint-env browser*/
/*globals Test, Tester*/

"use strict";

function defaultCallback(result) {

    for (let attribute in this.attributes)
        if (result.json[attribute] !== this.attributes[attribute])
            return false;

    return true;

}

function newTest(message, action, callback, silent) {

    //Test has no associated message
    if (typeof message !== "string" || arguments.length === 2) {
        silent = callback;
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
            // action = () => ws.send(JSON.stringify(_action));
            action = () => {
                ws.send(JSON.stringify(_action));
                responses.push([_action]);
            };
            if (message === "") message = JSON.stringify(_action).substr(0, 90);
            break;

        default:
            // action = () => ws.send(_action);
            action = () => {
                ws.send(_action);
                responses.push([_action]);
            };
            if (message === "") message = _action.toString().substr(0, 90);
            break;

    }

    //Cleanup callback
    if (typeof callback === "object") callback = defaultCallback.bind({attributes: callback});

    //Create the test and return it
    return new Test(message, action, callback, silent);

}

/*eslint-disable no-unused-vars*/
function resolve(obj, property) {
    let placeholder = {};
    placeholder.toJSON = placeholder.toString = () => obj[property];
    return placeholder;
}

let state = {};
/*eslint-enable no-unused-vars*/

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

    //Remove any temporary database objects
    [{id: "clean"}, {id: "clean", status: "closed"}],

    //Invalid request due to not being authorized
    [{id: "potato"}, {id: "potato", status: "failed", reason: "Request ID is not valid or is not allowed before logging in."}],

    //Testing of parameters
    [{id: "register"}, {id: "register", status: "failed", reason: "Missing parameter name."}],
    [{id: "register", name: 15}, {id: "register", status: "failed", reason: "Mistyped parameter name. Should be type string."}],

    //Testing of preauth things
    [{id: "register", name: "temp_1", pass: "passphrase"}, {id: "register", status: "closed"}],
    [{id: "register", name: "temp_2", pass: "passphrase"}, {id: "register", status: "closed"}, true],
    [{id: "register", name: "temp_3", pass: "passphrase"}, {id: "register", status: "closed"}, true],
    [{id: "register", name: "temp_4", pass: "passphrase"}, {id: "register", status: "closed"}, true],
    [{id: "register", name: "temp_1", pass: "passphrase"}, {id: "register", status: "failed", reason: "Name is already taken."}],
    [{id: "login", name: "temp_1", pass: "badpass"}, {id: "login", status: "failed", reason: "Incorrect pass."}],
    [{id: "login", name: "temp_1", pass: "passphrase"}, {id: "login", status: "closed"}],
    [{id: "logout"}, {id: "logout", status: "closed"}, true],
    [{id: "changePass", name: "temp_1", pass: "badpass", newPass: "newPass"}, {id: "changePass", status: "failed", reason: "Incorrect pass."}],
    [{id: "changePass", name: "temp_1", pass: "passphrase", newPass: "newPass"}, {id: "changePass", status: "closed"}],
    [{id: "changeEmail", name: "temp_1", pass: "newPass", newEmail: "test@test.test"}, {id: "changeEmail", status: "closed"}],
    [{id: "login", name: "temp_1", pass: "passphrase"}, {id: "login", status: "failed", reason: "Incorrect pass."}],
    [{id: "login", name: "temp_1", pass: "newPass"}, {id: "login", status: "closed"}],

    //Uncoded feature:
    // [{id: "resetPass", name: "temp_1"}, {id: "resetPass", status: "closed"}],

    //Testing of postauth auth things
    [{id: "changePass", pass: "badpass", newPass: "passphrase"}, {id: "changePass", status: "failed", reason: "Incorrect pass."}],
    [{id: "changePass", pass: "newPass", newPass: "passphrase"}, {id: "changePass", status: "closed"}],
    [{id: "changeEmail", pass: "passphrase", newEmail: "test2@test.test"}, {id: "changeEmail", status: "closed"}],
    [{id: "logout"}, {id: "logout", status: "closed"}, true],
    [{id: "login", name: "temp_1", pass: "newPass"}, {id: "login", status: "failed", reason: "Incorrect pass."}],
    [{id: "login", name: "temp_1", pass: "passphrase"}, {id: "login", status: "closed"}]

], {newTest: newTest, timeout: 5000});

let ws = new WebSocket("wss://notextures.io:8086"),
    responses = [];

ws.addEventListener("open", (/*event*/) => tester.start());
ws.addEventListener("message", event => responses[responses.length - 1][1] = JSON.parse(event.data));
ws.addEventListener("message", event => tester.event(event));
