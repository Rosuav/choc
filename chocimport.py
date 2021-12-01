"""
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
4) TODO: export function make_content() {return B("hello")}
   - Would require a parameter to say "analyze exported function named X"
   - Currently hacked in for render_item() for StilleBot
5) const arr = []; arr.push(LI()); set_content(thing, arr)
6) const arr = stuff.map(thing => LI(thing.name)); set_content(thing, arr)
7) DOM("#foo").appendChild(LI())
"""
import sys
import esprima # ImportError? pip install -r requirements.txt

autoimport_line = -1 # If we find "//autoimport" at the end of a line, any declaration surrounding that will be edited.
autoimport_range = None
got_imports, want_imports = [], set()

elements = { }
def element(f):
	if f.__doc__:
		for name in f.__doc__.split(): elements[name] = f
	else:
		elements[f.__name__] = f
	return f

def descend(el, scopes, sc):
	if not el: return
	if isinstance(el, list):
		for el in el: descend(el, scopes, sc)
		return
	# Any given element need only be visited once in any particular context
	# Note that a list might have had more appended to it since it was last
	# visited, so this check applies to the elements, not the whole list.
	if getattr(el, "choc_visited_" + sc, False): return
	setattr(el, "choc_visited_" + sc, True)

	f = elements.get(el.type)
	if f: f(el, scopes, sc)
	else:
		print("Unknown type:", el.type)
		elements[el.type] = lambda el, scopes, sc: None

# Recursive AST descent handlers
# Each one receives the current element and a tuple of current scopes

# On finding any sort of function, descend into it to probe.
@element
def FunctionExpression(el, scopes, sc):
	if sc != "return": sc = "" # If we're not *calling* the function, then just probe it, don't process its return value
	descend(el.body, scopes + ({ },), sc)

@element
def ArrowFunctionExpression(el, scopes, sc):
	if sc == "return" and el.expression: # Braceless arrow functions implicitly return
		descend(el.body, scopes + ({ },), "set_content")
	else: FunctionExpression(el, scopes, sc)

@element
def FunctionDeclaration(el, scopes, sc):
	if sc != "return" and el.id: scopes[-1].setdefault(el.id.name, []).append(el)
	FunctionExpression(el, scopes, sc)

@element
def BodyDescender(el, scopes, sc):
	"""BlockStatement LabeledStatement WhileStatement DoWhileStatement CatchClause
	ForStatement ForInStatement ForOfStatement"""
	descend(el.body, scopes, sc)

@element
def Ignore(el, scopes, sc):
	"""Literal RegExpLiteral Directive EmptyStatement DebuggerStatement ThrowStatement UpdateExpression
	ImportExpression TemplateLiteral ContinueStatement BreakStatement ThisExpression ObjectPattern"""
	# I assume that template strings will be used only for strings, not for DOM elements.

@element
def MemberExpression(el, scopes, sc):
	descend(el.object, scopes, sc)

@element
def Export(el, scopes, sc):
	"""ExportNamedDeclaration ExportDefaultDeclaration"""
	descend(el.declaration, scopes, sc)

@element
def ImportDeclaration(el, scopes, sc):
	# Optionally check that Choc Factory has indeed been imported, and skip the file if not?
	descend(el.specifiers, scopes, sc)

@element
def ImportSpec(el, scopes, sc):
	"""ImportSpecifier ImportDefaultSpecifier"""
	scopes[-1].setdefault(el.local.name, []) # Mark that it's a known variable but don't attach any code to it

@element
def Identifier(el, scopes, sc):
	if sc in ("set_content", "return"):
		while scopes:
			*scopes, scope = scopes
			if el.name in scope:
				descend(scope[el.name], (*scopes, scope), sc)
				break

@element
def Call(el, scopes, sc):
	"""CallExpression NewExpression"""
	descend(el.arguments, scopes, sc) # Assume a function's arguments can be incorporated into its return value
	if el.callee.type == "Identifier": funcname = el.callee.name
	elif el.callee.type == "MemberExpression":
		c = el.callee
		descend(c.object, scopes, "return" if sc == "set_content" else sc) # "foo(...).spam()" starts out by calling "foo(...)"
		if c.computed: descend(c.property, scopes, sc) # "foo[x]()" starts out by evaluating x
		elif c.property.name == "appendChild": # elem.appendChild counts as DOM work
			descend(el.arguments, scopes, "set_content")
		elif c.property.name == "map":
			# stuff.map(e => ...) is effectively a call to that function.
			if sc == "set_content": sc = "return"
			descend(el.arguments[0], scopes, sc)
		elif c.property.name in ("push", "unshift"):
			# Adding to an array is adding code to the definition of the array.
			# For static analysis, we consider both of these to have multiple code
			# blocks associated with them:
			# let x = []; x.push(P("hi")); x.push(DIV("hi"))
			# let y; if (cond) y = P("hi"); else y = DIV("hi")
			if c.object.type == "Identifier":
				name = c.object.name
				for scope in reversed(scopes):
					if name in scope:
						scope[name].append(el.arguments)
						return
		return
	else: return # For now, I'm ignoring any unrecognized x.y() or x()() or anything
	if funcname == "set_content":
		# Alright! We're setting content. First arg is the target, second is the content.
		if len(el.arguments) < 2: return # Huh. Need two args. Whatever.
		descend(el.arguments[1], scopes, "set_content")
		if len(el.arguments) > 2:
			print("Extra arguments to set_content - did you intend to pass an array?", file=sys.stderr)
			print(source_lines[el.loc.start.line - 1], file=sys.stderr)
	if sc == "set_content":
		for scope in reversed(scopes):
			if funcname in scope:
				# Descend into the function. It's possible we've already scanned it
				# for actual set_content calls, but now we will scan it for return
				# values as well. (If we've already scanned for return values, this
				# will quickly return.)
				descend(scope[funcname], scopes[:1], "return")
				return
		if funcname.isupper():
			want_imports.add(funcname)

