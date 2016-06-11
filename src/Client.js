
"use strict";

const EventEmitter = require("events"),
    colors = require("colors"),
    bcrypt = require("bcryptjs"),

    Request = require("./Request"),
    Share = require("./Share"),
    File = require("./File"),

    sendMail = require("./mailer")(),
    randToken = require('rand-token'),
    strings = require("./StringManager");
    // Key = require("./Key");

let uid = 0;

class Client extends EventEmitter {

    //Bind some events and set defaults
    constructor(server, socket) {

        super();

        this.server = server;
        this.socket = socket;

        socket.on("close", this.onClose.bind(this));
        socket.on("message", this.onMessage.bind(this));
        socket.on("error", this.onError.bind(this));

        this.authenticated = false;

        this.share = new Share(this);
        this.invites = [];

        this.requestQueue = [];

        this.name = "anon#" + uid++;

        this.send({id: "connected", name: this.name, shareId: this.share.id});

        this.log("New connection");

    }

    //A general getter
    get tag() {

        if (this.authenticated) return this.name;

        if (this.socket.family === "IPv6") return `${this.name}@[${this.socket.ip}]:${this.socket.port}`;
        return `${this.name}@${this.socket.ip}:${this.socket.port}`;

    }

    auth(name, pass) {

        return new Promise((resolve, reject) => {

            this.server.db.userGet(name).then(users => {

                if (users.length === 0) return reject("Account does not exist.");

                let user = users[0];

                if (typeof user.resetToken !== "undefined")

                    Promise.all([

                        this.comparePass(name, pass, user.pass),
                        this.comparePass(name, pass, user.resetToken),

                    ]).then(result => {

                        let rightPass = result[0],
                            rightToken = result[1];

                        if (rightPass) {

                            this.server.db.userClearResetToken(user.name);
                            resolve(user);

                        } else if (rightToken) {

                            this.resetToken = true;
                            resolve(user);

                        }

                        reject("Incorrect pass.");

                    });

                else

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

                this.log(`Logged in as '${name}'`);

                this.authenticated = true;

                this.name = name;
                this.originaName = user.name;
                this.email = user.email;

                this.server.clients[name] = this;

                resolve();

            }, badCredentials => reject(badCredentials));

        });

    }

