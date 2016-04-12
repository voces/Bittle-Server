"use strict";

const EventEmitter = require("events"),
    colors = require("colors"),

    // Request = require("./Request"),

    PERMISSIONS = ["owner", "manager", "contributor", "observer", "none"];

class Repo extends EventEmitter {

    constructor(server, repo) {
        super();

        this.server = server;
        this.name = repo;

        this.listeners = [];

        this.roles = {};
        this.files = {};

        this.get();
    }

    removeListener(client) {

        let index = this.listeners.indexOf(client);
        if (index >= 0) this.listeners.splice(index, 1);

    }

    addListener(client) {

        this.listeners.push(client);
        client.once("logout", () => this.removeListener(client));

    }

    sync(request, file, json) {

        json.origin = request.client.name;
        json.id = "sync";

        for (let i = 0; i < this.listeners.length; i++)
            this.listeners[i].sync(file, json);

    }

    exists() {

        return this.wait(resolve => resolve(this.db ? true : false));

    }

    create(request, owner) {

        return this.wait((resolve, reject) => {

            if (this.db !== null) return reject("Name is already taken.");

            Promise.all([
                this.server.db.repoCreate(this.name),
                this.server.db.roleSet(owner, this.name, "owner"),
                this.server.db.listenerSet(owner, this.name, ".*", "live")

            ]).then(() => {

                this.log(`Repo '${this.name}' created, '${owner}' is owner`);

                this.get();

                this.roles[owner.toLowerCase()] = "owner";
                request.client.setListener(this, {path: ".*", listener: "live"});
                this.addListener(request.client);

                resolve();

            });

        });

    }

    listFiles(regexp) {

        return this.wait((resolve, reject) => {

            if (this.db === null) return reject("Repo does not exist.");

            this.server.db.filesGet(this.name, regexp).then(files => resolve({files: files}));

        });

    }

    getRole(user) {

        return this.wait((resolve, reject) => {

            if (this.db === null) return reject("Repo does not exist.");

            let lowerUser = user.toLowerCase();

            if (typeof this.roles[lowerUser] !== "undefined") return resolve(this.roles[lowerUser]);

            this.server.db.roleGet(user, this.name).then(role => {

                if (role === null) this.roles[lowerUser] = "none";
                else this.roles[lowerUser] = role.role;

                resolve(this.roles[lowerUser]);

            });

        });

    }

    setRole(request, receiver, newRole) {

        let setter = request.client,
            setterRole = request.role;

        if (PERMISSIONS.indexOf(newRole) < 0)
            return new Promise((resolve, reject) => reject("Role does not exist."));

        if (PERMISSIONS.indexOf(newRole) < PERMISSIONS.indexOf(setterRole))
            return new Promise((resolve, reject) => reject("Not enough permission."));

        return this.wait((resolve, reject) => {

            if (this.db === null) return reject("Repo does not exist.");

            Promise.all([
                this.server.db.userGet(receiver),
                this.getRole(receiver)

            ]).then(result => {

                let user = result[0][0],
                    currentRole = result[1];

                if (!user) return reject("User does not exist.");

                if (currentRole && PERMISSIONS.indexOf(currentRole) <= PERMISSIONS.indexOf(setterRole))
                    return reject("User has equal or greater role.");

                if (currentRole === "none" && newRole === "none")
                    return reject("User does not have any role.");

                this.server.db[newRole === "none" ? "roleDelete" : "roleSet"](receiver, this.name, newRole).then(() => {
                    this.log(`Role of '${receiver}' changed to '${newRole}' by '${setter.name}'`);

                    this.roles[receiver.toLowerCase()] = newRole;

                    let client = this.server.clients[receiver];
                    if (client) client.send({id: "role", repo: this.name, role: newRole, origin: request.client.name});

                    resolve();

                });

            });

        });

    }

    getFile(filePath) {

        return this.wait((resolve, reject) => {

            if (this.db === null) return reject("Repo does not exist.");

            filePath = filePath.replace(/\\/g, "/");

            if (typeof this.files[filePath.toLowerCase()] === "undefined")

                this.server.db.fileGet(this.name, filePath).then(file => {

                    this.files[filePath.toLowerCase()] = file;
                    resolve(file);

                }, (/*error*/) => {

                    this.files[filePath.toLowerCase()] = null;
                    resolve(null);

                });

            else resolve(this.files[filePath.toLowerCase()]);

        });

    }

    createFile(request, filePath, initialLineId) {

        return this.wait((resolve, reject) => {

            if (this.db === null) return reject("Repo does not exist.");

            filePath = filePath.replace(/\\/g, "/");

            this.getFile(filePath).then(file => {

                if (file !== null) return reject("File already exists.");

                this.log(`File '${filePath}' created inside repo '${this.name}'`);

                this.server.db.fileCreate(this.name, filePath, initialLineId).then(() => {
                    delete this.files[filePath];
                    this.getFile(filePath);

                    resolve();

                }).catch(error => this.error(error));

            }, error => reject(error));

        });

    }

    moveFile(request, oldPath, newPath) {

        return this.wait((resolve, reject) => {

            if (this.db === null) return reject("Repo does not exist.");

            oldPath = oldPath.replace(/\\/g, "/");
            newPath = newPath.replace(/\\/g, "/");

            Promise.all([
                this.getFile(oldPath),
                this.getFile(newPath)

            ]).then(result => {

                let oldFile = result[0],
                    newFile = result[1];

                if (oldFile === null) return reject("File does not exist.");
                if (newFile !== null) return reject("File already exists.");

                this.files[newPath] = oldFile;
                this.files[oldPath] = null;

                oldFile.version++;
                oldFile.updated = Date.now();

                this.log(`File '${oldPath}' moved to '${newPath}' inside repo '${this.name}'`);

                this.server.db.fileMove(this.name, oldPath, newPath).then(() => resolve());

            });

        });

    }