@element
def ReturnStatement(el, scopes, sc):
	if sc == "return": sc = "set_content"
	descend(el.argument, scopes, sc)

@element
def ExpressionStatement(el, scopes, sc):
	descend(el.expression, scopes, sc)

@element
def If(el, scopes, sc):
	"""IfStatement ConditionalExpression"""
	descend(el.consequent, scopes, sc)
	descend(el.alternate, scopes, sc)

@element
def SwitchStatement(el, scopes, sc):
	descend(el.cases, scopes, sc)
@element
def SwitchCase(el, scopes, sc):
	descend(el.consequent, scopes, sc)

@element
def TryStatement(el, scopes, sc):
	descend(el.block, scopes, sc)
	descend(el.handler, scopes, sc)
	descend(el.finalizer, scopes, sc)

@element
def ArrayExpression(el, scopes, sc):
	descend(el.elements, scopes, sc)

@element
def ObjectExpression(el, scopes, sc):
	descend(el.properties, scopes, sc)
@element
def Property(el, scopes, sc):
	descend(el.key, scopes, sc)
	descend(el.value, scopes, sc)

@element
def Unary(el, scopes, sc):
	"""UnaryExpression AwaitExpression SpreadElement YieldExpression"""
	descend(el.argument, scopes, sc)

@element
def Binary(el, scopes, sc):
	"""BinaryExpression LogicalExpression"""
	descend(el.left, scopes, sc)
	descend(el.right, scopes, sc)

@element
def VariableDeclaration(el, scopes, sc):
	if el.loc and el.loc.start.line <= autoimport_line and el.loc.end.line >= autoimport_line:
		global autoimport_range; autoimport_range = el.range
	for decl in el.declarations:
		if decl.init:
			if decl.init.type == "Identifier" and decl.init.name == "choc":
				# It's the import destructuring line.
				if decl.id.type != "ObjectPattern": continue # Or maybe not destructuring. Whatever, you do you.
				for prop in decl.id.properties:
					if prop.key.type == "Identifier" and prop.key.name.isupper():
						got_imports.append(prop.key.name)
				continue
			# Descend into it, looking for functions; also save it in case it's used later.
			descend(decl.init, scopes, sc)
			scopes[-1].setdefault(decl.id.name, []).append(decl.init)

@element
def AssignmentExpression(el, scopes, sc):
	descend(el.left, scopes, sc)
	descend(el.right, scopes, sc)
	if el.left.type != "Identifier" or sc == "set_content": return
	# Assigning to a simple name stashes the expression in the appropriate scope.
	# NOTE: In some situations, an assignment "further down" than the corresponding set_content
	# call may be missed. This is lexical analysis, not control-flow analysis.
	# Note also that this treats augmented assignment the same as assignment, collecting all
	# relevant expressions together.
	# Note that destructuring assignment will parse the right-hand-side but not stash it.
	# It MAY be better to replicate it across all the names.
	name = el.left.name
	for scope in reversed(scopes):
		if name in scope:
			scope[name].append(el.right)
			return
	# If we didn't find anything to assign to, it's probably landing at top-level. Warn?
	scopes[0][name] = [el.right]

def process(fn):
	if fn != "-":
		with open(fn) as f: data = f.read()
	else: data = """
	import choc, {set_content, on, DOM} from "https://rosuav.github.io/choc/factory.js";
	const {FORM, LABEL, INPUT} = choc; //autoimport
	const f1 = () => {HP()}, f2 = () => PRE(), f3 = () => {return B("bold");};
	let f4 = "test";
	function update() {
		let el = FORM(LABEL(["Speak thy mind:", INPUT({name: "thought"})]))
		set_content("main", [el, f1(), f2(), f3(), f4(), f5()])
	}
	f4 = () => DIV(); //Won't be found (violates DBU)
	function f5() {return SPAN();}
	"""
	module = esprima.parseModule(data, {"loc": True, "range": True})
	global source_lines; source_lines = data.split("\n")
	for i, line in enumerate(source_lines):
		if line.strip().endswith("autoimport"):
			global autoimport_line; autoimport_line = i + 1
			break
	# First pass: Collect top-level function declarations (the ones that get hoisted)
	scope = { }
	for el in module.body:
		# Anything exported, just look at the base thing
		if el.type in ("ExportNamedDeclaration", "ExportDefaultDeclaration"):
			el = el.declaration
			if not el: continue # Possibly a reexport or something
		# function func(x) {y}
		if el.type == "FunctionDeclaration" and el.id: scope[el.id.name] = [el]
	# Second pass: Recursively look for all set_content calls.
	descend(module.body, (scope,), "")
	# HACK: An exported render_item function returns DOM elements.
	if "render_item" in scope: descend(scope["render_item"], (scope,), "return")
	got_imports.sort()
	want = sorted(want_imports)
	if want != got_imports:
		print(fn)
		print("GOT:", got_imports)
		print("WANT:", want)
		if autoimport_range:
			start, end = autoimport_range
			data = data[:start] + "const {" + ", ".join(want) + "} = choc;" + data[end:]
			print(data)
			# TODO: Write-back if the user wants it

if __name__ == "__main__":
	if len(sys.argv) == 1:
		print("USAGE: python3 %s fn [fn...]", file=sys.stderr)
		print("Will audit Choc Factory imports for those files.")
		# TODO: option to autofix
	for fn in sys.argv[1:]:
		autoimport_line, got_imports, want_imports = -1, [], set()
		process(fn)
