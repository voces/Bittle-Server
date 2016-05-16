
"use strict";

const nodemailer = require("nodemailer");

class Mailer {

    constructor(name, service, user, pass) {

        this.name = name;
        this.from = user;

        this.transporter = nodemailer.createTransport({
            service: service,
            auth: {
                user: user,
                pass: pass
            }
        });

    }

    send(to, subject, text, html) {

        return new Promise((resolve, reject) => {

            this.transporter.sendMail({
                from: `${this.name} <${this.from}>`,
                to: to,
                subject: subject,
                text: text,
                html: html

            }, (err, success) => {

                if (err) return reject(err);
                
                resolve(success);

            });

        });

    }

}

let mailer = new Mailer("Bittle", "Gmail", process.env.NODEMAILER_USER, process.env.NODEMAILER_PASS);

module.exports = mailer.send.bind(mailer);
