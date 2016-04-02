
"use strict";

const EventEmitter = require("events"),
    colors = require("colors"),
    bcrypt = require("bcryptjs"),

    Request = require("./Request"),
    // Key = require("./Key"),

    PERMISSIONS = ["owner", "manager", "contributor", "observer", "none"];

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

                this.server.db.userCreate(name, hash, request.json.email).then(
                    (/*result*/) => resolve(),
                    error => {this.error(error); reject("Unable write to database.");}
                );

            }, error => {this.error(error); reject("Unable to query database.");});

        });

    }

    login(request, name, pass) {

        return new Promise((resolve, reject) => {

            this.auth(name, pass).then(user => {

                this.authenticated = true;

                this.name = name;
                this.originaName = user.name;
                this.email = user.email;

                resolve();

            }, badCredentials => reject(badCredentials));

        });

    }

    logout(/*request*/) {

        return new Promise((resolve/*, reject*/) => {

            this.authenticated = false;

            this.name = undefined;
            this.originaName = undefined;
            this.email = undefined;

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

        return new Promise((resolve, reject) => {

            this.server.db.repoGet(name).then(repo => {

                if (repo) return reject("Name is already taken.");

                Promise.all([

                    this.server.db.repoCreate(name),
                    this.server.db.permSet(this.name, name, "owner")

                ]).then(

                    (/*result*/) => resolve(),
                    (/*error*/) => reject("Uncaught server error.")

                );

            }, error => {this.error(error); reject("Unable to query database.");});

        });

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

    addPermission(request, repoName, userName, role) {

        return new Promise((resolve, reject) => {

            if (PERMISSIONS.indexOf(role) < 0)
                return reject("Role does not exist.");

            if (PERMISSIONS.indexOf(role) < PERMISSIONS.indexOf(request.access))
                return reject("Not enough permission.");

            Promise.all([

                this.server.db.userGet(userName),
                this.server.db.repoGet(repoName),
                this.server.db.permGet(userName, repoName)

            ]).then(result => {

                let user = result[0][0],
                    repo = result[1],
                    permRecord = result[2];

                if (!user) return reject("User does not exist.");
                if (!repo) return reject("Repo does not exist.");

                if (permRecord && PERMISSIONS.indexOf(permRecord.permission) <= PERMISSIONS.indexOf(request.access))
                    return reject("User has equal or greater permission.");

                if (!permRecord && role === "none")
                    return reject("User does not have any permission.");

                this.log(role === "none" ? "permDelete" : "permSet", userName, repoName, role);
                this.server.db[role === "none" ? "permDelete" : "permSet"](userName, repoName, role).then(

                    (/*result*/) => resolve(),
                    (/*error*/) => reject("Uncaught server error.")

                );

            }, error => {this.error(error); reject("Uncaught server error.");});

        });

    }

    deletePermission(request, repoName, userName) {
        return this.addPermission(request, repoName, userName, "none");

    }

    createFile(request, repo, path) {

        return new Promise((resolve, reject) => {

            this.server.db.fileExists(repo, path).then(result => {

                if (result > 0) return reject("File already exists.");

                this.server.db.fileCreate(repo, path).then(
                    (/*result*/) => resolve(),
                    (/*error*/) => reject("Uncaught server error.")
                );

            }, (/*error*/) => reject("Uncaught server error."));
        });
    }

    moveFile(request, repo, file, newPath) {

        return new Promise((resolve, reject) => {

            this.server.db.fileExists(repo, file).then(result => {

                if (result === 0) return reject("File does not exist.");

                this.server.db.fileMove(repo, file, newPath).then(
                    (/*result*/) => resolve(),
                    (/*error*/) => reject("Uncaught server error.")
                );

            }, (/*error*/) => reject("Uncaught server error."));
        });
    }

    deleteFile(request, repo, file) {

        return new Promise((resolve, reject) => {

            this.server.db.fileExists(repo, file).then(result => {

                if (result === 0) return reject("File does not exist.");

                this.server.db.fileDelete(repo, file).then(
                    (/*result*/) => resolve(),
                    (/*error*/) => reject("Uncaught server error.")
                );

            }, (/*error*/) => reject("Uncaught server error."));
        });
    }

    getFile(request, repo, path) {

        return new Promise((resolve, reject) => {

            this.server.db.fileGet(repo, path).then(file => {

                this.log(file);

                let returnFile = {
                    repo: file.repo,
                    path: file.path,
                    lines: []
                };

                for (let i = 0; i < file.lines.length; i++)
                    returnFile.lines[i] = {lineId: file.lines[i].lineId, line: file.lines[i].line};

                resolve(returnFile);

            }, error => reject(error));

        });
    }

    createDirectory(request, repo, directory) {

        return new Promise((resolve, reject) => {

            this.server.db.dirExists(repo, directory).then(result => {

                if (result > 0) return reject("Directory already exists.");

                this.server.db.dirCreate(repo, directory).then(
                    (/*result*/) => resolve(),
                    (/*error*/) => reject("Uncaught server error.")
                );

            }, (/*error*/) => reject("Uncaught server error."));
        });
    }

    moveDirectory(request, repo, directory, newPath) {

        return new Promise((resolve, reject) => {

            this.server.db.dirExists(repo, directory).then(result => {

                if (result === 0) return reject("Directory does not exist.");

                this.server.db.dirMove(repo, directory, newPath).then(
                    (/*result*/) => resolve(),
                    (/*error*/) => reject("Uncaught server error.")
                );

            }, (/*error*/) => reject("Uncaught server error."));
        });
    }

    deleteDirectory(request, repo, directory) {

        return new Promise((resolve, reject) => {

            this.server.db.dirExists(repo, directory).then(result => {

                if (result === 0) return reject("Directory does not exist.");

                this.server.db.dirDelete(repo, directory).then(
                    (/*result*/) => resolve(),
                    (/*error*/) => reject("Uncaught server error.")
                );

            }, (/*error*/) => reject("Uncaught server error."));
        });
    }

    lineInsert(request, repo, file, lineId, column, data) {

        return new Promise((resolve, reject) => {

            Promise.all([

                this.server.db.fileExists(repo, file),
                this.server.db.lineGet(repo, file, lineId)

            ]).then(result => {

                if (result[0] === 0) return reject("File does not exist.");

                let line = result[1];

                if (line === null) line = "";
                else line = line.line;

                this.server.db.lineSet(repo, file, lineId, line.slice(0, column) + data + line.slice(column)).then(
                    (/*result*/) => resolve(),
                    (/*error*/) => reject("Uncaught server error.")
                );

            });

        });
    }

    lineErase(request, repo, file, lineId, column, count) {

        return new Promise((resolve, reject) => {

            Promise.all([

                this.server.db.fileExists(repo, file),
                this.server.db.lineGet(repo, file, lineId)

            ]).then(result => {

                if (result[0] === 0) return reject("File does not exist.");

                let line = result[1];

                if (line === null) line = "";
                else line = line.line;

                this.server.db.lineSet(repo, file, lineId, line.slice(0, column) + line.slice(column + count)).then(
                    (/*result*/) => resolve(),
                    (/*error*/) => reject("Uncaught server error.")
                );

            });

        });

    }

    lineSplit(request, repo, file, lineId, column, newLineId) {

        return new Promise((resolve, reject) => {

            Promise.all([

                this.server.db.fileExists(repo, file),
                this.server.db.lineGet(repo, file, lineId),
                this.server.db.lineGet(repo, file, newLineId)

            ]).then(result => {

                if (result[0] === 0) return reject("File does not exist.");

                let oldLine = result[1],
                    newLine = result[2];

                if (oldLine === null) return reject("Line does not exist");
                else oldLine = oldLine.line;

                if (newLine !== null) return reject("Line already exists.");

                if (column === -1) column = oldLine.length;

                Promise.all([

                    this.server.db.lineSet(repo, file, lineId, oldLine.slice(0, column), null, newLineId),
                    this.server.db.lineSet(repo, file, newLineId, oldLine.slice(column), lineId)

                ]).then(result => resolve());

            });

        });

    }

    lineMerge(request, repo, file, lineId) {

        return new Promise((resolve, reject) => {

            Promise.all([

                this.server.db.fileExists(repo, file),
                this.server.db.lineGet(repo, file, lineId)

            ]).then(result => {

                if (result[0] === 0) return reject("File does not exist.");

                let deletedLine = result[1];

                if (deletedLine === null) return reject("Line does not exist.");
                if (typeof deletedLine.previous === "undefined") return reject("Line does not follow another.");

                Promise.all([

                    this.server.db.lineGet(repo, file, deletedLine.previous),
                    this.server.db.lineAfter(repo, file, lineId)

                ]).then(result => {

                    let merger = result[0],
                        after = result[1];

                    let relocate = () => {};
                    if (after !== null) relocate = this.server.db.lineSet(repo, file, after.lineId, after.line, merger.lineId);

                    this.log("update", merger.lineId, "relocate", after.lineId, "delete", lineId);

                    Promise.all([

                        this.server.db.lineSet(repo, file, merger.lineId, merger.line + deletedLine.line, null, after != null ? after.lineId : -1),
                        relocate,
                        this.server.db.lineRemove(repo, file, lineId)

                    ]).then((/*result*/) => resolve());

                });


            });

        });

    }

    getLine(request, repo, file, lineId) {

        return new Promise((resolve, reject) => {

            this.server.db.lineGet(repo, file, lineId).then(line => {

                if (line !== null) resolve({line: line.line, previous: line.previous, next: line.next, lineId: lineId});
                else reject("Line does not exist.");

            });

        });

    }

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

        if (data.indexOf("pass") >= 0) this.log("[RECV]", data.substr(0, data.indexOf("pass") + 6), "[REDACTED]");
        else this.log("[RECV]", data);

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

        if (s.indexOf("pass") >= 0) this.log("[SEND]", s.substr(0, s.indexOf("pass") + 6), "[REDACTED]");
        else this.log("[SEND]", s);

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
