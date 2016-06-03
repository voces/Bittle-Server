
"use strict";

let shareId = Math.floor(Math.random() * 1000000);

class Share {

    constructor(client) {

        this.clients = {};
        this.invites = {};
        this.requests = {};

        this.numClients = 1;

        this.files = {};

        this.clients[client.name] = client;

        this.id = shareId;

        Share.list[this.id] = this;

        shareId += Math.floor(Math.random() * 1000000) % 2147483647;

    }

    broadcast(json) {

        for (let client in this.clients) this.clients[client].send(json);

    }

    addFile(blame, file) {

        this.files[file.filename] = file;

        this.broadcast({id: "addFile", filename: file.filename, blame: blame.name});

    }

    removeFile(blame, file) {

        delete this.files[file.filename];

        this.broadcast({id: "removeFile", filename: file.filename, blame: blame.name});

    }

    invite(blame, client) {

        this.invites[client.name] = client;

        client.send({id: "invite", blame: blame.name, shareId: this.id});

    }

    accept(client, blame) {

        delete this.invites[client.name];
        this.addClient(client, blame);

    }

    decline(client) {

        delete this.invites[client.name];

    }

    request(client) {

        this.requests[client.name] = client;

        this.broadcast({id: "request", name: client.name, shareId: this.id});

    }

    approve(client, blame) {

        delete this.requests[blame.name];

        this.addClient(blame, client);

    }

    reject(client, blame) {

        delete this.requests[blame.name];

    }

    addClient(client, blame) {

        this.broadcast({id: "addClient", name: client.name, blame: blame.name});

        this.clients[client.name] = client;
        this.numClients++;

        client.send({id: "addClient", files: Object.getOwnPropertyNames(this.files), names: Object.getOwnPropertyNames(this.clients), blame: blame.name});

    }

    removeClient(client) {

        this.broadcast({id: "removeClient", name: client.name});
        // this.broadcast({id: "removeClient", name: client.name, blame: blame.name});

        delete this.clients[client.name];
        this.numClients--;

        if (this.numClients === 0) delete Share.list[this.id];


    }

    focus(client, file) {

        this.broadcast({id: "focus", blame: client.name, filename: file.filename});

    }

}

Share.list = [];

module.exports = Share;
