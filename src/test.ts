import * as fs from "fs";
import { parse, compile, IroError, nodes } from "./index";

var input = fs.readFileSync("./test/test.iro", "utf8");
var parsingError = false;
console.time("parsing took");
try {
    var parsed = parse(input);
} catch (e: any) {
    console.log(e.message);
    parsingError = true;
    let lines = input.split("\n");
    let linecol = (e.message as string).match(/invalid syntax at line (\d+) col (\d+):/);
    if (linecol) {
        let loc: nodes.SourceLocationPosition = {
            column: +linecol[2] - 1,
            line: +linecol[1],
            offset: e.offset,
        };
        console.log(
            prettyError(lines, {
                fatal: true,
                message: "Invalid syntax",
                location: { start: loc, end: loc },
            })
        );
    }
}
console.timeEnd("parsing took");
if (!parsingError) {
    fs.mkdirSync("out", { recursive: true });

    fs.writeFileSync("out/ast.json", JSON.stringify(parsed, null, 4), "utf8");

    console.time("compiling took");
    var result = compile(parsed);
    console.timeEnd("compiling took");

    fs.writeFileSync("out/tmlanguage.json", JSON.stringify(result.textmate, null, 4), "utf8");
    fs.writeFileSync("out/tmlanguage.plist", result.makeTextmateXML(), "utf8");
    fs.writeFileSync("out/ace.json", JSON.stringify(result.ace, null, 4), "utf8");
    fs.writeFileSync("out/ace.js", result.makeAceHighlighter({ spacing: 4 }), "utf8");

    var lines = input.split("\n");
    for (let error of result.errors) {
        console.log(prettyError(lines, error));
    }
}

// function prettyHighlight(pre: string, err: string, post: string) {
//     return pre + chalk.red.underline(err) + post;
// }
function prettyError(
    code: string | string[],
    error: IroError,
    highlight?: (pre: string, err: string, post: string) => string
) {
    if (typeof code == "string") code = code.split("\n");
    var output = `error: ${error.message}\n`;
    var {
        location: { start, end },
    } = error;
    var chunk = code.slice(start.line - 1, end.line).join("\n");
    var length = Math.max(0, end.offset - start.offset);
    var startOffset = start.column;
    var highlighted = highlight
        ? highlight(
              chunk.slice(0, startOffset),
              chunk.substr(startOffset, length),
              chunk.slice(startOffset + length)
          ).split("\n")
        : chunk;
    var ln = start.line;
    for (let l of highlighted) {
        output += (ln++).toString().padStart(2, "0") + " " + l + "\n";
        output += " ".repeat(startOffset + 3) + "^" + "~".repeat(Math.max(0, length - 1)) + "\n"; //TODO: multiline
    }
    // ${" ".repeat(col + start.line.toString().length + 1)}^${"~".repeat(length)}`);
    return output;
}

// (function wait() {
//     setTimeout(wait, 1000);
// })();
