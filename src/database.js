
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
            this.user = db.collection("user");
            this.permission = db.collection("permission");
            this.repo = db.collection("repo");
            this.directory = db.collection("directory");
            this.file = db.collection("file");

            this.emit("ready", {config: this.config, url: this.url});

            this.clean();

        })

    }

    /******************************************************
     ** User
     ******************************************************/

    userCreate(name, pass, email) {
        return this.user.insertOne({
            name: name,
            pass: pass,
            email: email
        });
    }

    userGet(name) {
        return this.user.find({name: name}).toArray();
    }

    userSetPass(name, pass) {
        return this.user.updateOne({name: name}, {$set:{pass: pass}});
    }

    userSetEmail(name, email) {
        return this.user.updateOne({name: name}, {$set:{email: email}});
    }

    /******************************************************
     ** Repository
     ******************************************************/

    repoCreate(name, parent) {
        return this.repo.insertOne({
            name: name,
            parent: parent
        });
    }

    repoGet(name) {
        return this.repo.findOne({name: name});
    }

    // repoDelete(name) {}

    /******************************************************
     ** Permission
     ******************************************************/

    permSet(user, repo, permission) {
        // console.log("Granting", permission, "to", user, "for", repo);
        return this.permission.insertOne({
            user: user,
            repo: repo,
            permission: permission
        });
    }

    permGet(user, repo) {
        return this.permission.findOne({user: user, repo: repo});
    }

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

    fileCreate(repo, path) {
        return this.file.insertOne({
            repo: repo,
            path: path
        });
    }

    fileMove(repo, path, newPath) {}
    fileDelete(repo, path) {}
    fileGet(repo, path) {}

    fileExists(repo, path) {
        return this.file.find({repo: repo, path: path}, {"_id": 1}).limit(1).count();
    }

    /******************************************************
     ** Line
     ******************************************************/

    lineSet(repo, file, lineId, value) {}
    lineGet(repo, file, lineId) {}
    lineRemove(repo, file, lineId) {}

    /******************************************************
     ** Misc
     ******************************************************/

    clean() {
        this.user.remove({name: /^temp_/i});
        this.repo.remove({name: /^temp_/i});
        this.permission.remove({$or: [{user: /^temp_/i}, {repo: /^temp_/i}]});
        this.file.remove({repo: /^temp_/i});
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

    //Returns all vital stats and all repositories they have access to and their permission level
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
     ** Repository
     ******************************************************/

    repoCreate(name, parent) {
    	return this.db.repoCreate(name, parent);
    }

    //Returns vital stats and all directories and files contained; does not return a list of permissions
    repoGet(name) {
    	return this.db.repoGet(name);
    }

    //Returns users' names and their permissions
    repoGetPerms(name) {
    	return this.db.repoGet(name);
    }

    /******************************************************
     ** Permission
     ******************************************************/

    permSet(user, repo, permission) {
    	return this.db.permSet(user, repo, permission);
    }

    permGet(user, repo) {
    	return this.db.permGet(user, repo);
    }

    permDelete(user, repo) {
    	return this.db.permDelete(user, repo);
    }

    /******************************************************
     ** Directory
     ******************************************************/

    dirCreate(repo, parent, name) {
    	return this.db.dirCreate(repo, parent, name);
    }

    //Returns vital stats and all directories and files contained
    dirGet(repo, parent, name) {
    	return this.db.dirGet(repo, parent, name);
    }

    dirDelete(repo, parent, name) {
    	return this.db.dirDelete(repo, parent, name);
    }

    /******************************************************
     ** File
     ******************************************************/

    fileCreate(repo, path) {
    	return this.db.fileCreate(repo, path);
    }

    fileMove(repo, path, newPath) {
    	return this.db.fileMove(repo, path, newPath);
    }

    fileDelete(repo, path) {
    	return this.db.fileDelete(repo, path);
    }

    //Returns vital stats and the file contents
    fileGet(repo, path) {
    	return this.db.fileGet(repo, path);
    }

    fileExists(repo, path) {
        return this.db.fileExists(repo, path);
    }

    /******************************************************
     ** Line
     ******************************************************/

    lineSet(repo, file, lineId, value) {
    	return this.db.lineSet(file, lineId, value);
    }

    lineGet(repo, file, lineId) {
    	return this.db.lineGet(file, lineId);
    }

    lineRemove(repo, file, lineId) {
    	return this.db.lineRemove(file, lineId);
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
