
"use strict";

const EventEmitter = require("events"),
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
        console.error("mongoErr", data.toString());
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
                console.error(`Error connecting to mongodb at '${this.url}', exiting`)
                process.exit(1);

            }

            console.log(`Connected to mongod at '${this.url}'`);

            this.db = db;
            this.user = db.collection('mongoclient_test');

            this.emit("ready", {config: this.config, url: this.url});

        })

    }

    /******************************************************
     ** User
     ******************************************************/

    userCreate(name, password, salt, email) {
        let user = this.user.find({name: name});
    }
    userGet(name) {}
    userSetPassword(name, password, salt) {}
    userSetEmail(name, email) {}

    /******************************************************
     ** Repository
     ******************************************************/

    repoCreate(name, parent) {}
    repoGet(name) {}
    // repoDelete(name) {}

    /******************************************************
     ** Permission
     ******************************************************/

    permSet(user, repo, permission) {}
    permGet(user, repo) {}
    permDelete(user, repo) {}

    /******************************************************
     ** Directory
     ******************************************************/

    dirCreate(repo, parent, name) {}
    dirGet(repo, parent, name) {}
    dirDelete(repo, parent, name) {}

    /******************************************************
     ** File
     ******************************************************/

    fileCreate(directory, name) {}
    fileMove(oldDirectory, name, newDirectory) {}
    fileDelete(directory, name) {}
    fileGet(directory, name) {}

    /******************************************************
     ** Line
     ******************************************************/

    lineSet(file, lineId, value) {}
    lineGet(file, lineId) {}
    lineRemove(file, lineId) {}

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

    userCreate(name, password, salt, email) {
    	return db.userCreate(name, password, salt, email);
    }

    //Returns all vital stats and all repositories they have access to and their permission level
    userGet(name) {
    	return db.userGet(name);
    }

    userSetPassword(name, password, salt) {
    	return db.userSetPassword(name, password, salt);
    }

    userSetEmail(name, email) {
    	return db.userSetEmail(name, email);
    }

    /******************************************************
     ** Repository
     ******************************************************/

    repoCreate(name, parent) {
    	return db.repoCreate(name, parent);
    }

    //Returns vital stats and all directories and files contained; does not return a list of permissions
    repoGet(name) {
    	return db.repoGet(name);
    }

    //Returns users' names and their permissions
    repoGetPerms(name) {
    	return db.repoGet(name);
    }

    /******************************************************
     ** Permission
     ******************************************************/

    permSet(user, repo, permission) {
    	return db.permSet(user, repo, permission);
    }

    permGet(user, repo) {
    	return db.permGet(user, repo);
    }

    permDelete(user, repo) {
    	return db.permDelete(user, repo);
    }

    /******************************************************
     ** Directory
     ******************************************************/

    dirCreate(repo, parent, name) {
    	return db.dirCreate(repo, parent, name);
    }

    //Returns vital stats and all directories and files contained
    dirGet(repo, parent, name) {
    	return db.dirGet(repo, parent, name);
    }

    dirDelete(repo, parent, name) {
    	return db.dirDelete(repo, parent, name);
    }

    /******************************************************
     ** File
     ******************************************************/

    fileCreate(directory, name) {
    	return db.fileCreate(directory, name);
    }

    fileMove(oldDirectory, name, newDirectory) {
    	return db.fileMove(oldDirectory, name, newDirectory);
    }

    fileDelete(directory, name) {
    	return db.fileDelete(directory, name);
    }

    //Returns vital stats and the file contents
    fileGet(directory, name) {
    	return db.fileGet(directory, name);
    }

    /******************************************************
     ** Line
     ******************************************************/

    lineSet(file, lineId, value) {
    	return db.lineSet(file, lineId, value);
    }

    lineGet(file, lineId) {
    	return db.lineGet(file, lineId);
    }

    lineRemove(file, lineId) {
    	return db.lineRemove(file, lineId);
    }

}

//Force a singleton database
module.exports = new Database();
