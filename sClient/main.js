/*eslint-env browser*/
/*global EventEmitter2, ace, componentHandler*/

// document.on("DOMContentReady", () => {
//
// });

class Bittle extends EventEmitter2 {

    constructor() {
        super();

        this.queue = [];

        this.connect();

        this.echoId = 0;

    }

    connect() {

        this.ws = new WebSocket("wss://notextures.io:8086");

        this.ws.addEventListener("message", e => this.onMessage(e));
        this.ws.addEventListener("close", () => this.disconnected());

    }

    disconnected() {

        // console.log("Disconnected from Bittle, reconnecting...");
        this.connect();

    }

    send(obj, callback) {

        let echo = this.echoId++;

        obj.echo = echo;

        let json = JSON.stringify(obj);

        this.queue.push([echo, json, callback]);

        // console.log("SEND", obj);
        this.ws.send(json);

    }

    onMessage(e) {

        e.json = JSON.parse(e.data);

        // console.log("RECV", e.json);

        if (this.queue.length > 0 && typeof e.json.echo !== "undefined")
            for (let i = 0; i < this.queue.length; i++)
                if (this.queue[i][0] === e.json.echo) {
                    if (this.queue[i][2]) this.queue[i][2](e);
                    this.queue.splice(i, 1);
                }

        this.emit(e.json.id, e);

    }

}

function grabElements(obj, ids) {

    for (let id in ids)
        obj[id] = document.getElementById(ids[id]);

}

function verifyNoneEmpty(element, errorElement, field) {

    if (element.value === undefined || element.value === "") {
        element.parentElement.classList.add("is-invalid");
        errorElement.textContent = field + " is required.";
        return false;
    }

    return true;

}

class Login extends EventEmitter2 {

    ready() {

        grabElements(this, {
            dialog: "login-dialog",
            show1: "show-login-dialog1", show2: "show-login-dialog2",
            name: "login-name", nameError: "login-name-error",
            pass: "login-pass", passError: "login-pass-error",
        });

        this.show1.addEventListener("click", () => this.dialog.showModal());
        this.show2.addEventListener("click", () => this.dialog.showModal());

        this.name.addEventListener("blur", () => this.verifyName());
        this.pass.addEventListener("blur", () => this.verifyPass());

        this.dialog.querySelector(".close").addEventListener("click", () => this.dialog.close());
        this.dialog.querySelector(".login").addEventListener("click", () => this.tryLogin());

    }

    hide() {

        this.show1.hidden = true;
        // this.show1.style.display = "none";
        this.show2.hidden = true;
        // this.show2.style.display = "none";

    }

    verifyName() { return verifyNoneEmpty(this.name, this.nameError, "Name"); }
    verifyPass() { return verifyNoneEmpty(this.pass, this.passError, "Pass"); }

    clear() {

        this.name.value = "";
        this.name.parentElement.classList.remove("is-invalid");
        this.pass.value = "";
        this.pass.parentElement.classList.remove("is-invalid");

    }

    loginHandler(e) {

        if (e.json.status === "failed") {

            switch (e.json.reason) {

                default:
                    this.nameError.textContent = e.json.reason;
                    this.name.parentElement.classList.add("is-invalid");
                    break;

            }

            return;

        }

        this.dialog.close();
        this.emit("loggedIn", this.name.value);

        this.clear();

    }

    tryLogin() {

        if (this.verifyName() + this.verifyPass() < 2) return;

        this.emit("send", {id: "login", name: this.name.value, pass: this.pass.value}, e => this.loginHandler(e));

    }

}

class Register extends EventEmitter2 {

    ready() {

        grabElements(this, {
            dialog: "register-dialog",
            show1: "show-register-dialog1", show2: "show-register-dialog2",
            name: "register-name", nameError: "register-name-error",
            pass: "register-pass", passError: "register-pass-error",
            confirmPass: "register-confirm-pass", passError: "register-confirm-pass-error",
        });

        this.show1.addEventListener("click", () => this.dialog.showModal());
        this.show2.addEventListener("click", () => this.dialog.showModal());

        this.name.addEventListener("blur", () => this.verifyName());
        this.pass.addEventListener("blur", () => this.verifyPass());
        this.confirmPass.addEventListener("blur", () => this.verifyConfirmPass());

        this.dialog.querySelector(".close").addEventListener("click", () => this.dialog.close());

        this.dialog.querySelector(".register").addEventListener("click", () => this.tryRegister());

    }

