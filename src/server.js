
"use strict";

const EventEmitter = require("events"),
    fs = require("fs"),
    https = require("https"),
    tls = require("tls"),
    ws = require("ws"),
    async = require("async"),
    colors = require("colors"),

    Client = require("./Client");

let resetPage;

fs.readFile("index.html", (err, content) => {

    if (err) {

        console.error(err);
        process.exit(1);

    }

    resetPage = content;

});

function convertCAFile(fileContents) {

    fileContents = fileContents.toString().split("-----BEGIN CERTIFICATE-----");
    for (let i = 0; i < fileContents.length; i++)
        fileContents[i] = "-----BEGIN CERTIFICATE-----" + fileContents[i];

    fileContents.shift();

}

class RawSecureServer extends EventEmitter {

    constructor(config) {

        super();

        this.config = config;

        //Load the keys in parallel
        async.parallel({
            key: callback => fs.readFile(config.key, callback),
            cert: callback => fs.readFile(config.cert, callback),
            ca: callback => fs.readFile(config.ca, callback)
        }, (err, results) => {

            //If the keys fail to load, kill the process
            if (err) {

                this.error(err);
                process.exit(1);

            }

            results.ca = convertCAFile(results.ca);

            // console.log("Loaded https keys");

            // console.log(`Starting https/wss server on port '${config.port}'`)

            //Spawn an HTTPS server
            this.server = tls.createServer({
                key: results.key,
                cert: results.cert,
                ca: results.ca
            }).listen(config.port);

            //Add some properties to the socket for easy access, then re-emit
            //  the event
            this.server.on("secureConnection", socket => {

                this.log("RSS connection");

                socket.ip = socket.remoteAddress;
                socket.family = socket.remoteFamily;
                socket.port = socket.remotePort;

                socket.on("data", e => socket.emit("message", e));
                socket.send = socket.write;

                socket.on("error", e => {
                    this.error(e);
                });

                this.emit("connection", socket);

            });

            this.log(`Started rss server on port '${config.port}'`);

            this.emit("start", config);

        });

    }

    //Decorate log events with a stamp of the client
    log() {

        /*eslint-disable no-console*/
        console.log(...[colors.green("[RSS]"), ...arguments]);
        /*eslint-enable no-console*/

    }

    //Decorate error events with a stamp of the client
    error() {

        /*eslint-disable no-console*/
        console.error(...[colors.green("[RSS]"), ...arguments]);
        /*eslint-enable no-console*/

    }

}

class WebSocketServer extends EventEmitter {

    constructor(config) {

        super();

        this.config = config;

        // console.log(`Loading https keys`);

        //Load the keys in parallel
        async.parallel({
            key: callback => fs.readFile(config.key, callback),
            cert: callback => fs.readFile(config.cert, callback),
            ca: callback => fs.readFile(config.ca, callback)
        }, (err, results) => {

            //If the keys fail to load, kill the process
            if (err) {

                this.error(err);
                process.exit(1);

            }

            results.ca = convertCAFile(results.ca);

            // console.log("Loaded https keys");

            // console.log(`Starting https/wss server on port '${config.port}'`)

            //Spawn an HTTPS server
            this.https = https.createServer({
                key: results.key,
                cert: results.cert,
                ca: results.ca

            //This part only exists to make accepting the certficate easier
            }, (req, res) => {
                res.writeHead("200");
                res.end(resetPage);

            //Start listening on a port
            }).listen(config.port);

            this.https.on("error", e => {
                switch (e.code) {
                    case "EADDRINUSE":
                        this.error(`Unable to start https server on port '${config.port}' since it is already in use.`);
                        break;
                    default:
                        this.error(`Untracked error: ${e.code}`);
                        break;
                }
                process.exit(1);
            });

            //Spawn a WS server (essentially a decorator on HTTPS)
            this.server = new ws.Server({server: this.https});

            //Add some properties to the socket for easy access, then re-emit
            //  the event
            this.server.on("connection", socket => {

                socket.ip = socket.upgradeReq.connection.remoteAddress;
                socket.family = socket._socket._peername.family;
                socket.port = socket._socket._peername.port;

                this.emit("connection", socket);

            });

            this.log(`Started wss server on port '${config.port}'`);

            this.emit("start", config);

        });

    }

    //Decorate log events with a stamp of the client
    log() {

        /*eslint-disable no-console*/
        console.log(...[colors.green("[WSS]"), ...arguments]);
        /*eslint-enable no-console*/

    }

    //Decorate error events with a stamp of the client
    error() {

        /*eslint-disable no-console*/
        console.error(...[colors.green("[WSS]"), ...arguments]);
        /*eslint-enable no-console*/

    }

}

class Server extends EventEmitter {

    constructor() {

        super();

        //The general Server class can take in clients form sub-servers (like
        //  WebSockets)

        this.servers = [];
        this.clients = [];

        this.db = null;

    }

    addServer(server) {

        this.servers.push(server);

        //Only event we care about from a sub-server
        server.on("connection", this.newClient.bind(this));

        server.on("start", e => this.emit("wsstart", e));

    }

    newClient(socket) {

        let client = new Client(this, socket);
        this.clients.push(client);

        client.on("close", this.removeClient.bind(this));
        socket.on("error", e => client.error(e));

        return client;

    }

    removeClient(client) {

        this.clients.splice(this.clients.indexOf(client), 1);
        delete this.clients[client.name];

    }

    clean() {

        this.db.clean();

        // for (let name in this.repos)
        //     if (name.match(/temp_/i)) delete this.repos[name];

    }

    //A server can have a delayed start, but all sub-servers must be loaded at
    //  the same time
    start(config, db) {

        this.db = db;

        if (this.started) return;
        this.started = true;

        //Many sub-servers can be loaded
        for (let i = 0; i < config.length; i++)

            switch (config[i].type) {

                case "wss":
                    this.addServer(new WebSocketServer(config[i]));
                    break;

                case "rss":
                    this.addServer(new RawSecureServer(config[i]));
                    break;

            }

    }

    //Decorate log events with a stamp of the client
    log() {

        /*eslint-disable no-console*/
        console.log(...[colors.green("[Server]"), ...arguments]);
        /*eslint-enable no-console*/

    }

    //Decorate error events with a stamp of the client
    error() {

        /*eslint-disable no-console*/
        console.error(...[colors.green("[Server]"), ...arguments]);
        /*eslint-enable no-console*/

    }

}

//Essentially a singleton
module.exports = new Server();
