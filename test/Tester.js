
"use strict";

class Tester {

    constructor(tests, context) {

        this.passed = [];
        this.failed = [];
        this.tests = [];

        this.timer = null;

        this.timeout = 2000;

        for (let item in context)
            this[item] = context[item];

        for (let i = 0; i < tests.length; i++)
            this.tests.push(this.newTest(...tests[i]))

    }

    newTest() {

        return new Test(...arguments);

    }

    start() {

        if (this.tests.length) this.doNextTest();

    }

    doNextTest() {

        if (!this.tests[0].silent) {

            this.tests[0].output = document.createElement("div");
            this.tests[0].output.innerHTML = this.tests[0].message;

            document.body.appendChild(this.tests[0].output);

        }

        this.tests[0].action();

        this.timer = setTimeout(this.timeoutFunc.bind(this), 3000);

    }

    timeoutFunc() {

        this.fail();

        if (this.tests[0]) this.doNextTest();
        else this.printResults();

    }

    fail() {

        let test = this.tests.splice(0, 1)[0];

        if (!test.silent) {
            test.output.innerHTML = "Fail --- " + test.output.innerHTML;
            this.failed.push(test);
        }

    }

    pass() {

        let test = this.tests.splice(0, 1)[0];

        if (!test.silent) {
            test.output.innerHTML = "Pass --- " + test.output.innerHTML;
            this.passed.push(test);
        }

    }

    event(event) {

        clearTimeout(this.timer);

        let pass = this.tests[0].finish(event);

        if (pass === "more") {
            this.timer = setTimeout(this.timeoutFunc.bind(this), this.timeout);
            return;
        }

        if (pass) this.pass();
        else this.fail();

        if (this.tests[0]) this.doNextTest();
        else this.printResults();

    }

    printResults() {

        let total = this.passed.length + this.failed.length,
            percent = (this.passed.length / total * 100).toFixed(2),
            p = document.createElement("p");

        p.textContent = `${this.passed.length}/${total} (${percent}%) tests passed.`;

        document.body.appendChild(p);

    }

}