    hide() {

        this.show1.hidden = true;
        this.show2.hidden = true;

    }

    verifyName() { return verifyNoneEmpty(this.name, this.nameError, "Name"); }
    verifyPass() { return verifyNoneEmpty(this.pass, this.passError, "Pass"); }

    verifyConfirmPass() {

        if (this.pass.value != this.confirmPass.value) {
            this.confirmPass.parentElement.classList.add("is-invalid");
            return false;
        }

        return true;

    }

    clear() {

        this.name.value = "";
        this.name.parentElement.classList.remove("is-invalid");
        this.pass.value = "";
        this.pass.parentElement.classList.remove("is-invalid");
        this.confirmPass.value = "";
        this.confirmPass.parentElement.classList.remove("is-invalid");

    }

    registerHandler(e) {

        if (e.json.status === "failed") {

            switch (e.json.reason) {

                default:
                    this.nameError.textContent = e.json.reason;
                    this.name.parentElement.classList.add("is-invalid");
                    break;

            }

            return;

        }

        this.dialog.close();
        this.emit("send", {id: "login", name: this.name.value, pass: this.pass.value});
        this.emit("loggedIn", this.name.value);

        this.clear();

    }

    tryRegister() {

        if (this.verifyName() + this.verifyPass() + this.verifyConfirmPass() < 3) return;

        this.emit("send", {id: "register", name: this.name.value, pass: this.pass.value}, e => this.registerHandler(e));
        // send(JSON.stringify({id: "register", name: this.name.value, pass: this.pass.value}), e => this.registerHandler(e));

    }

}

class Auth extends EventEmitter2 {

    constructor() {
        super();

        this.login = new Login();
        this.register = new Register();

        this.login.on("send", (json, callback) => this.emit("send", json, callback));
        this.register.on("send", (json, callback) => this.emit("send", json, callback));

        this.login.on("loggedIn", name => this.loggedIn(name));
        this.register.on("loggedIn", name => this.loggedIn(name));

    }

    hide() {

        this.login.hide();
        this.register.hide();

        this.logout1.style.display = "";
        this.logout2.style.display = "";

        this.share1.style.display = "";
        this.share2.style.display = "";

        this.emit("hidden");

    }

    loggedIn(name) {

        this.hide();

        this.name = name;

        this.emit("loggedIn");

    }

    ready() {

        grabElements(this, {
            logout1: "logout1", logout2: "logout2",
            share1: "share1", share2: "share2"
        });

    }

}

class NewEditor extends EventEmitter2 {

    ready() {

        grabElements(this, {
            dialog: "editor-new-dialog",
            filename: "editor-new-filename", filenameError: "editor-new-filename-error"
        });

        this.filename.addEventListener("blur", () => this.verifyFilename());

        this.dialog.querySelector(".close").addEventListener("click", () => this.dialog.close());

        this.dialog.querySelector(".create").addEventListener("click", () => {this.emit("new", this.filename.value); this.dialog.close();});

    }

    verifyFilename() { return verifyNoneEmpty(this.filename, this.filenameError, "Name"); }

}

class Editor extends EventEmitter2 {

    constructor(name) {
        super();

        this.name = name;

        this.a = document.createElement("a");
        this.a.classList.add("mdl-tabs__tab");
        this.a.setAttribute("id", "editors-bar-" + name);
        this.a.setAttribute("href", "#editors-" + name);
        this.a.textContent = name;

        this.editorDiv = document.createElement("div");
        this.editorDiv.classList.add("mdl-tabs__panel");
        this.editorDiv.classList.add("editor");
        this.editorDiv.setAttribute("id", "editors-" + name);

        this.editor = ace.edit(this.editorDiv);

        this.session = this.editor.getSession();
        this.session.setMode("ace/mode/javascript");

        this.editorDiv.addEventListener("click", () => this.editor.resize());

        this.editor.on("change", e => this.processChange(e));

    }

    select() {

        if (document.readyState === "complete") this.a.click();
        else this.emit("domQueue", this.a.click.bind(this.a));

    }

