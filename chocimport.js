#!/usr/bin/env node
/*
Analyze a JavaScript module for Chocolate Factory usage and update an import

Looks for this line:
const {FORM, LABEL, INPUT} = choc; //autoimport

And calls like this:

set_content("main", FORM(LABEL([B("Name: "), INPUT({name: "name"})])))

And it will update the import to add the B.

This is very primitive static analysis and can recognize only a small set of
possible styles of usage, but the most common ones:

1) Direct usage, see above. Element name must be all-caps.
2) set_content("main", thing()); function thing() {return FORM(...);}
   - top-level functions only (otherwise has to be defined before use)
3) function update() {stuff = LABEL(INPUT()); set_content("main", stuff)}
   - can handle any assignment within scope including declarations
4) export function make_content() {return B("hello")}
   - Requires "--extcall make_content" to signal that make_content is used thus
   - Parameter not needed if name in all caps:
     export function COMPONENT(x) {return DIV(x.name);}
5) const arr = []; arr.push(LI()); set_content(thing, arr)
6) const arr = stuff.map(thing => LI(thing.name)); set_content(thing, arr)
7) DOM("#foo").appendChild(LI())
   - equivalently before(), after(), append(), insertBefore(), replaceWith()
8) (x => ABBR(x.attr, x.text))(stuff)
9) replace_content in any context where set_content is valid

TODO: Support import aliases and SVG
- Import aliases should be retained when given and not blown away
- SVG() should trigger an import of "svg:svg": SVG
- Anything inside SVG() should trigger an import that's been lowercased
- If pure lowercasing isn't correct, leave it up to the programmer to fix;
  an edited alias import should be supported (that's first prio).
const {"svg:svg": SVG, FOO: BAR} = choc;
*/
import * as espree from "espree";
import fs from "node:fs";

const DOM_ADDITION_METHODS = {appendChild:1, before:1, after:1, append:1, insertBefore:1, replaceWith:1}

const Ctx = {
	reset(fn="-") {
		Ctx.autoimport_line = -1; //If we find "//autoimport" at the end of a line, any declaration surrounding that will be edited.
		Ctx.autoimport_range = null;
		Ctx.got_imports = { };
		Ctx.want_imports = { };
		Ctx.import_source = "choc" //Will be set to "lindt" if the file uses lindt/replace_content
		Ctx.fn = fn;
		Ctx.source_lines = [];
	}
}

function setdefault(obj, key, val) {
	//Like dict.setdefault() in Python
	if (!obj[key]) obj[key] = val;
	return obj[key];
}

