
"use strict";

const EventEmitter = require("events"),
    fs = require("fs"),
    https = require("https"),
    ws = require("ws"),
    async = require("async"),
    colors = require("colors"),

    Client = require("./Client");

class WSS extends EventEmitter {

    constructor(config) {

        super();

        this.config = config;

        // console.log(`Loading https keys`);

        //Load the keys in parallel
        async.parallel({
            key: callback => fs.readFile(config.key, callback),
            cert: callback => fs.readFile(config.cert, callback),
        }, (err, results) => {

            //If the keys fail to load, kill the process
            if (err) {

                this.error(err);
                process.exit(1);

            }

            // console.log("Loaded https keys");

            // console.log(`Starting https/wss server on port '${config.port}'`)

            //Spawn an HTTPS server
            this.https = https.createServer({
                key: results.key,
                cert: results.cert

            //This part only exists to make accepting the certficate easier
            }, (req, res) => {
                res.writeHead("200");
                res.end("hello world");

            //Start listening on a port
            }).listen(config.port);

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

    }

    removeClient(client) {

        this.clients.splice(this.clients.indexOf(client), 1);

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
                    this.addServer(new WSS(config[i]));
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
