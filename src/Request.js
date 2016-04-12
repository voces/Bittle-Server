
"use strict";

const EventEmitter = require("events"),
    colors = require("colors"),

    PERMISSIONS = ["owner", "manager", "contributor", "observer", "none"];

class Request extends EventEmitter {

    //All events start queued
    constructor(client, json) {

        super();

        this.client = client;
        this.json = json;
        this.part = 0;

        this.status = "queued";

    }

    process() {

        this.status = "open";

        // this.client.log("[PROCESS]", this.json.id);

        //Handle PREAUTH events here
        if (!this.client.authenticated)

            switch (this.json.id) {

                case "clean": this.client.server.clean(); this.finish(); break;

                case "register": this.enforceParamsThenCall({name: "string", pass: "string"}, this.client.register.bind(this.client)); break;
                case "login": this.enforceParamsThenCall({name: "string", pass: "string"}, this.client.login.bind(this.client)); break;

                case "changePass":
                    this.enforceParamsThenCall({name: "string", pass: "string", newPass: "string"}, this.client.changePassAuth.bind(this.client));
                    break;

                case "changeEmail":
                    this.enforceParamsThenCall({name: "string", pass: "string", newEmail: "string"}, this.client.changeEmailAuth.bind(this.client));
                    break;

                case "resetPass": this.enforceParamsThenCall({name: "string"}, this.client.resetPass.bind(this.client)); break;

                default: this.fail({reason: "Request ID is not valid or is not allowed before logging in.", data: this.json});

            }

        //Handle all other events here
        else

            switch (this.json.id) {

                //Misc
                case "clean": this.client.server.db.clean(); this.finish(); break;

                //Auth
                case "logout": this.enforceParamsThenCall(null, this.client.logout.bind(this.client)); break;
                case "changePass": this.enforceParamsThenCall({pass: "string", newPass: "string"}, this.client.changePass.bind(this.client)); break;
                case "changeEmail": this.enforceParamsThenCall({pass: "string", newEmail: "string"}, this.client.changeEmail.bind(this.client)); break;

                //Repo management
                case "createRepo": this.enforceParamsThenCall({name: "string"}, this.client.createRepo.bind(this.client)); break;
                case "deleteRepo": this.enforceParamsAndAccessThenCall({repo: "string"}, "owner", this.client.deleteRepo.bind(this.client)); break;
                case "deleteRepoConfirm": this.enforceParamsThenCall({key: "number"}, this.client.deleteRepoConfirm.bind(this.client)); break;

                //Roles
                case "setRole":
                    this.enforceParamsAndAccessThenCall({repo: "string", user: "string", role: "string"}, "manager",
                        this.client.setRole.bind(this.client));
                    break;

                case "deleteRole":
                    this.enforceParamsAndAccessThenCall({repo: "string", user: "string"}, "manager", this.client.deleteRole.bind(this.client));
                    break;

                //listeners
                case "setListener":
                    this.enforceParamsAndAccessThenCall({repo: "string", path: "string", listener: "string"}, "contributor",
                        this.client.setListener.bind(this.client));
                    break;

                case "deleteListener":
                    this.enforceParamsAndAccessThenCall({repo: "string", path: "string"}, "contributor", this.client.deleteListener.bind(this.client));
                    break;

                case "getListeners":
                    this.enforceParamsAndAccessThenCall({}, "contributor", this.client.getListeners.bind(this.client));
                    break;

                case "enableListeners":
                    this.enforceParamsAndAccessThenCall({}, "contributor", this.client.enableListeners.bind(this.client));
                    break;

                case "disableListeners":
                    this.enforceParamsAndAccessThenCall({}, "contributor", this.client.disableListeners.bind(this.client));
                    break;

                //Files
                case "createFile":
                    this.enforceParamsAndAccessThenCall({repo: "string", file: "string"}, "contributor", this.client.createFile.bind(this.client));
                    break;

                case "moveFile":
                    this.enforceParamsAndAccessThenCall({repo: "string", file: "string", newPath: "string"}, "contributor",
                        this.client.moveFile.bind(this.client));
                    break;

                case "deleteFile":
                    this.enforceParamsAndAccessThenCall({repo: "string", file: "string"}, "contributor", this.client.deleteFile.bind(this.client));
                    break;

                case "getFile":
                    this.enforceParamsAndAccessThenCall({repo: "string", file: "string"}, "contributor", this.client.getFile.bind(this.client));
                    break;

                //Directories
                case "getFiles":
                    this.enforceParamsAndAccessThenCall({repo: "string"}, "contributor", this.client.listFiles.bind(this.client));
                    break;

                case "createDirectory":
                    this.enforceParamsAndAccessThenCall({repo: "string", directory: "string"}, "contributor", this.client.createDirectory.bind(this.client));
                    break;

                case "moveDirectory":
                    this.enforceParamsAndAccessThenCall({repo: "string", directory: "string", newPath: "string"}, "contributor",
                        this.client.moveDirectory.bind(this.client));
                    break;

                case "deleteDirectory":
                    this.enforceParamsAndAccessThenCall({repo: "string", directory: "string"}, "contributor", this.client.deleteDirectory.bind(this.client));
                    break;

                //Lines
                case "insert":
                    this.enforceParamsAndAccessThenCall({repo: "string", file: "string", lineId: "string", col: "number", data: "string"}, "contributor",
                        this.client.lineInsert.bind(this.client));
                    break;

                case "erase":
                    this.enforceParamsAndAccessThenCall({repo: "string", file: "string", lineId: "string", col: "number", count: "number"}, "contributor",
                        this.client.lineErase.bind(this.client));
                    break;

                case "split":
                    this.enforceParamsAndAccessThenCall({repo: "string", file: "string", lineId: "string", col: "number", newLineId: "string"}, "contributor",
                        this.client.lineSplit.bind(this.client));
                    break;

                case "merge":
                    this.enforceParamsAndAccessThenCall({repo: "string", file: "string", lineId: "string"}, "contributor",
                        this.client.lineMerge.bind(this.client));
                    break;

                case "getLine":
                    this.enforceParamsAndAccessThenCall({repo: "string", file: "string", lineId: "string"}, "contributor",
                        this.client.getLine.bind(this.client));
                    break;

                default: this.finish({id: "onReject", reason: "Bad ID.", data: this.json});

            }

    }

