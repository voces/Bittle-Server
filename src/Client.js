
"use strict";

const EventEmitter = require("events"),
    colors = require("colors"),
    bcrypt = require("bcryptjs"),

    Request = require("./Request");
    // Key = require("./Key");

class Client extends EventEmitter {

    //Bind some events and set defaults
    constructor(server, socket) {

        super();

        this.server = server;
        this.socket = socket;

        socket.on("close", this.onClose.bind(this));
        socket.on("message", this.onMessage.bind(this));
        socket.on("error", this.onError.bind(this));
        // socket.on("ping", this.onPing.bind(this));
        // socket.on("pong", this.onPong.bind(this));

        this.listeners = {};

        this.authenticated = false;

        this.requestQueue = [];

        this.log("New connection");

    }

    //A general getter
    get tag() {

        if (this.authenticated) return this.name;

        if (this.socket.family = "IPv6") return `[${this.socket.ip}]:${this.socket.port}`;
        return `${this.socket.ip}:${this.socket.port}`;

    }

    auth(name, pass) {

        return new Promise((resolve, reject) => {

            this.server.db.userGet(name).then(users => {

                if (users.length === 0) return reject("Account does not exist.");

                this.comparePass(name, pass, users[0].pass).then(matched => {

                    if (matched) resolve(users[0]);
                    else reject("Incorrect pass.");

                }, error => {this.error(error); reject("Unable to query database.");});
            }, error => {this.error(error); reject("Unable to query database.");});

        });

    }

    register(request, name, pass) {

        return new Promise((resolve, reject) => {

            Promise.all([

                this.server.db.userGet(name),
                this.saltPass(name, pass)

            ]).then(result => {

                let users = result[0],
                    hash = result[1];

                if (users.length) {
                    reject("Name is already taken.");
                    return;
                }

                this.server.db.userCreate(name, hash, request.json.email).then(() => {
                    this.log(`Registered '${name}'`);
                    resolve();
                });

            });

        });

    }

    login(request, name, pass) {

        return new Promise((resolve, reject) => {

            this.auth(name, pass).then(user => {

                this.authenticated = true;

                this.name = name;
                this.originaName = user.name;
                this.email = user.email;

                this.server.clients[name] = this;

                this.log(`Logged in as '${this.name}'`);

                resolve();

            }, badCredentials => reject(badCredentials));

        });

    }

    logout(/*request*/) {

        return new Promise((resolve/*, reject*/) => {

            this.log(`Logged out from '${this.name}'`);

            this.authenticated = false;

            delete this.server.clients[this.name];

            this.name = undefined;
            this.originaName = undefined;
            this.email = undefined;

            this.listeners = {};

            this.emit("logout");

            resolve();

        });

    }

    changePassAuth(request, name, pass, newPass) {

        return new Promise((resolve, reject) => {

            Promise.all([

                this.auth(name, pass),
                this.saltPass(name, newPass)

            ]).then(result => {

                let users = result[0],
                    hash = result[1];

                if (users.length === 0) return reject("Account does not exist.");

                this.log(`Changed password of '${name}'`);

                this.server.db.userSetPass(name, hash).then(
                    (/*result*/) => resolve(),
                    error => {this.error(error); reject("Unable to query database.");}
                );

            }, badCredentials => reject(badCredentials));

        });

    }

    changeEmailAuth(request, name, pass, newEmail) {

        return new Promise((resolve, reject) => {

            this.auth(name, pass).then((/*user*/) => {

                this.log(`Changed email of '${name}'`);

                this.server.db.userSetEmail(name, newEmail).then(
                    (/*result*/) => resolve(),
                    error => {this.error(error); reject("Unable to query database.");}
                );

            }, badCredentials => reject(badCredentials));

        });

    }