    processChange(e) {

        if (this.ignoreChanges) return;

        // console.log(e);

        if (e.lines.length === 1)

            switch (e.action) {

                case "insert":
                    return this.emit("send", {
                        id: "line",
                        filename: this.name,
                        lineIndex: e.start.row,
                        start: e.start.column,
                        deleteCount: 0,
                        line: e.lines[0]
                    });

                case "remove":
                    return this.emit("send", {
                        id: "line",
                        filename: this.name,
                        lineIndex: e.start.row,
                        start: e.start.column,
                        deleteCount: e.lines[0].length,
                        line: ""
                    });


                default:
                    return console.error("Change not calculated!", e);

            }

        switch (e.action) {

            case "insert":
                return this.emit("send", {
                    id: "lines",
                    filename: this.name,
                    start: e.start.row,
                    deleteCount: e.lines[0].length,
                    lines: this.session.getLines(e.start.row, e.start.row + e.lines.length - 1)
                });

            default:
                return console.error("Change not calculated!", e);

        }

    }

    load(lines) {

        this.ignoreChanges = true;
        this.editor.setValue(lines.join("\n"));
        this.ignoreChanges = false;

        this.editor.clearSelection();

    }

    line(json) {

        let line = this.session.getLine(json.lineIndex);

        this.ignoreChanges = true;
        this.session.replace({
            start: {row: json.lineIndex, column: 0},
            end: {row: json.lineIndex, column: Number.MAX_VALUE}
        }, line.slice(0, json.start) + (json.line || "") + line.slice(json.start + json.deleteCount));
        this.ignoreChanges = false;

    }

    lines(json) {

        this.ignoreChanges = true;
        this.session.replace({
            start: {row: json.start, column: 0},
            end: {row: json.start + json.deleteCount + 1, column: 0}
        }, json.lines.join("\n"));
        this.ignoreChanges = false;

    }

}

class Share extends EventEmitter2 {

    ready() {

        grabElements(this, {
            dialog: "share-dialog",
            share1: "share1", share2: "share2",
            name: "share-name", nameError: "share-name-error"
        });

        this.share1.addEventListener("click", () => this.dialog.showModal());
        this.share2.addEventListener("click", () => this.dialog.showModal());

        this.dialog.querySelector(".close").addEventListener("click", () => this.dialog.close());

        this.dialog.querySelector(".share").addEventListener("click", () => this.tryShare());

    }

    verifyName() { return verifyNoneEmpty(this.name, this.nameError, "Name"); }

    shareHandler(e) {

        if (e.json.status === "failed") {

            switch (e.json.reason) {

                default:
                    this.nameError.textContent = e.json.reason;
                    this.name.parentElement.classList.add("is-invalid");
                    break;

            }

            return;

        }

        this.dialog.close();
        this.emit("share");

    }

    tryShare() {

        if (this.verifyName() < 1) return;

        this.emit("send", {id: "invite", name: this.name.value}, e => this.shareHandler(e));

    }

}

class Editors extends EventEmitter2 {

    constructor() {
        super();

        this.editors = [];
        this.newEditorDialog = new NewEditor();
        this.share = new Share();

        this.newEditorDialog.on("new", e => this.newEditor(e).select());

        this.share.on("send", (json, callback) => this.emit("send", json, callback));
        this.share.on("share", () => this.emit("share"));

    }

    ready() {

        grabElements(this, {
            editorsDiv: "editors",
            editorsBar: "editors-bar", editorsBarNew: "editors-bar-new",
            editorsNew: "editors-new"
        });

        this.editorsBarNew.addEventListener("click", () => this.newEditorDialog.dialog.showModal());

        this.newEditor("untitled").select();

    }

    newEditor(name) {

        let editor = new Editor(name);

        this.editorsBar.insertBefore(editor.a, this.editorsBarNew);
        this.editorsDiv.insertBefore(editor.editorDiv, this.editorsNew);

        if (document.readyState === "complete") this.upgradeElement();
        else this.emit("domQueue", this.upgradeElement.bind(this));

        editor.on("domQueue", func => this.emit("domQueue", func));
        editor.on("send", (json, callback) => this.emit("send", json, callback));

        this.editors.push(editor);

        return editor;

    }

