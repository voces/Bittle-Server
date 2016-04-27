
"use strict";

const tape = require("tape"),
    EventEmitter = require("events"),

    Client = require("../src/Client.js");

tape("Config", {timeout: 5000}, test => {

    require("../src/config.js")("test/testConfig.json", config => {
        test.plan(1);

        test.isEquivalent(config, {
            "database": {
                "type": "mongodb",
                "path": null,
                "args": "--config config/mongodb.conf",
                "database": "bittle"
            },
            "server": [
                {
                    "type": "wss",
                    "port": 8086,
                    "key": "test/ssl/passless.key",
                    "cert": "test/ssl/public.crt",
                    "ca": "test/ssl/server.pem"
                },
                {
                    "type": "rss",
                    "port": 8087,
                    "key": "test/ssl/passless.key",
                    "cert": "test/ssl/public.crt",
                    "ca": "test/ssl/server.pem"
                }
            ]
        }, "Config equivalent");

    });

});

tape("Server", {timeout: 5000}, test => {
    test.plan(10);

    let server = require("../src/server.js");

    test.equal(server.constructor.name, "Server", "Server initialized");

    server.start([{
        type: "wss",
        port: 8088,
        key: "test/ssl/passless.key",
        cert: "test/ssl/public.crt",
        ca: "test/ssl/server.pem"
    }], {});

    test.equal(server.servers.length, 1, "Exactly 1 server initiated");
    test.equal(server.servers[0].constructor.name, "WebSocketServer", "Server is WSS (wraps WS)");

    server.servers[0].on("start", () => {

        test.equal(server.servers[0].https.constructor.name, "Server", "WSS has a https server");
        test.equal(server.servers[0].server.constructor.name, "WebSocketServer", "WSS has a ws server");

        test.equal(server.clients.length, 0, "No clients");

        let socket = new EventEmitter();

        let client = server.newClient(socket);

        test.equal(server.clients[0], client, "New client added");
        test.equal(server.clients[0].socket, socket, "Client has passed socket");

        client.name = "test";
        server.clients.test = client;

        server.removeClient(client);

        test.equal(server.clients.length, 0, "Client removed from array list");
        test.equal(server.clients.test, undefined, "Client removed from object list");

        server.servers[0].https.close();
        server.servers[0].server.close();

    });

});

function dummyUserGet(name) {

    if (name === "fail") return [];

    if (name === "hasEmail") return [{
        pass: "$2a$10$FptOEONa/OhJeS8gMl7h9u3jNz5h3yB6NsNcKlnvhi6oU3SHI7ioW",   //"phasephrase"
        email: "test@test.test",
        name: name}];

    return [{
        pass: "$2a$10$FptOEONa/OhJeS8gMl7h9u3jNz5h3yB6NsNcKlnvhi6oU3SHI7ioW",   //"phasephrase"
        name: name}];

}

let dummyDB = {
        userGet: name => new Promise(resolve => resolve(dummyUserGet(name))),
        userCreate: () => new Promise(resolve => resolve()),
        userSetEmail: () => new Promise(resolve => resolve()),
        userSetPass: () => new Promise(resolve => resolve())},

    dummyShare = {
        files: []},

    dummyServer = {
        db: dummyDB,
        clients: []};

class DummyRequest {

    constructor(json) { this.json = json; }
    finish(result) { this.result = result; return true; }
    fail(result) { this.result = result; return false; }

}

