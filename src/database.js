
"use strict";

const EventEmitter = require("events"),
    colors = require("colors"),
    spawn = require("child_process").spawn,
    MongoClient = require('mongodb').MongoClient;

class MongoDB extends EventEmitter {

    constructor(config) {

        super();

        this.config = config;

        /********
         *  Spawn a mongodb process, store it at this.process
         */

        // console.log(`Running 'mongod${(config.args ? " " + config.args : "")}'`);

        //Run mongodb and pass any arguments
        this.process = spawn("mongod", config.args.split(" "));

        //Capture the output: both general and errors
        this.process.stdout.on("data", this.processOut.bind(this));
        this.process.stderr.on("data", this.processErr.bind(this));

    }

    processOut(data) {

        //Data comes in as a buffer, convert to string
        data = data.toString();

        //Capture the line that indicates what port MongoDB is on
        if (data.indexOf("waiting for connections on port") >= 0) {

            //Grab that port
            this.port = data.slice(data.indexOf("port") + 5).split(/\D/)[0];

            // console.log(`Found mongod on port '${this.port}'`);

            //Theoretically disable this listener, but this is not how you do it
            //  TODO: fix me
            this.process.stdout.removeListener("data", this.processOut);

            //We can now connect to our mongo database
            this.connectToMongo();

        }

    }

    processErr(data) {
        this.emit("processError", data);
        this.error(data);
    }

    connectToMongo() {

        if (typeof this.db !== "undefined") return;
        this.db = true;

        /********
         *  Connect to mongodb
         */

        //Build up the address of the database
        this.url = `mongodb://localhost:${this.port}/${this.config.database}`;

        // console.log(`Connecting to mongod at '${this.url}'`);

        //Connect to it
        MongoClient.connect(this.url, (err, db) => {

            //If any errors occur, kill the server and database processes
            if (err) {

                this.emit("connectError", {config: this.config, url: this.url});
                // return;
                this.error(`Error connecting to mongodb at '${this.url}', exiting`);
                process.exit(1);

            }

            this.log(`Connected to mongod at '${this.url}'`);

            this.db = db;
            this.user = db.collection("user");
            // this.role = db.collection("role");
            // this.repo = db.collection("repo");
            // this.directory = db.collection("directory");
            // this.file = db.collection("file");
            // this.line = db.collection("line");
            // this.listeners = db.collection("listeners");

            this.emit("ready", {config: this.config, url: this.url});

            this.clean();

        });

    }

    /******************************************************
     ** User
     ******************************************************/

    userCreate(name, pass, email) {
        return this.user.insertOne({
            name: name,
            pass: pass,
            email: email,
            created: Date.now(),
            updated: Date.now(),
            listeners: []
        });
    }

    userGet(name) {
        return this.user.find({name: name}).toArray();
    }

    userSetPass(name, pass) {
        return this.user.updateOne({name: name}, {$set:{pass: pass, updated: Date.now()}});
    }

    userSetEmail(name, email) {
        return this.user.updateOne({name: name}, {$set:{email: email, updated: Date.now()}});
    }

    /******************************************************
     ** Misc
     ******************************************************/

    clean() {
        this.user.remove({name: /^temp_/i});
        // this.repo.remove({name: /^temp_/i});
        // this.role.remove({$or: [{user: /^temp_/i}, {repo: /^temp_/i}]});
        // this.file.remove({repo: /^temp_/i});
        // this.directory.remove({repo: /^temp_/i});
        // this.line.remove({repo: /^temp_/i});
    }

    log() {

        /*eslint-disable no-console*/
        console.log(...[colors.magenta("[MongoDB]"), ...arguments]);
        /*eslint-enable no-console*/

    }

    error() {

        /*eslint-disable no-console*/
        console.error(...[colors.magenta("[MongoDB]"), ...arguments]);
        /*eslint-enable no-console*/

    }

}

class Database extends EventEmitter {

    constructor() {

        super();

        this.db = false;

    }

    initializeHooks() {

        this.db.on("processError", e => this.emit("processError", e));
        this.db.on("connectError", e => this.emit("connectError", e));
        this.db.on("ready", e => this.emit("ready", e));

    }

    start(config) {

        //Only allow one database
        if (this.db) return;

        //Could theoretically route different databases, but we're just programming for MongoDB
        switch (config.type) {

            case "mongodb":
                this.db = new MongoDB(config);
                break;

        }

        this.initializeHooks();

    }

    /******************************************************
     ** User
     ******************************************************/

    userCreate(name, pass, email) {
        return this.db.userCreate(name, pass, email);
    }

    //Returns all vital stats and all repositories they have access to and their role level
    userGet(name) {
        return this.db.userGet(name);
    }

    userSetPass(name, pass) {
        return this.db.userSetPass(name, pass);
    }

    userSetEmail(name, email) {
        return this.db.userSetEmail(name, email);
    }

    /******************************************************
     ** Misc
     ******************************************************/

    clean() {
        return this.db.clean();
    }

}

//Force a singleton database
module.exports = new Database();
