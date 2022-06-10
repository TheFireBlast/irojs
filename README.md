<center><h1>Iro.js</h1></center>
<center>A language grammar generator for syntax highlighters.</center>
<br>

<!-- Check out the live editor at https://fireblast.js.org/irojs -->

# Installation

```
npm install irojs
```

# Usage

## CLI

Basic syntax
```
iro compile <source> --targets=<targetlist>
```

Valid output targets:
- `textmate` or `tm`
    - `textmate.xml` (default)
    - `textmate.json`
- `ace`
    - `ace.js` (default)
    - `ace.json`
- `ast` (outputs the rion ast)
- `none`

Use `<target>.*` to match all extensions

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

var result = iro.compile(myGrammar, { textmate: true });

console.log(result.textmate);
```

# Development

<!-- Use `pnpm test` to run the tests. -->

Use `pnpm build` to build the package.

Use `pnpm types` to compile the type definition files.