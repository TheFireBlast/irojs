import * as fs from "fs";
import { parse, compile, IroError, nodes, getParser } from "./index";
import * as chalk from "chalk";

interface NearleyError {
    message: string;
    offset: number;
    token?: moo.Token;
}

function isNearleyError(err: any): err is NearleyError {
    return err && err.message && typeof err.offset == "number";
}

//TODO: multiple targets?
var target = process.argv[2];

var input = fs.readFileSync(target, "utf8");
fs.mkdirSync("out", { recursive: true });

console.time("Compiling");
var start = process.hrtime();
var result = compile(input);
var took = (process.hrtime(start)[1] / 1e6).toFixed(3) + " ms";

if (result.ast) fs.writeFileSync("out/ast.json", JSON.stringify(result.ast, null, 4), "utf8");
if (result.textmate) {
    fs.writeFileSync("out/tmlanguage.json", JSON.stringify(result.textmate, null, 4), "utf8");
    fs.writeFileSync("out/tmlanguage.plist", result.makeTextmateXML(), "utf8");
    fs.writeFileSync("out/ace.json", JSON.stringify(result.ace, null, 4), "utf8");
    fs.writeFileSync("out/ace.js", result.makeAceHighlighter({ spacing: 4 }), "utf8");
}

var lines = input.split("\n");
for (let error of result.errors) {
    console.log(prettyError(error, lines, target));
}
if (result.errors.find((e) => e.fatal)) {
    console.log("\n" + chalk.red("Failed to compile"));
} else {
    console.log("\n" + "Compiled successfully in " + took);
}

function prettyError(error: IroError, code: string | string[], filePath?: string) {
    if (typeof code == "string") code = code.split("\n");
    var color = chalk[error.fatal ? "red" : "yellow"];
    var {
        location: { start: s, end: e },
    } = error;
    var chunk = code.slice(s.line - 1, e.line).join("\n");
    var length = Math.max(0, e.offset - s.offset);
    var line = chunk.split("\n")[0];
    var lineNumber = s.line.toString().padStart(2, "0");
    var len = Math.max(0, Math.min(line.length - s.column, length));
    var tabCorrectionPre = (line.slice(0, s.column).match(/\t/g) || []).length;
    len += (line.slice(s.column, s.column + len).match(/\t/g) || []).length;
    var offset = s.column + tabCorrectionPre;
    var where = filePath
        ? `${chalk.blue(filePath)}:${chalk.yellow(error.location.start.line)}:${chalk.yellow(
              error.location.start.column + 1
          )} - `
        : "";
    return `${where}${color(error.fatal ? "error" : "warning")}: ${error.message}
${chalk.inverse(lineNumber)} ${line.replace(/\t/g, "  ")}
${chalk.inverse(" ".repeat(lineNumber.length))} ${" ".repeat(offset)}${color("^" + "~".repeat(Math.max(0, len - 1)))}`;
}
