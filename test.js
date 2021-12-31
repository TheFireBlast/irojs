var input = "(a:a(/a)*)({)";

// {
//     const moo = require("moo");
//     const lexer = moo.compile({
//         pareno: /\(/,
//         parenc: /\)/,
//         esc: /\\./,
//         body: /[^()\\\n]+/,
//     });
//     lexer.reset(input);
//     let tkn;
//     while ((tkn = lexer.next())) {
//         console.log(tkn.type);
//     }
// }

{
    var list = [];
    var captures = 1;
    var depth = 0;
    for (let i = 0; i < input.length; i++) {
        let c = input[i];
        if (c == "(") {
            if (depth > 0) captures++;
            depth++;
        }
        if (c == ")") {
            if (depth > 0) depth--;
            if (depth == 0) {
                list.push(captures);
                captures = 1;
            }
        }
    }
    console.log(list)
}
