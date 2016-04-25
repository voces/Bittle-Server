
"use strict";

class File {

    constructor(filename, lines, share) {

        this.filename = filename;
        this.lines = lines;
        this.share = share;

    }

    spliceLines(blame, start, deleteCount, lines) {

        this.lines.splice(start, deleteCount, ...lines);

        this.share.broadcast({id: "lines", filename: this.filename, start: start, deleteCount: deleteCount, lines: lines, blame: blame.name});

    }

    spliceLine(blame, lineIndex, start, deleteCount, line) {

        this.lines[lineIndex] = this.lines[lineIndex].slice(0, start) + (line || "") + this.lines[lineIndex].slice(start + deleteCount);

        this.share.broadcast({
            id: "line",
            filename: this.filename,
            lineIndex: lineIndex,
            start: start,
            deleteCount: deleteCount,
            line: line,
            blame: blame.name
        });

    }

}

module.exports = File;
