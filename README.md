<center><h1>Iro.js</h1></center>
<center>A grammar generator for syntax highlighters.</center>
<br>

This project aims to be a superset of Chris Ainsley's [Iro](https://eeyo.io/iro/), a development tool designed to simplify the creation of syntax highlighters.

<!-- Check out the live editor at https://fireblast.js.org/irojs -->

# Installation

```
npm install irojs
```

# Usage

## From the command line

Basic syntax:
```
iro compile <source> --targets=<targetlist>
```

Available targets:
- `textmate` or `tm`
    - `textmate.xml` *(default)*
    - `textmate.json`
- `ace`
    - `ace.js` *(default)*
    - `ace.json`
- `ast` &mdash; outputs the rion ast
- `all` or `*` &mdash; matches all targets
- `none` &mdash; only checks grammar

Use `<target>.*` to match all extensions.

Example:
```
iro compile mygrammar.iro --targets=textmate,ace -o out/
```

## From code

<!-- TODO: documentation -->

Example:
```js
import * as iro from "irojs";
// or
const iro = require("irojs");

const myGrammar = "...";

var result = iro.compile(myGrammar, { targets: ["textmate"] });

console.log(result.textmate);
```

# Language Documentation

The documentation is still a WIP. In the meanwhile, you can access the original docs at https://web.archive.org/web/20191007073218/https://eeyo.io/iro/documentation/index.html

# Development

<!-- `pnpm test` -> runs all tests. -->

`pnpm build` &rarr; builds the package.

`pnpm build:swc` &rarr; compiles the typescript source.

`pnpm build:rion` &rarr; compiles the rion grammar.

`pnpm build:type` &rarr; generates the type definition files.

## Roadmap

- Online editor
- VSCode extension (language server)
- Styles to CSS
- HighlightJS target
- PrismJS target
- CodeMirror target