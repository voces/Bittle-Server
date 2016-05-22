
"use strict";

const EventEmitter = require("events"),
    colors = require("colors");

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
                case "changePass": this.enforceParamsThenCall({newPass: "string"}, this.client.changePass.bind(this.client)); break;
                case "changeEmail": this.enforceParamsThenCall({pass: "string", newEmail: "string"}, this.client.changeEmail.bind(this.client)); break;

                //Share
                case "track": this.enforce({type: {filename: "string"}, instaceof: {lines: Array}}, this.client.track.bind(this.client)); break;
                case "untrack": this.enforce({type: {filename: "string"}}, this.client.untrack.bind(this.client)); break;
                case "invite": this.enforce({type: {name: "string"}}, this.client.invite.bind(this.client)); break;
                case "accept": this.enforce({type: {shareId: "number", blame: "string"}}, this.client.accept.bind(this.client)); break;
                case "decline": this.enforce({type: {shareId: "number", blame: "string"}}, this.client.decline.bind(this.client)); break;
                // case "unshare": this.enforce({type: {name: "string"}}, this.client.unshare.bind(this.client)); break;

                //Files
                case "get": this.enforce({type: {filename: "string"}}, this.client.getFile.bind(this.client)); break;
                case "lines": this.enforce({type: {filename: "string", start: "number", deleteCount: "number"},
                    instaceof: {lines: Array}}, this.client.lines.bind(this.client)); break;
                case "line": this.enforce({type: {filename: "string", lineIndex: "number", start: "number", deleteCount: "number", line: "string"}},
                    this.client.line.bind(this.client)); break;

                //Monitor
                case "focus": this.enforce({type: {filename: "string", line: "number", column: "number"}}, this.client.focus.bind(this.client)); break;

                default: this.finish({id: "onReject", reason: "Bad ID.", data: this.json});

            }

    }

    enforce(conditions, callback) {

        for (let condition in conditions)
            switch (condition) {
                case "type":
                    for (let property in conditions[condition]) {
                        if (typeof this.json[property] === "undefined") return this.fail({reason: `Missing parameter ${property}.`});
                        if (typeof this.json[property] !== conditions[condition][property])
                            return this.fail({reason: `Mistyped parameter ${property}. Should be type ${conditions[condition][property]}.`});
                    }
                    break;

                case "instanceof":
                    for (let property in conditions[condition]) {
                        if (typeof this.json[property] === "undefined") return this.fail({reason: `Missing parameter ${property}.`});
                        if (typeof this.json[property] !== "object") return this.fail({reason: `Primitive parameter ${property}, should be an object.`});
                        if (typeof this.json[property] instanceof conditions[condition][property])
                            return this.fail({reason: `Parameter ${property} should be of type ${conditions[condition][property].constructor.name}.`});
                    }
                    break;

                case "or":
                    for (let property in conditions[condition])
                        if (this.enforce(conditions[condition][property]) !== false) break;

            }

        callback(this);

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

    fail(json) {

        this.status = "failed";

        if (typeof json === "string")
            json = {reason: json};

        json.data = this.json;

        this.send(json);

        this.emit("fail", this);

        return false;

    }

    finish(json) {

        this.status = "closed";

        this.send(json);

        // this.client.log("[FINISH]", this.json.id);

        this.emit("finish", this);

        return true;

    }

    //Set status of all packets; set part if part > 1
    send(json) {

        json = json || {};

        json.status = this.status;

        if (typeof this.json.echo !== "undefined") json.echo = this.json.echo;

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
