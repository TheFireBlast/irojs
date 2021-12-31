@{%
	const moo = require("moo")
	const lexer = moo.states({
		main: {
			sp:      	/[ \t]+/,
			nl:      	{match: /\r?\n/, lineBreaks: true},
			comment: 	/(?:\/\/|\#).*?$/,
			string:  	{match: /"(?:\\["\\]|[^\n"\\])*"/, value: s => s.slice(1, -1)},
			id:      	/[a-zA-Z0-9\._]+/,
			eqarray: 	{match: /\[\s*\]\s*=[ \t]*/, push:"array"},
			eqregex: 	{match: /\\=[ \t]*/, push:"attr"},
			eq:      	{match: /=[ \t]*/, push:"attr"},
			semi:    	";",
			colon:   	":",
			comma:   	",",
			opencur: 	"{",
			closecur:	"}",
			opensq:  	"[",
			closesq: 	"]",
		},
		attr: {
			nl:      	{match: /\r?\n/, lineBreaks: true, pop: 1},
			openref: 	{match: /\$\$\{/, push:"reference"},
			value:   	/.+?(?=\$\$\{|$)/,
		},
		array: {
			nl:      	{match: /\r?\n/, lineBreaks: true, pop: 1},
			sp:      	/[ \t]+/,
			value:   	/[a-zA-Z0-9\._]+/,
			openref: 	{match: "$${", push:"reference"},
			semi:    	{match: ";", pop: 1},
			comma:   	",",
		},
		reference: {
			id:			/[a-zA-Z0-9\._]+/,
			closeref:	{match: "}", pop: 1},
		}
	});
	const _ = (obj, start, end, isLoc = 0) => {
		obj.loc = {
			start: (isLoc & 0b01) ? Object.assign({}, start) : {
				line: start.line,
				column: start.col - 1,
				offset: start.offset
			},
			end: (isLoc & 0b10) ? Object.assign({}, end) : {
				line: end.line,
				column: end.col - 1,
				offset: end.offset + end.text.length
			}
		};
		return obj;
	}
	const last = (arr) => arr ? arr[arr.length - 1] : undefined;
%}

@lexer lexer

main
-> Statements WS:*
   {% ([body]) => _({type:"Grammar", body}, body[0]?.loc.start, last(body)?.loc.end, 3) %}
Statements
-> (WS:* Statement):*
   {% (d) => d[0].map(d=>d[1]).filter(x=>x) %}
Statement
-> (Comment | Collection | Object | BasicAttribute | RegexAttribute | ArrayAttribute) {% (d) => d[0][0] %}
Comment
-> %comment {% () => null %}

Collection
-> Identifier WS:* %opensq WS:* %closesq WS:* Body
   {% (d) => _({type:"Collection",name:d[0],body:d[6].body}, d[0].loc.start, d[6].loc.end, 3) %}
Object
-> (Identifier WS:* {%d=>d[0]%}):? %colon WS:* Identifier WS:* Body
   {% (d) => _({type:"Object",name:d[0],kind:d[3],body:d[5].body,inline:false}, d[0] ? d[0].loc.start : d[1], d[5].loc.end, 2 + +(!!d[0])) %}
|  (Identifier WS:* {%d=>d[0]%}):? %colon WS:* Identifier WS:* String:? WS:* %semi
   {% (d) => _({type:"Object",name:d[0],kind:d[3],body:d[5]?[d[5]]:[],inline:true}, d[0] ? d[0].loc.start : d[1], d[7], +(!!d[0])) %}
Body
-> %opencur Statements WS:* %closecur {% (d) => _({body:d[1]}, d[0], d[3]) %}

BasicAttribute
-> Identifier WS:* %eq Value
   {% (d) => _({type:"BasicAttribute",name:d[0],value:d[3]}, d[0].loc.start, d[3].loc.end, 3) %}
# |  Identifier WS:* %eq String %semi
#    {% (d) => _({type:"BasicAttribute",name:d[0],value:d[3]}, d[0].loc.start, d[3].loc.end, 3) %}
# |  Identifier WS:* %eq String
#    {% (d) => _({type:"BasicAttribute",name:d[0],value:d[3]}, d[0].loc.start, d[3].loc.end, 3) %}
RegexAttribute
-> Identifier WS:* %eqregex Value
   {% (d) => _({type:"RegexAttribute",name:d[0],value:d[3]}, d[0].loc.start, d[3].loc.end, 3) %}
ArrayAttribute
-> Identifier WS:* %eqarray %sp:? Value (%sp:? %comma %sp:? Value {%d=>d[3]%}):* %semi
   {% (d) => _({type:"ArrayAttribute",name:d[0],value:[d[4],d[5]].flat(3)}, d[0].loc.start, d[6], 1) %}

Value
-> (ValueElement | Reference):+
   {% (d) => _({type:"Value",value:d[0].flat(1)}, d[0][0][0].loc.start, last(d[0])[0].loc.end, 3) %}
ValueElement -> %value {% (d) => _({type:"ValueElement",value:d[0].toString()}, d[0], d[0]) %}
Reference -> %openref Identifier %closeref {% (d) => _({type:"Reference",name:d[1]}, d[0], d[2]) %}
Identifier -> %id {% (d) => _({type:"Identifier",name:d[0].toString()}, d[0], d[0]) %}
String -> %string {% (d) => _({type:"String",value:d[0].toString()}, d[0], d[0]) %}

WS -> (%nl | %sp) {% () => null %}