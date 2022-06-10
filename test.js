var input = "(a:a(/a)*)({)(()())";

{
    const moo = require("moo");
    const lexer = moo.compile({
        lparen: "(",
        rparen: ")",
        esc: /\\./,
        body: /[^()\\\n]+/,
    });
    lexer.reset(input);
    lexer;
    let tkn;
    while ((tkn = lexer.next())) {
        console.log(tkn.type, tkn.text);
    }
}

{
    let list = [];
    let captures = 1;
    let depth = 0;
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
    console.log(list);
}
