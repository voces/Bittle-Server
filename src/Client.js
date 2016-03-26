
"use strict";

const EventEmitter = require("events"),
    colors = require("colors"),
    bcrypt = require("bcryptjs"),

    Request = require("./Request"),
    Key = require("./Key"),

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

                if (users.length === 0) {

                    reject("Account does not exist.")
                    return;

                }

                if (users.length > 1) {

                    this.error("Duplicate users?", name, users);
                    reject("Duplicate users found.");
                    return;

                }

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
                    result => resolve(),
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

            }, error => reject("Uncaught server error."));

        });

    }

    logout(request) {

        return new Promise((resolve, reject) => {

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

                let user = result[0],
                    hash = result[1];

                this.server.db.userSetPass(name, hash).then(
                    result => resolve(),
                    error => {this.error(error); reject("Unable to query database.");}
                );

            }, error => reject("Uncaught server error."));

        });

    }

    changeEmailAuth(request, name, pass, newEmail) {

        return new Promise((resolve, reject) => {

            this.auth(name, pass).then(user => {

                this.server.db.userSetEmail(name, newEmail).then(
                    result => resolve(),
                    error => {this.error(error); reject("Unable to query database.");}
                );

            }, error => reject("Uncaught server error."));

        });

    }

    //This function requires a mailer of some sort
    // Considering https://github.com/andris9/smtp-server
    resetPass(request, name) {

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

    changePass(request, name, pass, newPass) {

        return new Promise((resolve, reject) => {

            this.saltPass(name, newPass).then(hash => {

                this.server.db.userSetPass(name, hash).then(
                    result => resolve(),
                    error => {this.error(error); reject("Unable to query database.");}
                );

            }, error => reject("Uncaught server error."));

        });

    }

    changeEmail(request, name, pass, newEmail) {

        return new Promise((resolve, reject) => {

            this.server.db.userSetEmail(name, newEmail).then(
                result => resolve(),
                error => {this.error(error); reject("Unable to query database.");}
            );

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

                    result => resolve(),
                    error => reject("Uncaught server error.")

                );

            }, error => {this.error(error); reject("Unable to query database.");});

        });

    }

    deleteRepo(request, name) {

        return new Promise((resolve, reject) => {

            // reject("Feature not yet coded.");   //Because it's not done so in the DB...

            this.activeKey = new Key(30000);
            resolve({key: this.activeKey.id});

        });

    }

    deleteRepoConfirm(request, key) {

        return new Promise((resolve, reject) => {

            if (this.activeKey && this.activeKey.id === key) {
                if (this.activeKey.expired) return reject("Key has expired.");
                return reject("Feature not yet coded.");
            } else return reject("Key does not match.");

        });

    }

    addPermission(request, repo, userName, role) {

        return new Promise((resolve, reject) => {

            if (PERMISSIONS.indexOf(role) < 0)
                return reject("Role does not exist.");

            if (PERMISSIONS.indexOf(role) < PERMISSIONS.indexOf(request.access))
                return reject("Not enough permission.");

            Promise.all([

                this.server.db.userGet(userName),
                this.server.db.permGet(userName, repo)

            ]).then(result => {

                let user = result[0][0],
                    permRecord = result[1];

                if (!user) return reject("User does not exist.");

                if (permRecord && PERMISSIONS.indexOf(permRecord.permission) <= PERMISSIONS.indexOf(request.access))
                    return reject("User has equal or greater permission.");

                this.server.db.permSet(userName, repo, role).then(

                    result => resolve(),
                    error => reject("Uncaught server error.")

                );

            }, error => {this.error(error); reject("Uncaught server error.");});

        });

    }

    createFile(request, repo, path) {

        return new Promise((resolve, reject) => {

            this.server.db.fileExists(repo, path).then(result => {

                if (result > 0) return reject("File already exists.");

                this.server.db.fileCreate(repo, path).then(result => {

                    resolve();

                }, error => reject("Uncaught server error.")).catch(error => this.error(error));

            }, error => reject("Uncaught server error.")).catch(error => this.error(error));

        });

    }

    moveFile(request, repo, file, newPath) {return new Promise((resolve, reject) => {return reject("Feature not yet coded.");});}
    deleteFile(request, repo, file) {return new Promise((resolve, reject) => {return reject("Feature not yet coded.");});}

    createDirectory(request, repo, directory) {return new Promise((resolve, reject) => {return reject("Feature not yet coded.");});}
    moveDirectory(request, repo, directory, newPath) {return new Promise((resolve, reject) => {return reject("Feature not yet coded.");});}
    deleteDirectory(request, repo, directory) {return new Promise((resolve, reject) => {return reject("Feature not yet coded.");});}

    lineInsert(request, repo, file, lineId, column, data) {return new Promise((resolve, reject) => {return reject("Feature not yet coded.");});}
    lineErase(request, repo, file, lineId, column, count) {return new Promise((resolve, reject) => {return reject("Feature not yet coded.");});}
    lineSplit(request, repo, file, lineId, column, newLineId) {return new Promise((resolve, reject) => {return reject("Feature not yet coded.");});}
    lineMerge(request, repo, file, lineId) {return new Promise((resolve, reject) => {return reject("Feature not yet coded.");});}

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
    onMessage(data, flags) {

        data = data.toString();

        if (data.indexOf("pass") >= 0) this.log("[RECV]", data.substr(0, data.indexOf("pass") + 6), "[REDACTED]");
        else this.log("[RECV]", data);

        let json;

        try {json = JSON.parse(data);}
        catch (err) {return this.send({id: "onReject", reason: "Invalid JSON.", data: data})};

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

    onClose(code, message) {

        this.log("Connection closed");

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

        console.log(...[colors.green(`[${this.tag}]`), ...arguments]);

    }

    //Decorate error events with a stamp of the client
    error() {

        console.error(...[colors.green(`[${this.tag}]`), ...arguments]);

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