    deleteFile(request, filePath) {

        return this.wait((resolve, reject) => {

            if (this.db === null) return reject("Repo does not exist.");

            filePath = filePath.replace(/\\/g, "/");

            this.getFile(filePath).then(file => {

                if (file === null) return reject("File does not exist.");

                this.log(`File '${filePath}' deleted from repo '${this.name}'`);

                this.server.db.fileDelete(this.name, filePath).then(() => {
                    this.files[filePath] = null;
                    resolve();

                });

            }, error => reject(error));

        });

    }

    getLine(filePath, lineId) {

        return this.waitFile(filePath, (resolve, reject) => {

            if (this.file === null) return reject("File does not exist.");

            let line = this.file.lines[lineId];

            if (!line) return reject("Line does not exist.");

            resolve({
                line: line.line,
                previous: line.previous,
                next: line.next,
                lineId: lineId
            });

        });

    }

    insert(request, filePath, lineId, column, data) {

        return this.waitFile(filePath, (resolve, reject) => {

            if (this.file === null) return reject("File does not exist.");

            let line = this.file.lines[lineId];

            if (!line) return reject("Line does not exist.");

            line.line = line.line.slice(0, column) + data + line.line.slice(column);

            line.version++; this.file.version++;
            line.updated = this.file.updated = Date.now();

            this.server.db.lineSet(this.name, filePath, lineId, line.line).then(() => resolve());

        });

    }

    erase(request, filePath, lineId, column, deleteCount) {

        return this.waitFile(filePath, (resolve, reject) => {

            if (this.file === null) return reject("File does not exist.");

            let line = this.file.lines[lineId];

            if (!line) return reject("Line does not exist.");

            line.line = line.line.slice(0, column) + line.line.slice(deleteCount + column);

            line.version++; this.file.version++;
            line.updated = this.file.updated = Date.now();

            this.server.db.lineSet(this.name, filePath, lineId, line.line).then(() => resolve());

        });

    }

    split(request, filePath, lineId, column, newLineId) {

        return this.waitFile(filePath, (resolve, reject) => {

            if (this.file === null) return reject("File does not exist.");

            let oldLine = this.file.lines[lineId],
                newLine = this.file.lines[newLineId];

            if (!oldLine) return reject("Line does not exist.");
            if (newLine) return reject("Line already exists.");

            if (column === -1) column = oldLine.line.length;

            newLine = {
                line: oldLine.line.slice(column),
                lineId: newLineId,
                previous: lineId,
                next: oldLine.next,
                version: 0
            };

            this.file.lines[newLineId] = newLine;

            oldLine.line = oldLine.line.slice(0, column);
            oldLine.next = newLineId;

            oldLine.version++; this.file.version += 2;
            oldLine.updated = newLine.updated = this.file.updated = Date.now();

            Promise.all([

                this.server.db.lineSet(this.name, filePath, lineId, oldLine.line, null, newLineId),
                this.server.db.lineSet(this.name, filePath, newLineId, newLine.line, lineId, newLine.next)

            ]).then(() => resolve());

        });

    }

    merge(request, filePath, lineId) {

        return this.waitFile(filePath, (resolve, reject) => {

            if (this.file === null) return reject("File does not exist.");

            let line = this.file.lines[lineId],
                prevLine, nextLine,
                relocate = () => {};

            if (!line) return reject("Line does not exist.");
            if (!line.previous) return reject("Line does not follow another.");

            prevLine = this.file.lines[line.previous];

            prevLine.line += line.line;

            if (line.next) {
                nextLine = this.file.lines[line.next];
                nextLine.previous = prevLine.lineId;
                prevLine.next = nextLine.lineId;

                relocate = this.server.db.lineSet(this.name, filePath, nextLine.lineId, nextLine.previous);

                nextLine.version++; this.file.version++;
                nextLine.updated = Date.now();

            } else prevLine.next = -1;

            prevLine.version++; this.file.version += 2;
            prevLine.updated = this.file.updated = Date.now();

            Promise.all([

                this.server.db.lineSet(this.name, filePath, prevLine.lineId, prevLine.line, null, prevLine.next),
                relocate,
                this.server.db.lineRemove(this.name, filePath, lineId)

            ]).then((/*result*/) => {
                delete this.file.lines[lineId];
                resolve();
            });

        });

    }

    get() {

        this.retrieved = false;

        this.server.db.repoGet(this.name).then(repo => {
            this.db = repo;
            this.emit("retrieve", this);
            this.retrieved = true;
        });

    }

    waitFile(filePath, promiseCallback) {

        return new Promise((resolve, reject) => this.getFile(filePath).then(file => {
            this.file = file;
            new Promise(promiseCallback).then(
                result => resolve(result),
                error => reject(error)
            );
        }, error => reject(error)));

    }

    wait(promiseCallback) {

        if (this.retrieved) return new Promise(promiseCallback);

        return new Promise((resolve, reject) => this.once("retrieve", () => new Promise(promiseCallback).then(
            innerResolve => resolve(innerResolve),
            innerReject => reject(innerReject)
        )));

    }

    log() {

        /*eslint-disable no-console*/
        console.log(...[colors.blue(`[${this.name}]`), ...arguments]);
        /*eslint-enable no-console*/

    }

    error() {

        /*eslint-disable no-console*/
        console.error(...[colors.blue(`[${this.name}]`), ...arguments]);
        /*eslint-enable no-console*/

    }

}

module.exports = Repo;