    //This function requires a mailer of some sort
    // Considering https://github.com/andris9/smtp-server
    resetPass(/*request, name*/) {

        return new Promise((resolve, reject) => {

            // this.server.db.userGet(name).then(users => {
            //
            //     let user = users[0];
            //
            //     if (user.email) {
            //
            //     } else reject("Account has no email address.");
            //
            // });

            reject("Feature not yet coded.");
        });

    }

    changePass(request, pass, newPass) {

        return new Promise((resolve, reject) => {

            Promise.all([

                this.auth(this.name, pass),
                this.saltPass(this.name, newPass)

            ]).then(result => {

                let hash = result[1];

                this.log(`Changed password of '${this.name}'`);

                this.server.db.userSetPass(this.name, hash).then(
                    (/*result*/) => resolve(),
                    error => {this.error(error); reject("Unable to query database.");}
                );

            }, badCredentials => reject(badCredentials));

        });

    }

    changeEmail(reques, pass, newEmail) {

        return new Promise((resolve, reject) => {

            this.auth(this.name, pass).then((/*user*/) => {

                this.log(`Changed email of '${this.name}'`);

                this.server.db.userSetEmail(this.name, newEmail).then(
                    (/*result*/) => resolve(),
                    error => {this.error(error); reject("Unable to query database.");}
                );

            }, badCredentials => reject(badCredentials));

        });

    }

    saltPass(name, pass) {

        return new Promise((resolve, reject) => {

            bcrypt.genSalt(10, (err, salt) => {
                bcrypt.hash(`B1tt1e${name.substr(0, 5).toLowerCase()}${pass}`, salt, (err, hash) => {

                    if (err) reject("Uncaught server error.");
                    else resolve(hash);

                });
            });

        });

    }

    comparePass(name, pass, hash) {

        return new Promise((resolve, reject) => {

            bcrypt.compare(`B1tt1e${name.substr(0, 5).toLowerCase()}${pass}`, hash, (err, res) => {

                if (err) reject("Uncaught server error.");
                else resolve(res);

            });

        });

    }

    createRepo(request, name) {
        return this.server.getRepo(name).create(request, this.name);
    }

    deleteRepo(/*request, name*/) {

        return new Promise((resolve, reject) => {

            reject("Feature not yet coded.");   //Because it's not done so in the DB...

            // this.activeKey = new Key(30000);
            // resolve({key: this.activeKey.id});

        });

    }

    deleteRepoConfirm(/*request, key*/) {

        return new Promise((resolve, reject) => {

            reject("Feature not yet coded.");

            // if (this.activeKey && this.activeKey.id === key) {
            //     if (this.activeKey.expired) return reject("Key has expired.");
            //     return reject("Feature not yet coded.");
            // } else return reject("Key does not match.");

        });

    }

    setRole(request, repoName, userName, role) {
        return this.server.getRepo(repoName).setRole(request, userName, role);
    }

    deleteRole(request, repoName, userName) {
        return this.setRole(request, repoName, userName, "none");
    }

    createFile(request, repo, filePath) {
        return this.server.getRepo(repo).createFile(request, filePath, typeof request.initialLineId === "undefined" ? "0" : request.initialLineId);
    }

    moveFile(request, repo, oldPath, newPath) {
        return this.server.getRepo(repo).moveFile(request, oldPath, newPath);
    }

    deleteFile(request, repo, filePath) {
        return this.server.getRepo(repo).deleteFile(request, filePath);
    }

    getFile(request, repo, filePath) {
        return new Promise((resolve, reject) => {
            this.server.getRepo(repo).getFile(filePath).then(file => {
                if (!file) reject("File does not exist.");
                resolve(file);
            }, error => reject(error));
        });
    }

    listFiles(request, repo) {
        return this.server.getRepo(repo).listFiles(new RegExp(request.json.regExp, request.json.regOptions));
    }