    logout(/*request*/) {

        return new Promise((resolve/*, reject*/) => {

            this.log(`Logged out from '${this.name}'`);

            this.authenticated = false;

            delete this.server.clients[this.name];

            if (this.share) {
                this.share.removeClient(this);
                this.share = undefined;
            }

            for (let i = 0; i < this.invites.length; i++)
                this.invites[i].decline(this);

            this.name = undefined;
            this.originaName = undefined;
            this.email = undefined;

            this.invites = [];

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

                let hash = result[1];

                this.log(`Changed password of '${name}'`);

                this.server.db.userClearResetToken(user.name);

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
    resetPass(request, name) {

        return new Promise((resolve, reject) => {

            this.server.db.userGet(name).then(users => {

                if (users.length === 0) return reject("Account does not exist.");

                let user = users[0];

                if (user.email) {

                    let token = randToken.generate(16),
                        url = `${user.name}/${token}`,

                        emailText = strings.en.passResetEmailText(url),
                        emailHTML = strings.en.passResetEmailHTML(url);

                    this.saltPass(name, token).then(hash => this.server.db.userSetResetToken(name, hash));

                    sendMail(user.email, "Pass Reset", emailText, emailHTML).then(

                        () => resolve(),
                        error => {
                            this.error(error);
                            reject("Unable to send email");
                        }

                    );

                } else reject("Account has no email address.");

            });

        });

    }

    changePass(request, newPass) {

        return new Promise((resolve, reject) => {

            if (typeof request.json.pass === "string")

                Promise.all([

                    this.auth(this.name, request.json.pass),
                    this.saltPass(this.name, newPass)

                ]).then(result => {

                    let hash = result[1];

                    this.log(`Changed password of '${this.name}'`);

                    this.server.db.userClearResetToken(user.name);

                    this.server.db.userSetPass(this.name, hash).then(
                        (/*result*/) => resolve(),
                        error => {this.error(error); reject("Unable to query database.");}
                    );

                }, badCredentials => reject(badCredentials));

            else if (this.resetToken)

                this.saltPass(this.name, newPass).then(hash => {

                    this.log(`Changed password of '${this.name}'`);

                    this.resetToken = false;

                    this.server.db.userClearResetToken(this.name);

                    this.server.db.userSetPass(this.name, hash).then(
                        (/*result*/) => resolve(),
                        error => {this.error(error); reject("Unable to query database.");}
                    );

                });

            else reject("Missing parameter pass.");

        });

    }

    changeEmail(request, pass, newEmail) {

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

    track(request) {

        if (!this.share) this.share = new Share(this);

        if (this.share.files[request.json.filename]) return request.fail("File already tracked.");

        this.share.addFile(this, new File(request.json.filename, request.json.lines, this.share));

        this.log(`Shared file '${request.json.filename}'`);

        return request.finish();

    }

    untrack(request) {

        if (!this.share) return request.fail("Not sharing anything with anyone.");

        if (typeof this.share.files[request.json.filename] === "undefined") return request.fail("Not sharing file.");

        this.share.removeFile(this, this.share.files[request.json.filename]);

        this.log(`Unshared file '${request.json.filename}'`);

        return request.finish();

    }

    invite(request) {

        if (!this.share) this.share = new Share(this);

        let client = this.server.clients[request.json.name];

        //TODO: send an email if not logged in
        if (typeof client === "undefined") return request.fail("User not logged in.");

        if (this.share.clients[request.json.name]) return request.fail("Already shared with user.");

        this.share.invite(this, client);
        client.invites.push(this.share);

        this.log(`Invited '${request.json.name}'`);

        // this.share.addClient(this, client);

        return request.finish();

    }

    accept(request) {

        let client = this.server.clients[request.json.blame];

        if (typeof client === "undefined") return request.fail("User not logged in.");

        if (typeof client.share.invites[this.name] === "undefined") return request.fail("Not invited.");

        if (typeof this.share !== "undefined") this.share.removeClient(this);

        this.share = client.share;
        this.share.accept(this, client);
        this.invites.splice(this.invites.indexOf(this.share), 1);

        this.log(`Accepted share with '${request.json.blame}'`);

        return request.finish();

    }

    decline(request) {

        let client = this.server.clients[request.json.blame];

        if (typeof client === "undefined") return request.fail("User not logged in.");

        if (typeof client.share.invites[this.name] === "undefined") return request.fail("Not invited.");

        client.share.decline(client);
        this.invites.splice(this.invites.indexOf(client.share), 1);

        this.log(`Declined share with '${request.json.blame}'`);

        return request.finish();

    }

    request(request) {

        let share = Share.list[request.json.shareId];

        if (typeof share === "undefined") return request.fail("Share does not exist.");

        share.request(this);

        this.log(`Requested to '${request.json.shareId}'`);

        return request.finish();

    }

    approve(request) {

        let share = Share.list[request.json.shareId];

        if (typeof share === "undefined") return request.fail("Share does not exist.");

        let client = share.requests[request.json.name];

        if (typeof client === "undefined") return request.fail("User has not requested.");

        client.share = share;
        share.approve(this, client);

        this.log(`Approved '${request.json.name}' to '${request.json.shareId}'`);

        return request.finish();

    }

    reject(request) {

        let share = Share.list[request.json.shareId];

        if (typeof share === "undefined") return request.fail("Share does not exist.");

        let client = share.requests[request.json.name];

        if (typeof client === "undefined") return request.fail("User has not requested.");

        client.share = share;
        share.reject(this, client);

        client.send({id: "reject"});

        this.log(`Rejected '${request.json.name}' to '${request.json.shareId}'`);

        return request.finish();

    }

    // unshare(request) {
    //
    //     if (!this.share) return request.fail("Not sharing anything with anyone.");
    //
    //     if (typeof this.share.clients[request.json.name] === "undefined") return request.fail("Not sharing with user.");
    //
    //     this.share.removeClient(this, this.share.clients[request.json.name]);
    //
    //     request.finish();
    //
    // }

    renameFile(request) {

        if (!this.share) return request.fail("Not sharing anything with anyone.");

        let file = this.share.files[request.json.filename];
        if (typeof file === "undefined") return request.fail("Not sharing file.");

        this.share.renameFile(this, file, request.json.newFilename);

        return request.finish();

    }

    getFile(request) {

        if (!this.share) return request.fail("Not sharing anything with anyone.");

        if (typeof this.share.files[request.json.filename] === "undefined") return request.fail("Not sharing file.");

        this.log(`Downloaded '${request.json.filename}'`);

        return request.finish({filename: request.json.filename, lines: this.share.files[request.json.filename].lines});

    }

    lines(request) {

        if (!this.share) return request.fail("Not sharing anything with anyone.");

        let file = this.share.files[request.json.filename];

        if (typeof file === "undefined") return request.fail("Not sharing file.");

        file.spliceLines(this, request.json.start, request.json.deleteCount, request.json.lines);

        request.finish();

    }

    line(request) {

        if (!this.share) return request.fail("Not sharing anything with anyone.");

        let file = this.share.files[request.json.filename];

        if (typeof file === "undefined") return request.fail("Not sharing file.");
        if (file.lines.length <= request.json.lineIndex) return request.fail("File does not have that many lines.");

        file.spliceLine(this, request.json.lineIndex, request.json.start, request.json.deleteCount, request.json.line);

        return request.finish();

    }

    focus(request) {

        if (!this.share) return request.fail("Not sharing anything with anyone.");

        let file = this.share.files[request.json.filename];
        if (typeof file === "undefined") return request.fail("Not sharing file.");

        this.share.focus(this, file);

        return request.finish();

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

        if (this.share) this.share.removeClient(this);

        for (let i = 0; i < this.invites.length; i++)
            this.invites[i].decline(this);

        this.log("Connection closed");
        this.emit("close", this);

    }

    onError(error) {

        this.log("onError", error);

    }

    //Set all out-going communications with the time
    send(json) {

        if (!(this.socket.readyState === 1 || this.socket.readyState === "open")) return;

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
