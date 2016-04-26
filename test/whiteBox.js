
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

let dummyDB = {
    userGet: name => new Promise(resolve => name === "fail" ? resolve([]) : resolve([{
        pass: "$2a$10$FptOEONa/OhJeS8gMl7h9u3jNz5h3yB6NsNcKlnvhi6oU3SHI7ioW",   //"phasephrase"
        name: name
    }]))
};

tape("Client", test => {
    test.plan(13);

    let socket = new EventEmitter();
    socket.family = "IPv4";
    socket.ip = "localhost";
    socket.port = "12345";

    let client = new Client({db: dummyDB}, socket);

    test.equal(client.constructor.name, "Client", "Client initialized");

    //tag

    test.equal(client.tag, "localhost:12345", "Tag on IPv4");

    socket.family = "IPv6";
    test.equal(client.tag, "[localhost]:12345", "Tag on IPv6");

    client.name = "test";
    client.authenticated = true;
    test.equal(client.tag, "test", "Tag with name/authentication");

    //comparePass(name, pass, hash)

    client.comparePass("test", "passphrase", "pass").then(
        result => test.equal(result, false, "Invalid pass (hash is not hashed)"),
        () => test.fail("Some error in comparePass"));

    client.comparePass("test", "pass", "$2a$10$FptOEONa/OhJeS8gMl7h9u3jNz5h3yB6NsNcKlnvhi6oU3SHI7ioW").then(
        result => test.equal(result, false, "Incorrect pass"),
        () => test.fail("Some error in comparePass"));

    client.comparePass("test", "passphrase", "$2a$10$FptOEONa/OhJeS8gMl7h9u3jNz5h3yB6NsNcKlnvhi6oU3SHI7ioW").then(
        result => test.equal(result, true, "Working pass"),
        () => test.fail("Some error in comparePass"));

    //saltPass(name, pass)

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

    //auth(name, pass)

    client.auth("fail").then(
        () => test.fail("Client auth should fail; user does not exist."),
        error => test.equal(error, "Account does not exist.", "Nonexistance (user)"));
    client.auth("test", "fail").then(
        () => test.fail("Client auth should fail; pass is incorrect."),
        error => test.equal(error, "Incorrect pass.", "Incorrect pass"));
    client.auth("test", "passphrase").then(() => test.pass("Correct pass"), () => test.fail("Client auth should work."));



});
