"""
Analyze a JavaScript module for Chocolate Factory usage and update an import

Looks for this line:
const {FORM, LABEL, INPUT} = choc; //autoimport

And calls like this:

set_content("main", FORM(LABEL([B("Name: "), INPUT({name: "name"})])))

And it will update the import to add the B.

This is very primitive static analysis and can recognize only a small set of
possible styles of usage:

1) Direct usage, see above. Element name must be all-caps.
2) set_content("main", thing()); function thing() {return FORM(...);}
   - top-level functions only (otherwise has to be defined before use)
3) function update() {stuff = LABEL(INPUT()); set_content("main", stuff)}
   - can handle any assignment within scope including declarations
4) TODO: export function make_content() {return B("hello")}
   - Would require a parameter to say "analyze exported function named X"

Additional idioms to detect:
1) const arr = []; arr.push(LI())
2) const arr = stuff.map(thing => LI(thing.name))
3) elem.appendChild(LI())
4) Top-level set_content calls
"""
import sys
import esprima # ImportError? pip install -r requirements.txt

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
	if sc != "return" and el.id: scopes[-1].setdefault(el.id.name).append(el)
	FunctionExpression(el, scopes, sc)

@element
def BodyDescender(el, scopes, sc):
	"""BlockStatement LabeledStatement WhileStatement DoWhileStatement CatchClause
	ForStatement ForInStatement ForOfStatement"""
	descend(el.body, scopes, sc)

@element
def Ignore(el, scopes, sc):
	"""Literal RegExpLiteral Directive EmptyStatement DebuggerStatement ThrowStatement UpdateExpression
	MemberExpression ImportExpression TemplateExpression ContinueStatement BreakStatement"""
	# I assume that template strings will be used only for strings, not for DOM elements.

@element
def ImportDeclaration(el, scopes, sc):
	pass # Optionally check that Choc Factory has indeed been imported, and skip the file if not?

@element
def Identifier(el, scopes, sc):
	if sc == "set_content":
		while scopes:
			*scopes, scope = scopes
			if el.name in scope:
				defn = scope[el.name]
				scope[el.name] = [] # Only enter it once
				descend(defn, (*scopes, scope), sc)
				break

@element
def Call(el, scopes, sc):
	"""CallExpression NewExpression"""
	descend(el.arguments, scopes, sc) # Assume a function's arguments can be incorporated into its return value
	if el.callee.type == "Identifier": funcname = el.callee.name
	else: return # For now, I'm ignoring any x.y() or x()() or anything
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
				# values as well. This is at most two scans, we'll never do more.
				defn = scope[funcname]
				scope[funcname] = []
				descend(defn, scopes[:1], "return")
				return
		if funcname.isupper():
			print("GOT A CHOC CALL:", el.callee.name)

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
	# Not sure what contexts this would make sense in. Figure it out, then add
	# descend calls accordingly.
	pass

@element
def Unary(el, scopes, sc):
	"""UnaryExpression AwaitExpression SpreadExpression YieldExpression"""
	descend(el.argument, scopes, sc)

@element
def Binary(el, scopes, sc):
	"""BinaryExpression LogicalExpression"""
	descend(el.left, scopes, sc)
	descend(el.right, scopes, sc)

# TODO: Any assignment, add it to the appropriate scope (if declaration, the latest)
# Don't worry about subscoping within a function
# All additions are some_scope.setdefault(name, []).append(el)
@element
def VariableDeclaration(el, scopes, sc):
	for decl in el.declarations:
		if decl.init:
			scopes[-1].setdefault(decl.id.name, []).append(decl.init)

@element
def AssignmentExpression(el, scopes, sc):
	if el.left.type != "Identifier": return
	# Assigning to a simple name stashes the expression in the appropriate scope.
	# NOTE: In some situations, an assignment "further down" than the corresponding set_content
	# call may be missed. This is lexical analysis, not control-flow analysis.
	# Note also that this treats augmented assignment the same as assignment, collecting all
	# relevant expressions together.
	name = el.left.name
	for scope in reversed(scopes):
		if name in scope:
			scope[name].append(el.right)
			return
	# If we didn't find anything to assign to, it's probably landing at top-level. Warn?
	scopes[0][name] = [el.right]

def process(fn):
	with open(fn) as f: data = f.read()
	data = """
	import choc, {set_content, on, DOM} from "https://rosuav.github.io/choc/factory.js";
	const {FORM, LABEL, INPUT} = choc;
	const f1 = () => {HP()}, f2 = () => PRE(), f3 = () => {return B("bold");};
	let f4 = "test";
	function update() {
		let el = FORM(LABEL(["Speak thy mind:", INPUT({name: "thought"})]))
		set_content("main", [el, f1(), f2(), f3(), f4(), f5()])
	}
	f4 = () => DIV(); //Won't be found (violates DBU)
	function f5() {return SPAN();}
	"""
	module = esprima.parseModule(data, {"loc": True})
	global source_lines; source_lines = data.split("\n")
	# First pass: Collect top-level function declarations (the ones that get hoisted)
	scope = { }
	for el in module.body:
		# Anything exported, just look at the base thing
		if el.type in ("ExportNamedDeclaration", "ExportDefaultDeclaration"):
			el = el.declaration
		# function func(x) {y}
		if el.type == "FunctionDeclaration" and el.id: scope[el.id.name] = [el]
	# Second pass: Recursively look for all set_content calls.
	descend(module.body, (scope,), "")

if __name__ == "__main__":
	if len(sys.argv) == 1:
		print("USAGE: python3 %s fn [fn...]", file=sys.stderr)
		print("Will audit Choc Factory imports for those files.")
		# TODO: option to autofix
	for fn in sys.argv[1:]: process(fn)
