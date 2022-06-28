import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { parse, compile, nodes } from "../src/index";

function testFile(file: string) {
    describe(file, function () {
        var input = fs.readFileSync(path.join(__dirname, "grammars", file), "utf8");
        var ast!: nodes.Grammar;
        it("should parse", function () {
            expect(() => (ast = parse(input))).to.not.throw();
        });
        var compiled!: ReturnType<typeof compile>;
        it("should compile", function () {
            if (!ast) return this.skip();
            compiled = compile(ast, {
                targets: ["textmate", "ace"]
            });
            expect(compiled.errors, "expected no errors").to.be.empty;
        });
        // if (compiled?.errors.length > 0) {
        //     console.log(compiled.errors);
        // }
        //TODO: test if the outputs are valid and work as intended
    });
}

describe("Grammars", function () {
    //TODO: glob
    testFile("sample.iro");
    testFile("rion.iro");
    testFile("redlapis.iro");
});

const DEFAULT_CONTEXTS = `\
main : context {
    : pattern {
        regex       \\= \\b(hello world)\\b
        styles []     = .text;
    }
}
`;
const DEFAULT_STYLES = `\
.text : style {
    color              = #DCD16A
    textmate_scope     = string
    pygments_scope     = String
}
`;
function makeTestGrammar(contexts?: string, styles?: string) {
    return `\
name                = example
file_extensions []  = ex;
contexts [] {
${contexts || DEFAULT_CONTEXTS}
}
styles [] {
${styles || DEFAULT_STYLES}
}`;
}

describe("Contexts Collection", function () {
    it("should require context objects to be named", function () {
        const grammar = makeTestGrammar(`\
: context {
	: pattern {
		regex		\\= \\b(hello world)\\b
		styles []	 = .text;
	}
}`);
        var compiled = compile(grammar, {});
        expect(compiled.errors).to.have.lengthOf(1);
        expect(compiled.errors[0].message).to.match(/unnamed context/i);
    });
});

describe("Styles Collection", function () {
    it("should require style objects to be named", function () {
        const grammar = makeTestGrammar(undefined, DEFAULT_STYLES + ": style {\n  color = #DCD16A\n}");
        var compiled = compile(grammar, {});
        // console.log(grammar);
        // console.dir(compiled.ast, { depth: null });
        // compiled.errors.forEach((e) => console.log(prettyError(e, grammar)));
        expect(compiled.errors).to.have.lengthOf(1);
        expect(compiled.errors[0].message).to.match(/unnamed style/i);
    });
});