tape("Client", test => {
    test.plan(46);

    let socket = new EventEmitter();
    socket.family = "IPv4";
    socket.ip = "localhost";
    socket.port = "12345";

    let client = new Client(dummyServer, socket);

    test.equal(client.constructor.name, "Client", "Client initialized");

    // tag >> 3 tests, 4 total

    test.equal(client.tag, "localhost:12345", "Tag on IPv4");

    socket.family = "IPv6";
    test.equal(client.tag, "[localhost]:12345", "Tag on IPv6");

    client.name = "test";
    client.authenticated = true;
    test.equal(client.tag, "test", "Tag with name/authentication");

    //comparePass(name, pass, hash) >> 3 tests, 7 total

    client.comparePass("test", "passphrase", "pass").then(
        result => test.equal(result, false, "Invalid pass (hash is not hashed)"),
        () => test.fail("Some error in comparePass"));

    client.comparePass("test", "pass", "$2a$10$FptOEONa/OhJeS8gMl7h9u3jNz5h3yB6NsNcKlnvhi6oU3SHI7ioW").then(
        result => test.equal(result, false, "Incorrect pass"),
        () => test.fail("Some error in comparePass"));

    client.comparePass("test", "passphrase", "$2a$10$FptOEONa/OhJeS8gMl7h9u3jNz5h3yB6NsNcKlnvhi6oU3SHI7ioW").then(
        result => test.equal(result, true, "Working pass"),
        () => test.fail("Some error in comparePass"));

    //saltPass(name, pass) >> 3 tests, 10 total

    client.saltPass("test", "passphrase").then(
        result => client.comparePass("test", "passphrase", result).then(
            result => test.equal(result, true, "Salt pass"),
            () => test.fail("Some error in saltPass/comparePass")),
        () => test.fail("Some error in saltPass"));

    client.saltPass("tested", "passphrase").then(
        result => client.comparePass("testee", "passphrase", result).then(
            result => test.equal(result, true, "Salt pass, name > 5 characters"),
            () => test.fail("Some error in saltPass/comparePass")),
        () => test.fail("Some error in saltPass"));

    client.saltPass("tested", "passphrase").then(
        result => client.comparePass("testee", "fail", result).then(
            result => test.equal(result, false, "Incorrect pass"),
            () => test.fail("Some error in saltPass/comparePass")),
        () => test.fail("Some error in saltPass"));

    //auth(name, pass) >> 3 tests, 13 total

    client.auth("fail").then(
        () => test.fail("Client auth should fail; user does not exist."),
        error => test.equal(error, "Account does not exist.", "Nonexistance (user)"));
    client.auth("test", "fail").then(
        () => test.fail("Client auth should fail; pass is incorrect."),
        error => test.equal(error, "Incorrect pass.", "Incorrect pass"));
    client.auth("test", "passphrase").then(() => test.pass("Correct pass"), () => test.fail("Client auth should work."));

    //register(request, name, pass) >> 2 tests, 15 total

    let registerRequest = {json: {email: ""}};
    client.register(registerRequest, "test", "test").then(
        () => test.fail("Client register should fail; user already exists."),
        error => test.equal(error, "Name is already taken.", "Client.register: taken"));
    client.register(registerRequest, "fail", "test").then(
        () => test.pass("Client.register: pass"),
        () => test.fail("Client.register: should pass"));

    //login(request, name, pass) >> 5 tests, 20 total

    client.login({}, "fail", "test").then(
        () => test.fail("Client login should fail; user does not exist."),
        error => test.equal(error, "Account does not exist.", "Client.login: missing"));
    client.login({}, "test", "test").then(
        () => test.fail("Client login should fail; pass is incorrect."),
        error => test.equal(error, "Incorrect pass.", "Client.login: bad pass"));
    client.login({}, "test", "passphrase").then(() => {
        test.pass("Client.login: pass");
        test.equal(client.name, "test", "Client.login: name set");
        test.equal(dummyServer.clients.test, client, "Client.login: client set in server object list");

        //logout() >> 3 tests, 23 total
        // This test must be done after login

        client.logout().then(() => {
            test.equal(client.name, undefined, "Client.logout: name cleared");
            test.equal(dummyServer.clients.test, undefined, "Client.logout: client cleared from server object list");
            test.equal(dummyServer.clients.length, 0, "Client.logout: client cleared from server array list");
        });

    }, () => {
        test.fail("Client login should pass.");
        test.fail("Client.login: name set skip");
        test.fail("Client.login: client in server object list skip");
        test.fail("Client.register: skip name cleared");
        test.fail("Client.register: skip client cleared from server object list");
        test.fail("Client.register: skip client cleared from server array list");
    });

    //changePassAuth(request, name, pass, newPass) >> 3 tests, 26 total

    client.changePassAuth({}, "fail", "test", "test").then(
        () => test.fail("Client changePassAuth should fail; user does not exist."),
        error => test.equal(error, "Account does not exist.", "Client.changePassAuth: missing"));
    client.changePassAuth({}, "test", "test", "test").then(
        () => test.fail("Client changePassAuth should fail; pass is incorrect."),
        error => test.equal(error, "Incorrect pass.", "Client.changePassAuth: bad pass"));
    client.changePassAuth({}, "test", "passphrase", "passphrase").then(
        () => test.pass("Client.changePassAuth: pass"),
        () => test.fail("Client.changePassAuth: should pass"));

    //changeEmailAuth(request, name, pass, newEmail) >> 3 tests, 29 total

    client.changeEmailAuth({}, "fail", "test", "test@test.test").then(
        () => test.fail("Client changeEmailAuth should fail; user does not exist."),
        error => test.equal(error, "Account does not exist.", "Client.changeEmailAuth: missing"));
    client.changeEmailAuth({}, "test", "test", "test@test.test").then(
        () => test.fail("Client changeEmailAuth should fail; pass is incorrect."),
        error => test.equal(error, "Incorrect pass.", "Client.changeEmailAuth: bad pass"));
    client.changeEmailAuth({}, "test", "passphrase", "test@test.test").then(
        () => test.pass("Client.changeEmailAuth: pass"),
        () => test.fail("Client.changeEmailAuth: should pass"));

    //resetPass(request, name) >> 3 tests, 32 total

    client.resetPass({}, "fail").then(
        () => test.fail("Client.resetPass should fail; user does not exist."),
        error => test.equal(error, "Account does not exist.", "Client.resetPass: missing"));
    client.resetPass({}, "test").then(
        () => test.fail("Client.resetPass should fail; user does not have an email address."),
        error => test.equal(error, "Account has no email address.", "Client.resetPass: missing email"));
    test.pass("client.resetPass: IGNORE"); //TODO: don't ignore
    // client.resetPass({}, "hasEmail").then(
    //     () => test.pass("Client.resetPass: pass"),
    //     () => test.fail("Client.resetPass: should pass"));

    //changePass(request, pass, newPass) >> 2 tests, 34 total

    client.changePass({}, "test", "test").then(
        () => test.fail("Client.changePass should fail; pass is incorrect."),
        error => test.equal(error, "Incorrect pass.", "Client.changePass: bad pass"));
    client.changePass({}, "passphrase", "passphrase").then(
        () => test.pass("Client.changePass: pass"),
        () => test.fail("Client.changePass: should pass"));

    //changeEmail(request, pass, newEmail) >> 2 tests, 36 total

    client.changeEmail({}, "test", "test@test.test").then(
        () => test.fail("Client.changeEmail should fail; pass is incorrect."),
        error => test.equal(error, "Incorrect pass.", "Client.changeEmail: bad pass"));
    client.changeEmail({}, "passphrase", "test@test.test").then(
        () => test.pass("Client.changeEmail: pass"),
        () => test.fail("Client.changeEmail: should pass"));

    // Items that fail when not sharing >> 5 tests, 41 total

    let request, result;

    result = client.untrack(request = new DummyRequest());
    if (result === true) test.fail("Client.untrack: should fail; not in share");
    else if (result === false && request.result === "Not sharing anything with anyone.") test.pass("Client.untrack: not in share");
    else if (result === false) test.fail("Client.untrack: should fail, but with error of not sharing");
    else test.fail("Client.untrack: no return type");

    result = client.getFile(request = new DummyRequest());
    if (result === true) test.fail("Client.getFile: should fail; not in share");
    else if (result === false && request.result === "Not sharing anything with anyone.") test.pass("Client.getFile: not in share");
    else if (result === false) test.fail("Client.getFile: should fail, but with error of not sharing");
    else test.fail("Client.getFile: no return type");

    result = client.lines(request = new DummyRequest());
    if (result === true) test.fail("Client.lines: should fail; not in share");
    else if (result === false && request.result === "Not sharing anything with anyone.") test.pass("Client.lines: not in share");
    else if (result === false) test.fail("Client.lines: should fail, but with error of not sharing");
    else test.fail("Client.lines: no return type");

    result = client.line(request = new DummyRequest());
    if (result === true) test.fail("Client.line: should fail; not in share");
    else if (result === false && request.result === "Not sharing anything with anyone.") test.pass("Client.line: not in share");
    else if (result === false) test.fail("Client.line: should fail, but with error of not sharing");
    else test.fail("Client.line: no return type");

    result = client.focus(request = new DummyRequest());
    if (result === true) test.fail("Client.focus: should fail; not in share");
    else if (result === false && request.result === "Not sharing anything with anyone.") test.pass("Client.focus: not in share");
    else if (result === false) test.fail("Client.focus: should fail, but with error of not sharing");
    else test.fail("Client.focus: no return type");

    // Items that fial when file isn't shared >> 5 tests, 46 total

    client.share = dummyShare;

    result = client.untrack(request = new DummyRequest({filepath: "test"}));
    if (result === true) test.fail("Client.untrack: should fail; file not shared");
    else if (result === false && request.result === "Not sharing file.") test.pass("Client.untrack: file missing");
    else if (result === false) test.fail("Client.untrack: should fail, but with error of file missing");
    else test.fail("Client.untrack: no return type");

    result = client.getFile(request = new DummyRequest({filepath: "test"}));
    if (result === true) test.fail("Client.getFile: should fail; file not shared");
    else if (result === false && request.result === "Not sharing file.") test.pass("Client.getFile: file missing");
    else if (result === false) test.fail("Client.getFile: should fail, but with error of file missing");
    else test.fail("Client.getFile: no return type");

    result = client.lines(request = new DummyRequest({filepath: "test"}));
    if (result === true) test.fail("Client.lines: should fail; file not shared");
    else if (result === false && request.result === "Not sharing file.") test.pass("Client.lines: file missing");
    else if (result === false) test.fail("Client.lines: should fail, but with error of file missing");
    else test.fail("Client.lines: no return type");

    result = client.line(request = new DummyRequest({filepath: "test"}));
    if (result === true) test.fail("Client.line: should fail; file not shared");
    else if (result === false && request.result === "Not sharing file.") test.pass("Client.line: file missing");
    else if (result === false) test.fail("Client.line: should fail, but with error of file missing");
    else test.fail("Client.line: no return type");

    result = client.focus(request = new DummyRequest({filepath: "test"}));
    if (result === true) test.fail("Client.focus: should fail; file not shared");
    else if (result === false && request.result === "Not sharing file.") test.pass("Client.focus: file missing");
    else if (result === false) test.fail("Client.focus: should fail, but with error of file missing");
    else test.fail("Client.focus: no return type");

});
