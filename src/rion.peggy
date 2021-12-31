{
  function $(obj) {
    obj.location = location();
    return obj;
  }
}

Grammar
= body:Statements
  {return $({type:"Grammar", body})}
Statements
= ss:(SP* @Statement)*
  {return ss.filter(x=>x)}
Statement
= Comment / Collection / Object / Attribute / NL SP* {return null}
Comment
= ("#"/"//") [^\r\n]* EOL {return null}

Collection "Collection"
= name:Identifier? WS "[" WS "]" WS body:Body
  {return $({type:"Collection", name, body})}

Object "Object"
= name:Identifier? WS ":" WS kind:Identifier WS body:Body
  {return $({type:"Object", name, kind, body})}
/ name:Identifier? WS ":" WS kind:Identifier WS body:String? WS ";"
  {return $({type:"Object", name, kind, body})}

Attribute "Attribute"
= name:Identifier WS "\\=" SP* value:$([^\r\n]*) SP* EOL
  {return $({type:"RegexAttribute", name, value})}
/ name:Identifier WS "[" WS "]" WS "=" SP* value:Array SP* ";" SP* EOL
  {return $({type:"ArrayAttribute", name, value})}
/ name:Identifier WS "=" SP* value:$([^\r\n]*) SP* EOL
  {return $({type:"BasicAttribute", name, value})}
Array
= v0:ArrayValue vv:(SP* "," SP* @ArrayValue)*
  {return [v0, vv].flat(1)}
ArrayValue
= [a-z.]i[^,;\r\n]*
  {return text();}
Body
= "{" WS @Statements WS "}"

Identifier
= [a-z0-9_\.]i+
  {return $({type:"Identifier", name:text()})}
String
= '"' value:[^"]* '"' {return $({type:"String", value})}
/ "'" value:[^']* "'" {return $({type:"String", value})} //NOTE: this is not supported in the original
//NUMBER = [1-9][0-9]* {return text()}

WS = [ \t\n\r]*
NL = ('\r\n' / '\n' / '\r')
SP = [ \t]
EOF = !.
EOL = NL / EOF