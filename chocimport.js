import * as espree from "espree";

const Ctx = {
	reset(fn="-") {
		Ctx.autoimport_line = -1; //If we find "//autoimport" at the end of a line, any declaration surrounding that will be edited.
		Ctx.autoimport_range = null;
		Ctx.got_imports = [];
		Ctx.want_imports = { };
		Ctx.import_source = "choc" //Will be set to "lindt" if the file uses lindt/replace_content
		Ctx.fn = fn;
		Ctx.source_lines = [];
	}
}

const elements = {
	//
};

function descend(el, scopes, sc) {
	if (!el) return;
	if (Array.isArray(el)) {
		el.forEach(el => descend(el, scopes, sc));
		return;
	}
	//Any given element need only be visited once in any particular context
	//Note that a list might have had more appended to it since it was last
	//visited, so this check applies to the elements, not the whole list.
	if (el["choc_visited_" + sc]) return;
	el["choc_visited_" + sc] = true;

	const f = elements[el.type]
	if (f) f(el, scopes, sc)
	else {
		console.warn(`${Ctx.fn}:${el.loc.start.line}: Unknown type: ${el.type}`);
		elements[el.type] = () => 0; //Warn once per type
	}
}

function process(fn, fix=false, extcall=[]) {
	Ctx.reset(fn);
	let data = "";
	if (fn !== "-") data = fs.readFileSync(fn);
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
	descend(module.body, [scope], "");
	//Some exported functions can return DOM elements. It's possible that they've
	//already been scanned, but that's okay, we'll deduplicate in descend().
	/*TODO for (let func of extcall)
		if (scope[func]) descend(scope[func], (scope,), "return")
	descend(exporteds, (scope,), "return");*/
	Ctx.got_imports.sort()
	const want = Object.keys(Ctx.want_imports).sort();
	if (want.join(",") !== Ctx.got_imports.join(",")) {
		console.log(fn);
		/*TODO lose = [x for x in Ctx.got_imports if x not in want]
		gain = [x for x in want if x not in Ctx.got_imports]
		if lose: print("LOSE:", lose)
		if gain: print("GAIN:", gain)*/
		console.log("WANT:", want)
		/*TODO if Ctx.autoimport_range:
			start, end = Ctx.autoimport_range
			data = data[:start] + "const {" + ", ".join(want) + "} = " + Ctx.import_source + ";" + data[end:]
			# Write-back if the user wants it
			if fn == "-": print(data)
			if fix:
				with open(fn, "w") as f:
					f.write(data)*/
	}
}

//TODO: Parse args as per chocimport.py
//For now, quick hack.
process("-");