    createDirectory(/*request, repo, directory*/) {

        return new Promise((resolve, reject) => {

            reject("This feature has been depreciated.");

            // directory = directory.replace(/\\/g, "/");
            // if (directory.slice(-1) === "/") directory = directory.slice(0, -1);
            //
            // this.server.db.dirExists(repo, directory).then(result => {
            //
            //     if (result > 0) return reject("Directory already exists.");
            //
            //     this.server.db.dirCreate(repo, directory).then(
            //         (/*result*/) => resolve(),
            //         (/*error*/) => reject("Uncaught server error.")
            //     );
            //
            // }, (/*error*/) => reject("Uncaught server error."));
        });
    }

    moveDirectory(/*request, repo, directory, newPath*/) {

        return new Promise((resolve, reject) => {

            reject("This feature has been depreciated.");

            // directory = directory.replace(/\\/g, "/");
            // if (directory.slice(-1) === "/") directory = directory.slice(0, -1);
            //
            // newPath = newPath.replace(/\\/g, "/");
            // if (newPath.slice(-1) === "/") newPath = newPath.slice(0, -1);
            //
            // this.server.db.dirExists(repo, directory).then(result => {
            //
            //     if (result === 0) return reject("Directory does not exist.");
            //
            //     this.server.db.dirMove(repo, directory, newPath).then(
            //         (/*result*/) => resolve(),
            //         (/*error*/) => reject("Uncaught server error.")
            //     );
            //
            // }, (/*error*/) => reject("Uncaught server error."));
        });
    }

    deleteDirectory(/*request, repo, directory*/) {

        return new Promise((resolve, reject) => {

            reject("This feature has been depreciated.");

            // directory = directory.replace(/\\/g, "/");
            // if (directory.slice(-1) === "/") directory = directory.slice(0, -1);
            //
            // this.server.db.dirExists(repo, directory).then(result => {
            //
            //     if (result === 0) return reject("Directory does not exist.");
            //
            //     this.server.db.dirDelete(repo, directory).then(
            //         (/*result*/) => resolve(),
            //         (/*error*/) => reject("Uncaught server error.")
            //     );
            //
            // }, (/*error*/) => reject("Uncaught server error."));
        });
    }

    lineInsert(request, repo, filePath, lineId, column, data) {
        return this.server.getRepo(repo).insert(request, filePath, lineId, column, data);
    }

    lineErase(request, repo, filePath, lineId, column, deleteCount) {
        return this.server.getRepo(repo).erase(request, filePath, lineId, column, deleteCount);
    }

    lineSplit(request, repo, filePath, lineId, column, newLineId) {
        return this.server.getRepo(repo).split(request, filePath, lineId, column, newLineId);
    }

    lineMerge(request, repo, filePath, lineId) {
        return this.server.getRepo(repo).merge(request, filePath, lineId);
    }

    getLine(request, repo, filePath, lineId) {
        return this.server.getRepo(repo).getLine(filePath, lineId);
    }

    sync(repo, path, json) {

        let rules = this.listeners[repo.name],
            match;

        if (typeof rules[path] !== "undefined") match = rules[path];
        else {
            match = {path: "", invalid: true};

            for (let i = 0; i < rules.length; i++)
                if (path.indexOf(rules[i].path) === 0 && rules[i].path.length > match.path.length)
                    match = rules[i];

            if (!match) return;
            else rules[path] = match;

        }

        switch (match.listener) {

            case "live":
                this.send(json);
                break;

        }

    }

    addListener(repo, rule) {

        if (typeof this.listeners[repo.name] === "undefined") this.listeners[repo.name] = [rule];
        else this.listeners[repo.name].push(rule);

    }

    setListener(/*request, repo, path*/) {
        return new Promise((request, resolve) => resolve("Feature not yet coded."));
        // return this.server.getRepo(repo).setListener(repo, path);
    }

    deleteListener(/*request, repo, path*/) {
        return new Promise((request, resolve) => resolve("Feature not yet coded."));
        // return this.server.getRepo(repo).setListener(repo, path);
    }

    getListeners(/*request*/) {
        return new Promise((request, resolve) => resolve("Feature not yet coded."));
    }

