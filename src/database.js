
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
            this.permission = db.collection("permission");
            this.repo = db.collection("repo");
            this.directory = db.collection("directory");
            this.file = db.collection("file");
            this.line = db.collection("line");

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
        return this.permission.updateOne(
            {user: user, repo: repo},
            {$set: {permission: permission}},
            {upsert: true}
        );
    }

    permGet(user, repo) {
        return this.permission.findOne({user: user, repo: repo});
    }

    permDelete(user, repo) {
        return this.permission.deleteOne({user: user, repo: repo});
    }

    /******************************************************
     ** Directory
     ******************************************************/

    dirCreate(repo, path) {
        return this.directory.insertOne({
            repo: repo,
            path: path,
            contents: []
        });
    }

    dirMove(repo, path, newPath) {
        return this.directory.updateOne({
            repo: repo,
            path: path
        }, {$set: {
            path: newPath
        }});
    }

    dirGet(repo, path) {
        return this.directory.findOne({repo: repo, path: path});
    }

    dirDelete(repo, path) {
        return this.directory.removeOne({
            repo: repo,
            path: path
        });
    }

    dirExists(repo, path) {
        return this.directory.find({repo: repo, path: path}, {"_id": 1}).limit(1).count();
    }

    /******************************************************
     ** File
     ******************************************************/

    fileCreate(repo, path) {
        return this.file.insertOne({
            repo: repo,
            path: path
        });
    }

    fileMove(repo, path, newPath) {
        return this.file.updateOne({
            repo: repo,
            path: path
        }, {$set: {
            path: newPath
        }});
    }

    fileDelete(repo, path) {
        return this.file.removeOne({
            repo: repo,
            path: path
        });
    }

    fileGet(repo, path) {
        return new Promise((resolve, reject) => {

            Promise.all([
                this.file.findOne({repo: repo, path: path}),
                this.line.find({repo: repo, path: path}).toArray()
            ]).then(result => {
                if (result[0] === null) reject("File does not exist.");

                result[0].lines = result[1];
                resolve(result[0]);

            });

        });
    }

    fileExists(repo, path) {
        return this.file.find({repo: repo, path: path}, {"_id": 1}).limit(1).count();
    }

    /******************************************************
     ** Line
     ******************************************************/

    lineGet(repo, path, lineId) {
        return this.line.findOne({repo: repo, path: path, lineId: lineId});
    }

    lineSet(repo, path, lineId, line, previous, next) {

        let update = {$set: {line: line}};

        if (previous) update.$set.previous = previous;
        if (next) {
            if (next === -1) update.$unset.next = "whatever";
            else update.$set.next = next;
        }

        return this.line.updateOne(
            {repo: repo, path: path, lineId: lineId},
            update,
            {upsert: true}
        );
    }

    lineRemove(repo, path, lineId) {
        return this.line.removeOne({repo: repo, path: path, lineId: lineId});
    }

    lineAfter(repo, path, lineId) {
        return this.line.findOne({repo: repo, path: path, previous: lineId});
    }

    /******************************************************
     ** Misc
     ******************************************************/

    clean() {
        this.user.remove({name: /^temp_/i});
        this.repo.remove({name: /^temp_/i});
        this.permission.remove({$or: [{user: /^temp_/i}, {repo: /^temp_/i}]});
        this.file.remove({repo: /^temp_/i});
        this.directory.remove({repo: /^temp_/i});
        this.line.remove({repo: /^temp_/i});
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

    dirCreate(repo, path) {
        return this.db.dirCreate(repo, path);
    }

    dirMove(repo, path, newPath) {
        return this.db.dirMove(repo, path, newPath);
    }

    //Returns vital stats and all directories and files contained
    dirGet(repo, path) {
        return this.db.dirGet(repo, path);
    }

    dirDelete(repo, path) {
        return this.db.dirDelete(repo, path);
    }

    dirExists(repo, path) {
        return this.db.dirExists(repo, path);
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

    lineSet(repo, path, lineId, line, previous, next) {
        return this.db.lineSet(repo, path, lineId, line, previous, next);
    }

    lineGet(repo, path, lineId) {
        return this.db.lineGet(repo, path, lineId);
    }

    lineRemove(repo, path, lineId) {
        return this.db.lineRemove(repo, path, lineId);
    }

    lineAfter(repo, path, lineId) {
        return this.db.lineAfter(repo, path, lineId);
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
