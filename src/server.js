
"use strict";

const EventEmitter = require("events"),

    Client = require("./Client");

function readFileThunk(path, callback) {

    const fs = require("fs");

    fs.readFile(path, (err, data) => callback(err, data));

}

class WSS extends EventEmitter {

    constructor(config) {

        super();

        this.config = config;

        const https = require("https"),
            ws = require("ws"),
            async = require("async");

        console.log(`Loading https keys`);

        async.parallel({
            key: callback => readFileThunk(config.key, callback),
            cert: callback => readFileThunk(config.cert, callback),
        }, (err, results) => {

            if (err) {

                console.error(err);
                process.exit(1);

            }

            console.log("Loaded https keys");

            console.log(`Starting https/wss server on port '${config.port}'`)

            this.https = https.createServer({
                key: results.key,
                cert: results.cert
            }).listen(config.port);

            this.server = new ws.Server({server: this.https});

            //Very attach some utility, then re-emit the event
            this.server.on("connection", socket => {

                // console.log(socket);

                socket.ip = socket.upgradeReq.connection.remoteAddress;
                socket.family = socket._socket._peername.family;
                socket.port = socket._socket._peername.port;

                // for (let prop in socket)
                //     console.log("socket", prop, typeof socket[prop], ((typeof socket[prop] !== "object" && typeof socket[prop] !== "function") ? socket[prop] : ""));

                this.emit("connection", socket);

            });

        });

    }

}

class Server {

    constructor() {

        this.servers = [];
        this.clients = [];

    }

    addServer(server) {

        this.servers.push(server);

        server.on("connection", this.onOpen.bind(this));

    }

    onOpen(socket) {

        this.clients.push(new Client(socket));

    }

    start(config) {

        if (this.started) return;
        this.started = true;

        for (let i = 0; i < config.length; i++)

            switch (config[i].type) {

                case "wss":
                    this.addServer(new WSS(config[i]));
                    break;

            }

    }

}

module.exports = new Server();