    enforceParams(paramTypes) {

        let params = [];

        for (let param in paramTypes)
            if (typeof this.json[param] === "undefined") {
                this.fail({reason: `Missing parameter ${param}.`});
                return;
            } else if (typeof this.json[param] !== paramTypes[param]) {
                this.fail({reason: `Mistyped parameter ${param}. Should be type ${paramTypes[param]}.`});
                return;
            } else params.push(this.json[param]);

        return params;

    }

    enforceParamsThenCall(paramTypes, callback) {

        let params = this.enforceParams(paramTypes);

        if (params)
            callback(this, ...params).then(
                result => this.finish(result),
                error => this.fail(error)
            ).catch(error => {this.error(error); this.fail("Server syntax error.");});

    }

    enforceParamsAndAccessThenCall(paramTypes, access, callback) {

        let params = this.enforceParams(paramTypes);
        if (!params) return;

        this.client.server.getRepo(this.json.repo).getRole(this.client.name).then(role => {

            if (PERMISSIONS.indexOf(role) > PERMISSIONS.indexOf(access)) return this.fail("Not enough permission.");

            this.role = role;

            callback(this, ...params).then(
                result => this.finish(result),
                error => this.fail(error)
            ).catch(error => {this.error(error); this.fail("Server syntax error.");});

        }, error => this.fail(error));

    }

    fail(json) {

        this.status = "failed";

        if (typeof json === "string")
            json = {reason: json};

        json.data = this.json;

        this.send(json);

        this.emit("fail", this);

    }

    finish(json) {

        this.status = "closed";

        this.send(json);

        // this.client.log("[FINISH]", this.json.id);

        this.emit("finish", this);

    }

    //Set status of all packets; set part if part > 1
    send(json) {

        json = json || {};

        json.status = this.status;

        if (typeof json.id !== "string") json.id = this.json.id;

        if (this.part > 0) json.part = ++this.part;
        else this.part++;

        this.client.send(json);

    }

    error() {

        this.client.error(...[colors.red(`[${this.json.id}]`), ...arguments]);

    }

    log() {

        this.client.log(...[colors.yellow(`[${this.json.id}]`), ...arguments]);

    }

}

module.exports = Request;