const elements = {
	FunctionExpression(el, {scopes, sc, ...state}) {
		if (sc !== "return") sc = ""; //If we're not *calling* the function, then just probe it, don't process its return value
		descend(el.body, {scopes: [...scopes, { }], sc, ...state});
	},

	ArrowFunctionExpression(el, {scopes, sc, ...state}) {
		if (sc === "return" && el.expression) //Braceless arrow functions implicitly return
			descend(el.body, {scopes: [...scopes, { }], sc: "set_content", ...state});
		else elements.FunctionExpression(el, {scopes, sc, ...state});
	},

	FunctionDeclaration(el, {scopes, sc, ...state}) {
		if (sc !== "return" && el.id)
			setdefault(scopes[scopes.length - 1], el.id.name, []).push(el);
		elements.FunctionExpression(el, {scopes, sc, ...state});
	},

	["BlockStatement LabeledStatement WhileStatement DoWhileStatement " +
	"CatchClause ForStatement ForInStatement ForOfStatement"]: (el, state) => {
		descend(el.body, state);
	},

	["Literal RegExpLiteral Directive EmptyStatement DebuggerStatement ThrowStatement UpdateExpression " +
	"ImportExpression TemplateLiteral ContinueStatement BreakStatement ThisExpression ObjectPattern ArrayPattern"]:
		(el, state) => { },

	MemberExpression(el, state) {
		descend(el.object, state);
	},

	["ExportNamedDeclaration ExportDefaultDeclaration"]: (el, state) => {
		descend(el.declaration, state);
	},

	ImportDeclaration(el, state) {
		//Optionally check that Choc Factory has indeed been imported, and skip the file if not?
		descend(el.specifiers, state);
	},

	["ImportSpecifier ImportDefaultSpecifier"]: (el, {scopes}) => {
		//Mark that it's a known variable but don't attach any code to it
		setdefault(scopes[scopes.length - 1], el.local.name, []);
	},

	Identifier(el, {scopes, sc, ...state}) {
		if (sc !== "set_content" && sc !== "return") return;
		scopes = [...scopes]; //We're gonna be mutating.
		while (scopes.length) {
			const f = scopes[scopes.length - 1][el.name];
			if (f) {
				descend(f, {scopes, sc, ...state});
				break;
			}
			//Not in that scope? Move up a scope and keep looking.
			scopes.pop();
		}
	},

	["CallExpression NewExpression"]: (el, {scopes, sc, ...state}) => {
		descend(el.arguments, {scopes, sc, ...state}); //Assume a function's arguments can be incorporated into its return value
		if (el.callee.type === "Identifier") {
			const funcname = el.callee.name;
			if (funcname === "set_content" || funcname === "replace_content") {
				//Alright! We're setting content. First arg is the target, second is the content.
				//Note that we don't validate mismatches of choc/replace_content or lindt/set_content.
				if (el.arguments.length < 2) return; //Huh. Need two args. Whatever.
				descend(el.arguments[1], {scopes, sc: "set_content", ...state});
				if (el.arguments.length > 2) {
					console.warn(`${Ctx.fn}:${el.loc.start.line}: Extra arguments to set_content - did you intend to pass an array?`);
					console.warn(Ctx.source_lines[el.loc.start.line - 1]);
				}
			}
			if (sc === "set_content") {
				scopes = [...scopes]; //We're gonna be mutating.
				while (scopes.length) {
					const f = scopes[scopes.length - 1][funcname];
					if (f) {
						//Descend into the function. It's possible we've already scanned it
						//for actual set_content calls, but now we will scan it for return
						//values as well. (If we've already scanned for return values, this
						//will quickly return.)
						//NOTE: The Python script had scopes[:1] here rather than "all scopes
						//up to and including the one containing this function". I'm not sure
						//what would be correct here, nor how to write a test to probe it.
						descend(f, {scopes, sc: "return", ...state});
						return;
					}
					scopes.pop();
				}
				if (funcname === funcname.toUpperCase()) {
					//SVG elements are special.
					if (funcname === "SVG") Ctx.want_imports[funcname] = '"svg:svg"';
					else Ctx.want_imports[funcname] = funcname;
				}
			}
		}
		else if (el.callee.type === "MemberExpression") {
			const c = el.callee;
			descend(c.object, {scopes, sc: sc === "set_content" ? "return" : sc, ...state}); //"foo(...).spam()" starts out by calling "foo(...)"
			if (c.computed) descend(c.property, {scopes, sc, ...state}); //"foo[x]()" starts out by evaluating x
			else if (DOM_ADDITION_METHODS[c.property.name])
				descend(el.arguments, scopes, "set_content");
			else if (c.property.name === "map")
				//stuff.map(e => ...) is effectively a call to that function.
				descend(el.arguments[0], {scopes, sc: sc === "set_content" ? "return" : sc, ...state});
			else if (c.property.name === "push" || c.property.name === "unshift") {
				//Adding to an array is adding code to the definition of the array.
				//For static analysis, we consider both of these to have multiple code
				//blocks associated with them:
				//let x = []; x.push(P("hi")); x.push(DIV("hi"))
				//let y; if (cond) y = P("hi"); else y = DIV("hi")
				if (c.object.type === "Identifier") {
					const name = c.object.name;
					for (let i = scopes.length - 1; i >= 0; --i)
						if (scopes[i][name]) {
							scopes[i][name].push(el.arguments);
							return;
						}
				}
			}
		}
		else if (el.callee.type === "ArrowFunctionExpression" || el.callee.type === "FunctionExpression") {
			//Function expression, immediately called. Might also be being named.
			descend(el.callee, {scopes, sc: sc === "set_content" ? "return" : sc, ...state});
		}
		//else ; //For now, I'm ignoring any unrecognized x.y() or x()() or anything
	},

	ReturnStatement(el, {sc, ...state}) {
		if (sc === "return") sc = "set_content";
		descend(el.argument, {sc, ...state});
	},

	["ExpressionStatement ChainExpression"]: (el, state) => {
		descend(el.expression, state);
	},

	["IfStatement ConditionalExpression"]: (el, state) => {
		descend(el.consequent, state);
		descend(el.alternate, state);
	},

	SwitchStatement(el, state) {
		descend(el.cases, state);
	},

	SwitchCase(el, state) {
		descend(el.consequent, state);
	},

	TryStatement(el, state) {
		descend(el.block, state);
		descend(el.handler, state);
		descend(el.finalizer, state);
	},

	ArrayExpression(el, state) {
		descend(el.elements, state);
	},

	ObjectExpression(el, state) {
		descend(el.properties, state);
	},

	Property(el, state) {
		descend(el.key, state);
		descend(el.value, state);
	},

	["UnaryExpression AwaitExpression SpreadElement YieldExpression"]: (el, state) => {
		descend(el.argument, state);
	},

	["BinaryExpression LogicalExpression"]: (el, state) => {
		descend(el.left, state);
		descend(el.right, state);
	},

	VariableDeclaration(el, {scopes, ...state}) {
		if (el.loc && el.loc.start.line <= Ctx.autoimport_line && el.loc.end.line >= Ctx.autoimport_line)
			Ctx.autoimport_range = el.range;
		for (let decl of el.declarations) if (decl.init) {
			if (decl.init.type === "Identifier" && {choc:1, lindt:1}[decl.init.name]) {
				//It's the import destructuring line.
				if (decl.id.type !== "ObjectPattern") continue; //Or maybe not destructuring. Whatever, you do you.
				for (let prop of decl.id.properties) {
					if (prop.value.type === "Identifier" && prop.value.name === prop.value.name.toUpperCase()) {
						let source;
						switch (prop.key.type) {
							case "Identifier": source = prop.key.name; break;
							case "Literal": source = prop.key.raw; break;
							default: console.warn("Unrecognized import destructuring type " + prop.key.type);
						}
						Ctx.got_imports[prop.value.name] = source;
					}
				}
				Ctx.import_source = decl.init.name;
				continue;
			}
			//Descend into it, looking for functions; also save it in case it's used later.
			descend(decl.init, {scopes, ...state});
			setdefault(scopes[scopes.length - 1], decl.id.name, []).push(decl.init);
		}
	},

	AssignmentExpression(el, {scopes, sc, ...state}) {
		descend(el.left, {scopes, sc, ...state});
		descend(el.right, {scopes, sc, ...state});
		if (el.left.type !== "Identifier" || sc === "set_content") return;
		/* Assigning to a simple name stashes the expression in the appropriate scope.
		NOTE: In some situations, an assignment "further down" than the corresponding set_content
		call may be missed. This is lexical analysis, not control-flow analysis.
		Note also that this treats augmented assignment the same as assignment, collecting all
		relevant expressions together.
		Note that destructuring assignment will parse the right-hand-side but not stash it.
		It MAY be better to replicate it across all the names.
		*/
		const name = el.left.name;
		for (let i = scopes.length - 1; i >= 0; --i)
			if (scopes[i][name]) {
				scopes[i][name].push(el.right);
				return;
			}
		//If we didn't find anything to assign to, it's probably landing at top-level. Warn?
		scopes[0][name] = [el.right];
	},
};

