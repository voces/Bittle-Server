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
    // [{id: "register", name: "temp_2", pass: "passphrase"}, {id: "register", status: "closed"}, true],
    // [{id: "register", name: "temp_3", pass: "passphrase"}, {id: "register", status: "closed"}, true],
    // [{id: "register", name: "temp_4", pass: "passphrase"}, {id: "register", status: "closed"}, true],
    // [{id: "register", name: "temp_1", pass: "passphrase"}, {id: "register", status: "failed", reason: "Name is already taken."}],
    // [{id: "login", name: "temp_1", pass: "badpass"}, {id: "login", status: "failed", reason: "Incorrect pass."}],
    [{id: "login", name: "temp_1", pass: "passphrase"}, {id: "login", status: "closed"}],
    // [{id: "logout"}, {id: "logout", status: "closed"}, true],
    // [{id: "changePass", name: "temp_1", pass: "badpass", newPass: "newPass"}, {id: "changePass", status: "failed", reason: "Incorrect pass."}],
    // [{id: "changePass", name: "temp_1", pass: "passphrase", newPass: "newPass"}, {id: "changePass", status: "closed"}],
    // [{id: "changeEmail", name: "temp_1", pass: "newPass", newEmail: "test@test.test"}, {id: "changeEmail", status: "closed"}],
    // [{id: "login", name: "temp_1", pass: "passphrase"}, {id: "login", status: "failed", reason: "Incorrect pass."}],
    // [{id: "login", name: "temp_1", pass: "newPass"}, {id: "login", status: "closed"}],

    //Uncoded feature:
    // [{id: "resetPass", name: "temp_1"}, {id: "resetPass", status: "closed"}],

    //Testing of postauth auth things
    // [{id: "changePass", pass: "badpass", newPass: "passphrase"}, {id: "changePass", status: "failed", reason: "Incorrect pass."}],
    // [{id: "changePass", pass: "newPass", newPass: "passphrase"}, {id: "changePass", status: "closed"}],
    // [{id: "changeEmail", pass: "passphrase", newEmail: "test2@test.test"}, {id: "changeEmail", status: "closed"}],
    // [{id: "logout"}, {id: "logout", status: "closed"}, true],
    // [{id: "login", name: "temp_1", pass: "newPass"}, {id: "login", status: "failed", reason: "Incorrect pass."}],
    // [{id: "login", name: "temp_1", pass: "passphrase"}, {id: "login", status: "closed"}],

    //Testing of repos
    [{id: "createRepo", name: "temp_1"}, {id: "createRepo", status: "closed"}],
    // [{id: "createRepo", name: "temp_1"}, {id: "createRepo", status: "failed", reason: "Name is already taken."}],

    //Uncoded feature:
    // [{id: "deleteRepo", repo: "temp_1"},
    //     result => {state.key = result.json.key; return result.json.id === "deleteRepo" && typeof result.json.key === "number";}],
    // [{id: "deleteRepoConfirm", key: resolve(state, "key")}, {id: "deleteRepoConfirm", status: "failed", reason: "Feature not yet coded."}],

    //Roles
    // [{id: "setRole", repo: "temp_1", user: "temp_5", role: "contributor"}, {id: "setRole", status: "failed", reason: "User does not exist."}],
    // [{id: "setRole", repo: "temp_1", user: "temp_2", role: "manager"}, {id: "setRole", status: "closed"}],
    // [{id: "setRole", repo: "temp_1", user: "temp_3", role: "manager"}, {id: "setRole", status: "closed"}, true],
    // [{id: "setRole", repo: "temp_1", user: "temp_3", role: "none"}, {id: "setRole", status: "closed"}],
    // [{id: "setRole", repo: "temp_1", user: "temp_3", role: "none"}, {id: "setRole", status: "failed", reason: "User does not have any role."}],
    // [{id: "setRole", repo: "temp_1", user: "temp_3", role: "manager"}, {id: "setRole", status: "closed"}, true],
    // [{id: "deleteRole", repo: "temp_1", user: "temp_3"}, {id: "deleteRole", status: "closed"}],
    // [{id: "deleteRole", repo: "temp_1", user: "temp_3"}, {id: "deleteRole", status: "failed", reason: "User does not have any role."}],
    // [{id: "logout"}, {id: "logout", status: "closed"}, true],
    // [{id: "login", name: "temp_2", pass: "passphrase"}, {id: "login", status: "closed"}, true],
    // [{id: "setRole", repo: "temp_1", user: "temp_3", role: "owner"}, {id: "setRole", status: "failed", reason: "Not enough permission."}],
    // [{id: "setRole", repo: "temp_1", user: "temp_3", role: "contributor"}, {id: "setRole", status: "closed"}],
    // [{id: "logout"}, {id: "logout", status: "closed"}, true],
    // [{id: "login", name: "temp_3", pass: "passphrase"}, {id: "login", status: "closed"}, true],
    // [{id: "setRole", repo: "temp_1", user: "temp_4", role: "contributor"}, {id: "setRole", status: "failed", reason: "Not enough permission."}],
    // [{id: "logout"}, {id: "logout", status: "closed"}, true],
    // [{id: "login", name: "temp_1", pass: "passphrase"}, {id: "login", status: "closed"}, true],

    //Files
    // [{id: "createFile", repo: "temp_2", file: "sample.txt"}, {id: "createFile", status: "failed", reason: "Repo does not exist."}],
    [{id: "createFile", repo: "temp_1", file: "sample.txt"}, {id: "createFile", status: "closed"}],
    // [{id: "createFile", repo: "temp_1", file: "sample.txt"}, {id: "createFile", status: "failed", reason: "File already exists."}],
    // [{id: "moveFile", repo: "temp_1", file: "magic.txt", newPath: "sample.txt"}, {id: "moveFile", status: "failed", reason: "File does not exist."}],
    // [{id: "moveFile", repo: "temp_1", file: "sample.txt", newPath: "sample.txt"}, {id: "moveFile", status: "failed", reason: "File already exists."}],
    // [{id: "moveFile", repo: "temp_1", file: "sample.txt", newPath: "magic.txt"}, {id: "moveFile", status: "closed"}],
    // [{id: "moveFile", repo: "temp_1", file: "magic.txt", newPath: "sample.txt"}, {id: "moveFile", status: "closed"}],
    // [{id: "deleteFile", repo: "temp_1", file: "magic.txt"}, {id: "deleteFile", status: "failed", reason: "File does not exist."}],
    // [{id: "deleteFile", repo: "temp_1", file: "sample.txt"}, {id: "deleteFile", status: "closed"}],
    // [{id: "createFile", repo: "temp_1", file: "sample.txt"}, {id: "createFile", status: "closed"}, true],
    // [{id: "logout"}, {id: "logout", status: "closed"}, true],
    // [{id: "login", name: "temp_2", pass: "passphrase"}, {id: "login", status: "closed"}, true],
    // [{id: "createFile", repo: "temp_1", file: "magic.txt"}, {id: "createFile", status: "failed", reason: "Not enough permission."}],
    // [{id: "logout"}, {id: "logout", status: "closed"}, true],
    // [{id: "login", name: "temp_1", pass: "passphrase"}, {id: "login", status: "closed"}, true],

    //Directories (depreciated)
    // [{id: "createDirectory", repo: "temp_1", directory: "sample"}, {id: "createDirectory", status: "closed"}],
    // [{id: "createDirectory", repo: "temp_1", directory: "sample"}, {id: "createDirectory", status: "failed", reason: "Directory already exists."}],
    // [{id: "moveDirectory", repo: "temp_1", directory: "magic", newPath: "magic"},
    //     {id: "moveDirectory", status: "failed", reason: "Directory does not exist."}],
    // [{id: "moveDirectory", repo: "temp_1", directory: "sample", newPath: "magic"}, {id: "moveDirectory", status: "closed"}],
    // [{id: "moveDirectory", repo: "temp_1", directory: "magic", newPath: "sample"}, {id: "moveDirectory", status: "closed"}, true],
    // [{id: "deleteDirectory", repo: "temp_1", directory: "sample"}, {id: "deleteDirectory", status: "closed"}],

    //Lines
    [{id: "insert", repo: "temp_1", file: "magic.txt", lineId: "0", col: 0, data: "Hello World"},
        {id: "insert", status: "failed", reason: "File does not exist."}],
    [{id: "insert", repo: "temp_1", file: "sample.txt", lineId: "0", col: 0, data: "Hello World"}, {id: "insert", status: "closed"}],
    [{id: "getLine", repo: "temp_1", file: "sample.txt", lineId: "0"}, {id: "getLine", status: "closed", line: "Hello World"}],
    [{id: "erase", repo: "temp_1", file: "sample.txt", lineId: "0", col: 5, count: 1}, {id: "erase", status: "closed"}],
    [{id: "getLine", repo: "temp_1", file: "sample.txt", lineId: "0"}, {id: "getLine", status: "closed", line: "HelloWorld"}],
    [{id: "split", repo: "temp_1", file: "sample.txt", lineId: "0", col: 5, newLineId: "1"}, {id: "split", status: "closed"}],
    [{id: "getLine", repo: "temp_1", file: "sample.txt", lineId: "0"}, {id: "getLine", status: "closed", line: "Hello"}],
    [{id: "getLine", repo: "temp_1", file: "sample.txt", lineId: "1"}, {id: "getLine", status: "closed", line: "World"}],
    [{id: "split", repo: "temp_1", file: "sample.txt", lineId: "1", col: -1, newLineId: "2"}, {id: "split", status: "closed"}],
    [{id: "getLine", repo: "temp_1", file: "sample.txt", lineId: "1"}, {id: "getLine", status: "closed", line: "World", next: "2"}],
    [{id: "getLine", repo: "temp_1", file: "sample.txt", lineId: "2"}, {id: "getLine", status: "closed", line: "", previous: "1"}],
    [{id: "merge", repo: "temp_1", file: "sample.txt", lineId: "1"}, {id: "merge", status: "closed"}],
    [{id: "getLine", repo: "temp_1", file: "sample.txt", lineId: "0"}, {id: "getLine", status: "closed", line: "HelloWorld", next: "2"}],
    [{id: "getLine", repo: "temp_1", file: "sample.txt", lineId: "1"}, {id: "getLine", status: "failed", reason: "Line does not exist."}],
    [{id: "getLine", repo: "temp_1", file: "sample.txt", lineId: "2"}, {id: "getLine", status: "closed", line: "", previous: "0"}],
    [{id: "getFile", repo: "temp_1", file: "sample.txt"}, result => {
        result = result.json;
        return result.id === "getFile" && result.status === "closed" &&
            typeof result.lines === "object" &&
            typeof result.lines["0"] === "object" && typeof result.lines["2"] === "object" &&
            result.lines["0"].line === "HelloWorld" && result.lines["2"].line === "";
    }],
    [{id: "getFile", repo: "temp_1", file: "magic.txt"}, {id: "getFile", status: "failed", reason: "File does not exist."}],
    [{id: "getFiles", repo: "temp_1"}, {id: "getFiles", status: "closed"}],



], {newTest: newTest, timeout: 5000});

let ws = new WebSocket("wss://notextures.io:8086");

ws.addEventListener("open", (/*event*/) => tester.start());
ws.addEventListener("message", event => tester.event(event));
