import * as nearley from "nearley";
import { compile as _compile, CompileOptions, IroError } from "./compiler";
import { Grammar, SourceLocationPosition } from "./nodes";
import { NearleyError, isNearleyError } from "./utils";

export * as nodes from "./nodes";
export * as compiler from "./compiler";
export * as ScopeManager from "./ScopeManager";
export type { IroError, NearleyError };
export const Rion: nearley.CompiledRules = require("./rion");
export const grammar = nearley.Grammar.fromCompiled(Rion);

//TODO: use handwritten parser
export function getParser() {
    return new nearley.Parser(grammar);
}
export function parse(input: string): Grammar {
    const parser = new nearley.Parser(grammar);
    var r = parser.feed(input).results[0];
    if (!r) {
        throw <NearleyError>{
            message: "Unexpected end of input",
            offset: parser.current,
            token: {
                text: "",
                value: "",
                col: parser.lexerState?.col,
                line: parser.lexerState?.line,
                type: "EOF",
                lineBreaks: 0,
                offset: (parser.lexer as any).index || 0,
            },
        };
    }
    return r;
}
export function compile(
    input: string | Grammar,
    options?: Partial<CompileOptions>
): ReturnType<typeof _compile> {
    var ast: Grammar;
    if (typeof input == "string") {
        var parsed!: import("./nodes").Grammar;
        try {
            parsed = parse(input);
        } catch (e: any) {
            if (!isNearleyError(e)) throw e;

            let lines = input.split("\n");

            if (e.token) {
                // Parser error
                let start: SourceLocationPosition = {
                    column: e.token.col - 1,
                    line: e.token.line,
                    offset: e.token.offset,
                };
                let end: SourceLocationPosition = {
                    column: e.token.col - 1 + e.token.value.length,
                    line: e.token.line,
                    offset: e.token.offset + e.token.value.length,
                };
                return {
                    errors: [
                        {
                            fatal: true,
                            message: `Unexpected ${e.token.type} token '${e.token.value}'`,
                            location: { start, end },
                        },
                    ],
                } as any;
            } else {
                // Lexer error
                let linecol = (e.message as string).match(/invalid syntax at line (\d+) col (\d+):/);
                if (!linecol) linecol = ["0", "1", "1"];
                let loc: SourceLocationPosition = {
                    column: +linecol[2] - 1,
                    line: +linecol[1],
                    offset: e.offset,
                };
                return {
                    errors: [
                        {
                            fatal: true,
                            message: `Unexpected token '${lines[loc.line - 1][loc.column]}'`,
                            location: { start: loc, end: loc },
                        },
                    ],
                } as any;
            }
        }
        ast = parsed;
    } else ast = input;
    var result = _compile(ast, options);
    return result;
}