//Names with spaces in them should be multiplexed. Replace the single entry with one for
//each blank-separated word. (I'd prefer whitespace-separated but whatevs.)
Object.entries(elements).forEach(([k, f]) => {
	if (!k.includes(" ")) return;
	delete elements[k];
	k.split(" ").forEach(type => elements[type] = f);
});

function descend(el, state) {
	if (!el) return;
	if (Array.isArray(el)) {
		el.forEach(el => descend(el, state));
		return;
	}
	//Any given element need only be visited once in any particular context
	//Note that a list might have had more appended to it since it was last
	//visited, so this check applies to the elements, not the whole list.
	if (el["choc_visited_" + state.sc]) return;
	el["choc_visited_" + state.sc] = true;

	const f = elements[el.type]
	if (f) f(el, state)
	else {
		console.warn(`${Ctx.fn}:${el.loc.start.line}: Unknown type: ${el.type}`);
		elements[el.type] = () => 0; //Warn once per type
	}
}

function process(fn, fix=false, extcall=[]) {
	Ctx.reset(fn);
	let data = "";
	if (fn !== "-") data = fs.readFileSync(fn, {encoding: "utf8"});
	else data = `
		import choc, {set_content, on, DOM} from "https://rosuav.github.io/choc/factory.js";
		const {FORM, LABEL, INPUT} = choc; //autoimport
		const {DIV} = choc;
		const f1 = () => {HP()}, f2 = () => PRE(), f3 = () => {return B("bold");};
		let f4 = "test";
		function update() {
			let el = FORM(LABEL(["Speak thy mind:", INPUT({name: "thought"})]))
			set_content("main", [el, f1(), f2(), f3(), f4(), f5()])
		}
		f4 = () => DIV(); //Won't be found (violates DBU)
		function f5() {return SPAN();}
		export function COMPONENT(x) {return FIGURE(x.name);}
		function NONCOMPONENT(x) {return FIGCAPTION(x.name);} //Non-exported won't be detected unless called
	`;
	const module = espree.parse(data, {
		range: true, loc: true,
		ecmaVersion: "latest",
		sourceType: "module",
	});
	const lines = Ctx.source_lines = data.split("\n");
	for (let i = 0; i < lines.length; ++i) {
		if (lines[i].trim().endsWith("autoimport")) {
			Ctx.autoimport_line = i + 1
			break;
		}
	}
	//First pass: Collect top-level function declarations (the ones that get hoisted)
	const scope = { };
	const exporteds = [];
	for (let el of module.body) {
		//Anything exported, just look at the base thing
		const exported = {ExportNamedDeclaration: 1, ExportDefaultDeclaration: 1}[el.type];
		if (exported) {
			el = el.declaration;
			if (!el) continue; //Possibly a reexport or something
		}
		//function func(x) {y}
		if (el.type === "FunctionDeclaration" && el.id) {
			scope[el.id.name] = [el];
			//export function COMPONENT() { }
			if (exported && el.id.name === el.id.name.toUpperCase())
				exporteds.push(el);
		}
	}
	//Second pass: Recursively look for all set_content calls.
	descend(module.body, {scopes: [scope], sc: ""});
	//Some exported functions can return DOM elements. It's possible that they've
	//already been scanned, but that's okay, we'll deduplicate in descend().
	for (let func of extcall)
		if (scope[func]) descend(scope[func], {scopes: [scope], sc: "return"})
	descend(exporteds, {scopes: [scope], sc: "return"});
	const have = Object.keys(Ctx.got_imports).sort();
	const want = Object.keys(Ctx.want_imports).sort();
	if (want.join(",") !== have.join(",")) {
		console.log(fn);
		const lose = have.filter(fn => !Ctx.want_imports[fn]);
		const gain = want.filter(fn => !Ctx.got_imports[fn]);
		if (lose.length) console.log("LOSE: " + lose.join(", "));
		if (gain.length) console.log("GAIN: " + gain.join(", "));
		const wanted = want.map(fn => {
			//If the import previously existed, keep it; otherwise, use what
			//we expect to be wanted based on the function name and context.
			const prev = Ctx.got_imports[fn] || Ctx.want_imports[fn];
			if (prev === fn) return fn; //Common case: just the function name
			return prev + ": " + fn;
		}).join(", ");
		console.log("WANT: " + wanted);
		if (Ctx.autoimport_range) {
			const [start, end] = Ctx.autoimport_range;
			data = data.slice(0, start) + "const {" + wanted + "} = " + Ctx.import_source + ";" + data.slice(end);
			//Write-back if the user wants it
			if (fn === "-") console.log(data);
			if (fix) fs.writeFileSync(fn, data);
		}
	}
}

export function main(argv) {
	let fix = false, extcall = [], files = [];
	argv.forEach(arg => {
		if (arg === "--fix") fix = true;
		else if (arg.startsWith("--extcall="))
			extcall.push(arg.slice("--extcall=".length));
		else if (arg.startsWith("-"))
			console.error("Unrecognized parameter " + arg);
		else files.push(arg);
	});
	files.forEach(fn => process(fn, fix, extcall));
}

//TODO: Guard this with the equivalent of if __name__ == "__main__"
//and then replace the whole fn=="-" thing with actual tests
import {argv} from "node:process";
main(argv.slice(2));
