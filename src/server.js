
"use strict";

const EventEmitter = require("events"),
    fs = require("fs"),
    https = require("https"),
    ws = require("ws"),
    async = require("async"),

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

                console.error(err);
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

            console.log(`Started wss server on port '${config.port}'`)

            this.emit("start", config);

        });

    }

}

class Server extends EventEmitter {

    constructor() {

        super();

        //The general Server class can take in clients form sub-servers (like
        //  WebSockets)

        this.servers = [];
        this.clients = [];

    }

    addServer(server) {

        this.servers.push(server);

        //Only event we care about from a sub-server
        server.on("connection", socket => this.clients.push(new Client(socket)));

        server.on("start", e => this.emit("wsstart", e));

    }

    //A server can have a delayed start, but all sub-servers must be loaded at
    //  the same time
    start(config) {

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

}

//Essentially a singleton
module.exports = new Server();