    trackAll() {

        for (let i = 0; i < this.editors.length; i++)
            this.emit("send", {id: "track", filename: this.editors[i].name, lines: this.editors[i].editor.getValue().split("\n")});

    }

    checkFile(file) {

        let flag = false;

        for (let i = 0; i < this.editors.length; i++)
            if (this.editors[i].name === file) {
                flag = true;
                break;
            }

        if (!flag) {
            let editor = this.newEditor(file);
            this.emit("send", {id: "get", filename: file}, e => editor.load(e.json.lines));
        }

    }

    getEditor() {

        let editor = this.a.querySelector(".is-active").textContent;

        for (let i = 0; i < this.editors.length; i++)
            if (this.editors[i].name === editor) return this.editors[i];

    }

    load(files) {

        for (let i = 0; i < this.editors.length; i++) {

            this.editorsBar.removeChild(this.editors[i].a);
            this.editorsDiv.removeChild(this.editors[i].editorDiv);

        }

        this.editors = [];

        for (let i = 0; i < files.length; i++)
            this.checkFile(files[i]);

        this.editors[0].select();

    }

    line(json) {

        for (let i = 0; i < this.editors.length; i++)
            if (this.editors[i].name === json.filename) return this.editors[i].line(json);

    }

    lines(json) {

        for (let i = 0; i < this.editors.length; i++)
            if (this.editors[i].name === json.filename) return this.editors[i].lines(json);

    }

    upgradeElement() {

        componentHandler.downgradeElements(this.editorsDiv);
        componentHandler.upgradeElement(this.editorsDiv);

    }

}

class Navigation extends EventEmitter2 {

    ready() {

        // this.drawer = document.getElementById("nav-drawer");
        this.layout = document.getElementById("layout");

        this.emit("ready");

    }

    collapseDrawer() {

        this.layout.MaterialLayout.toggleDrawer();

    }

    loggedIn() {

        this.layout.MaterialLayout.toggleDrawer();

    }

}

class Invite extends EventEmitter2 {

    ready() {

        this.dialog = document.getElementById("invite-dialog");

        grabElements(this, {
            dialog: "invite-dialog",
            blameSpan: "invite-blame",
            yes: "invite-yes", no: "invite-no"
        });

        this.no.addEventListener("click", () => {this.dialog.close(); this.emit("send", {id: "decline", shareId: this.shareId, blame: this.blame});});
        this.yes.addEventListener("click", () => {this.dialog.close(); this.emit("send", {id: "accept", shareId: this.shareId, blame: this.blame});});

    }

    trigger(shareId, blame) {

        this.shareId = shareId;
        this.blame = blame;

        this.blameSpan.textContent = blame;

        this.dialog.showModal();

    }

}

class Page {

    constructor() {

        this.bittle = new Bittle();
        this.auth = new Auth();
        this.editors = new Editors();
        this.navigation = new Navigation();
        this.invite = new Invite();

        this.domQueue = [];

        // this.auth.on("hidden", () => this.navigation.collapseDrawer());
        this.auth.on("send", (json, callback) => this.bittle.send(json, callback));
        this.auth.on("loggedIn", () => {this.editors.trackAll(); this.navigation.loggedIn();});

        this.editors.on("domQueue", func => this.domQueue.push(func));
        this.editors.on("send", (json, callback) => this.bittle.send(json, callback));
        this.editors.on("share", () => this.navigation.collapseDrawer());

        this.bittle.on("addFile", e => this.editors.checkFile(e.json.filename));
        this.bittle.on("invite", e => typeof e.json.status === "undefined" ? this.invite.trigger(e.json.shareId, e.json.blame) : null);
        this.bittle.on("addClient", e => typeof e.json.files !== "undefined" ? this.editors.load(e.json.files) : null);
        this.bittle.on("line", e => e.json.blame !== this.auth.name ? this.editors.line(e.json) : null);
        this.bittle.on("lines", e => e.json.blame !== this.auth.name ? this.editors.lines(e.json) : null);

        this.navigation.on("ready", () => this.auth.ready());

        this.invite.on("send", (json, callback) => this.bittle.send(json, callback));

        document.addEventListener("DOMContentLoaded", () => {

            for (let i = 0; i < this.domQueue.length; i++)
                this.domQueue[i]();

            this.domQueue = null;

        });

    }

}

let page = new Page();
