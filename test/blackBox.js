
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
    return new Test(message, action, callback, silent);

}

function resolve(obj, property) {
    let placeholder = {};
    placeholder.toJSON = placeholder.toString = () => obj[property];
    return placeholder;
}

let state = {};

let tester = new Tester([

    //Basic request enforcement
    // ["hi", {id: "onReject", reason: "Invalid JSON."}],
    // [12, {id: "onReject", reason: "JSON is not an object."}],
    // ['"hi"', {id: "onReject", reason: "JSON is not an object."}],
    // [true, {id: "onReject", reason: "JSON is not an object."}],
    // [false, {id: "onReject", reason: "JSON is not an object."}],
    // [[], {id: "onReject", reason: "JSON is not an object."}],
    // ["{}", {id: "onReject", reason: "ID is not defined."}],
    // [{}, {id: "onReject", reason: "ID is not defined."}],
    // [{id: 7}, {id: "onReject", reason: "ID is not a string."}],
    // [{id: ""}, {id: "onReject", reason: "ID is an empty string."}],

    //Remove any temporary database objects
    [{id: "clean"}, {id: "clean", status: "closed"}],

    //Invalid request due to not being authorized
    // [{id: "potato"}, {id: "potato", status: "failed", reason: "Request ID is not valid or is not allowed before logging in."}],

    //Testing of parameters
    // [{id: "register"}, {id: "register", status: "failed", reason: "Missing parameter name."}],
    // [{id: "register", name: 15}, {id: "register", status: "failed", reason: "Mistyped parameter name. Should be type string."}],

    //Testing of preauth things
    [{id: "register", name: "temp_1", pass: "passphrase"}, {id: "register", status: "closed"}],
    [{id: "register", name: "temp_2", pass: "passphrase"}, {id: "register", status: "closed"}, true],
    // [{id: "register", name: "temp_3", pass: "passphrase"}, {id: "register", status: "closed"}, true],
    // [{id: "register", name: "temp_4", pass: "passphrase"}, {id: "register", status: "closed"}, true],
    // [{id: "register", name: "temp_1", pass: "passphrase"}, {id: "register", status: "failed", reason: "Name is already taken."}],
    // [{id: "login", name: "temp_1", pass: "badpass"}, {id: "login", status: "failed", reason: "Incorrect pass."}],
    [{id: "login", name: "temp_1", pass: "passphrase"}, {id: "login", status: "closed"}],
    // [{id: "logout"}, {id: "logout", status: "closed"}],
    // [{id: "changePass", name: "temp_1", pass: "passphrase", newPass: "newPass"}, {id: "changePass", status: "closed"}],
    // [{id: "changeEmail", name: "temp_1", pass: "newPass", newEmail: "test@test.test"}, {id: "changeEmail", status: "closed"}],
    // [{id: "login", name: "temp_1", pass: "passphrase"}, {id: "login", status: "failed", reason: "Incorrect pass."}],
    // [{id: "login", name: "temp_1", pass: "newPass"}, {id: "login", status: "closed"}],

    // [{id: "resetPass", name: "temp_1"}, {id: "resetPass", status: "closed"}],

    //Testing of postauth auth things
    // [{id: "changePass", name: "temp_1", pass: "newPass", newPass: "passphrase"}, {id: "changePass", status: "closed"}],
    // [{id: "changeEmail", name: "temp_1", pass: "passphrase", newEmail: "test2@test.test"}, {id: "changeEmail", status: "closed"}],
    // [{id: "logout"}, {id: "logout", status: "closed"}],
    // [{id: "login", name: "temp_1", pass: "newPass"}, {id: "login", status: "failed", reason: "Incorrect pass."}],
    // [{id: "login", name: "temp_1", pass: "passphrase"}, {id: "login", status: "closed"}],

    //Testing of repos
    [{id: "createRepo", name: "temp_1"}, {id: "createRepo", status: "closed"}],
    // [{id: "createRepo", name: "temp_1"}, {id: "createRepo", status: "failed", reason: "Name is already taken."}],
    // [{id: "deleteRepo", repo: "temp_1"}, result => {state.key = result.json.key; return result.json.id === "deleteRepo" && typeof result.json.key === "number";}],
    // [{id: "deleteRepoConfirm", key: resolve(state, "key")}, {id: "deleteRepoConfirm", status: "failed", reason: "Feature not yet coded."}],

    //Permissions
    // [{id: "setPermission", repo: "temp_1", user: "temp_5", role: "contributor"}, {id: "setPermission", status: "failed", reason: "User does not exist."}],
    // [{id: "setPermission", repo: "temp_1", user: "temp_2", role: "manager"}, {id: "setPermission", status: "closed"}],
    // [{id: "setPermission", repo: "temp_1", user: "temp_2", role: "none"}, {id: "setPermission", status: "closed"}],
    // [{id: "deletePermission", repo: "temp_1", user: "temp_2"}, {id: "deletePermission", status: "failed", reason: "User does not have any permission."}],
    // [{id: "logout"}, {id: "logout", status: "closed"}, true],
    // [{id: "login", name: "temp_2", pass: "passphrase"}, {id: "login", status: "closed"}, true],
    // [{id: "setPermission", repo: "temp_1", user: "temp_3", role: "owner"}, {id: "setPermission", status: "failed", reason: "Not enough permission."}],
    // [{id: "setPermission", repo: "temp_1", user: "temp_3", role: "contributor"}, {id: "setPermission", status: "closed"}],
    // [{id: "logout"}, {id: "logout", status: "closed"}, true],
    // [{id: "login", name: "temp_3", pass: "passphrase"}, {id: "login", status: "closed"}, true],
    // [{id: "setPermission", repo: "temp_1", user: "temp_4", role: "contributor"}, {id: "setPermission", status: "failed", reason: "Not enough permission."}],
    // [{id: "logout"}, {id: "logout", status: "closed"}, true],
    // [{id: "login", name: "temp_1", pass: "passphrase"}, {id: "login", status: "closed"}, true],

    //Files
    [{id: "createFile", repo: "temp_1", file: "sample.txt"}, {id: "createFile", status: "closed"}],
    // [{id: "createFile", repo: "temp_1", file: "sample.txt"}, {id: "createFile", status: "failed", reason: "File already exists."}],
    // [{id: "moveFile", repo: "temp_1", file: "magic.txt", newPath: "sample.txt"}, {id: "moveFile", status: "failed", reason: "File does not exist."}],
    // [{id: "moveFile", repo: "temp_1", file: "sample.txt", newPath: "magic.txt"}, {id: "moveFile", status: "closed"}],
    // [{id: "moveFile", repo: "temp_1", file: "magic.txt", newPath: "sample.txt"}, {id: "moveFile", status: "closed"}, true],
    [{id: "deleteFile", repo: "temp_1", file: "magic.txt"}, {id: "deleteFile", status: "failed", reason: "File does not exist."}],
    [{id: "deleteFile", repo: "temp_1", file: "sample.txt"}, {id: "deleteFile", status: "closed"}],

    //Directories
    // [{id: "createDirectory", repo: "temp_1", directory: "sample"}, {id: "createDirectory", status: "failed", reason: "Feature not yet coded."}],
    // [{id: "moveDirectory", repo: "temp_1", directory: "sample", newPath: "magic"}, {id: "moveDirectory", status: "failed", reason: "Feature not yet coded."}],
    // [{id: "deleteDirectory", repo: "temp_1", directory: "magic"}, {id: "deleteDirectory", status: "failed", reason: "Feature not yet coded."}],

    //Lines
    // [{id: "insert", repo: "temp_1", file: "sample.txt", lineId: "0", col: 0, data: "Hello World"}, {id: "insert", status: "failed", reason: "Feature not yet coded."}],
    // [{id: "erase", repo: "temp_1", file: "sample.txt", lineId: "0", col: 6, count: 1}, {id: "erase", status: "failed", reason: "Feature not yet coded."}],
    // [{id: "split", repo: "temp_1", file: "sample.txt", lineId: "0", col: 6, newLineId: "1"}, {id: "split", status: "failed", reason: "Feature not yet coded."}],
    // [{id: "merge", repo: "temp_1", file: "sample.txt", lineId: "1"}, {id: "merge", status: "failed", reason: "Feature not yet coded."}],


], {newTest: newTest, timeout: 5000});

let ws = new WebSocket("wss://notextures.io:8086");

ws.addEventListener("open", event => tester.start());
ws.addEventListener("message", event => tester.event(event));