    enableListeners(/*request*/) {
        return new Promise((request, resolve) => resolve("Feature not yet coded."));
    }

    disableListeners(/*request*/) {
        return new Promise((request, resolve) => resolve("Feature not yet coded."));
    }

    // setListener(repo, rule) {
    //
    //     let listenerGroup = this.listeners.get(repo);
    //
    //     for (let i = 0; i < listenerGroup.length; i++)
    //
    // }

    //A factory-like way of handling requests, since a client must queue them
    newRequest(json) {

        //Assert all events have an id
        if (typeof json.id === "undefined") {

            this.send({
                id: "onReject",
                reason: "No ID.",
                data: json
            });

            return;

        }

        let request = new Request(this, json);

        //Bind a finish listener first
        request.on("finish", this.finishRequest.bind(this));
        request.on("fail", this.failRequest.bind(this));

        //If the request queue was empty, start processing!
        if (this.requestQueue.push(request) === 1)
            request.process();

    }

    failRequest() {

        //TODO: Abort a transaction when implemented

        this.requestQueue.shift();

        //If there is still something in the queue, process it
        if (this.requestQueue.length) this.requestQueue[0].process();

    }

    finishRequest() {

        this.requestQueue.shift();

        //If there is still something in the queue, process it
        if (this.requestQueue.length) this.requestQueue[0].process();

    }

    //Assert all messages as proper JSON
    onMessage(data) {

        data = data.toString();

        // if (data.indexOf("pass") >= 0) this.log("[RECV]", data.substr(0, data.indexOf("pass") + 6), "[REDACTED]");
        // else this.log("[RECV]", data);

        let json;

        try {json = JSON.parse(data);}
        catch (err) {return this.send({id: "onReject", reason: "Invalid JSON.", data: data});}

        if (typeof json !== "object" || json instanceof Array) return this.send({id: "onReject", reason: "JSON is not an object.", data: data});
        if (typeof json.id === "undefined") return this.send({id: "onReject", reason: "ID is not defined.", data: data});
        if (typeof json.id !== "string") return this.send({id: "onReject", reason: "ID is not a string.", data: data});
        if (json.id === "") return this.send({id: "onReject", reason: "ID is an empty string.", data: data});

        this.newRequest(json);

        //Push individual events into a queue
        // if (json instanceof Array)
        //
        //     for (let i = 0; i < json.length; i++)
        //
        //         if (typeof json[i] === "object") this.newRequest(json[i]);
        //         else {
        //
        //             this.send({
        //                 id: "onReject",
        //                 reason: "SubRequest is not an object.",
        //                 data: json[i]
        //             });
        //
        //             return;
        //
        //         }
        //
        // else this.newRequest(json);

    }

    onClose() {

        this.log("Connection closed");
        this.emit("close", this);

    }

    onError(error) {

        this.log("onError", error);

    }

    //Set all out-going communications with the time
    send(json) {

        json.time = Date.now();

        let s = JSON.stringify(json);

        // if (s.indexOf("pass") >= 0) this.log("[SEND]", s.substr(0, s.indexOf("pass") + 6), "[REDACTED]");
        // else this.log("[SEND]", s);

        this.socket.send(s);

    }

    //Decorate log events with a stamp of the client
    log() {

        /*eslint-disable no-console*/
        console.log(...[colors.green(`[${this.tag}]`), ...arguments]);
        /*eslint-enable no-console*/

    }

    //Decorate error events with a stamp of the client
    error() {

        /*eslint-disable no-console*/
        console.error(...[colors.green(`[${this.tag}]`), ...arguments]);
        /*eslint-enable no-console*/

    }

    // onPing(data, flags) {
    //
    //     console.log("onPing", data, flags);
    //
    // }
    //
    // onPong(data, flags) {
    //
    //     console.log("onPong", data, flags);
    //
    // }

}

module.exports = Client;
