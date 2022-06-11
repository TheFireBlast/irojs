import * as fs from "fs";
import { parse, compile, IroError, nodes } from "./index";
import { prettyError } from "./utils";

var input = fs.readFileSync("./test/grammars/test.iro", "utf8");
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
            prettyError(
                {
                    fatal: true,
                    message: "Invalid syntax",
                    location: { start: loc, end: loc },
                },
                lines
            )
        );
    }
}
console.timeEnd("parsing took");
if (!parsingError) {
    fs.mkdirSync("out", { recursive: true });

    fs.writeFileSync("out/ast.json", JSON.stringify(parsed, null, 4), "utf8");

    console.time("compiling took");
    var result = compile(parsed, {
        textmate: true,
        ace: true,
    });
    console.timeEnd("compiling took");

    fs.writeFileSync("out/tmlanguage.json", JSON.stringify(result.textmate, null, 4), "utf8");
    fs.writeFileSync("out/tmlanguage.plist", result.makeTextmateXML(), "utf8");
    fs.writeFileSync("out/ace.json", JSON.stringify(result.ace, null, 4), "utf8");
    fs.writeFileSync("out/ace.js", result.makeAceHighlighter({ spacing: 4 }), "utf8");

    var lines = input.split("\n");
    for (let error of result.errors) {
        console.log(prettyError(error, lines));
    }
}
