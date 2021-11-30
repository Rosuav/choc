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
2) function thing() {return FORM(...);} set_content("main", thing());
   - top-level functions only
3) function update() {stuff = LABEL(INPUT()); set_content("main", stuff)}
   - can handle any assignment within the same function including declarations
4) TODO: export function make_content() {return B("hello")}
   - Would require a parameter to say "analyze exported function named X"

"""

import esprima # ImportError? pip install -r requirements.txt

elements = { }
def element(f):
	if f.__doc__:
		for name in f.__doc__.split(): elements[name] = f
	else:
		elements[f.__name__] = f
	return f

def descend(el, scopes):
	if not el: return
	if isinstance(el, list):
		for el in el: descend(el, scopes)
		return
	f = elements.get(el.type)
	if f: f(el, scopes)
	else:
		print("Unknown type:", el.type)
		elements[el.type] = lambda el, scopes: None

# Recursive AST descent handlers
# Each one receives the current element and a tuple of current scopes

@element
def NewScope(el, scopes):
	"""Program FunctionDeclaration ArrowFunctionExpression FunctionExpression"""
	descend(el.body, scopes + ({ },))

@element
def BodyDescender(el, scopes):
	"""BlockStatement LabeledStatement WhileStatement DoWhileStatement CatchClause
	ForStatement ForInStatement ForOfStatement"""
	descend(el.body, scopes)

@element
def Ignore(el, scopes):
	"""Literal RegExpLiteral Directive EmptyStatement DebuggerStatement ThrowStatement UpdateExpression
	MemberExpression ImportExpression TemplateExpression"""
	# I assume that template strings will be used only for strings, not for DOM elements.

@element
def ImportDeclaration(el, scopes):
	pass # Optionally check that Choc Factory has indeed been imported, and skip the file if not?

@element
def Identifier(el, scopes):
	if "set_content" in scopes:
		while scopes:
			*scopes, scope = scopes
			if scope == "set_content": continue
			if el.name in scope:
				defn = scope[el.name]
				scope[el.name] = [] # Only enter it once
				descend(defn, (*scopes, scope, "set_content"))
				break

@element
def CallExpression(el, scopes):
	descend(el.arguments, scopes)
	if el.callee.type == "Identifier": funcname = el.callee.name
	else: return # For now, I'm ignoring any x.y() or x()() or anything
	if funcname == "set_content":
		# Alright! We're setting content. First arg is the target, second is the content.
		if len(el.arguments) < 2: return # Huh. Need two args. Whatever.
		descend(el.arguments[1], scopes + ("set_content",))
		if len(el.arguments) > 2:
			print("Extra arguments to set_content - did you intend to pass an array?", file=sys.stderr)
			print(source_lines[el.loc.start.line - 1])
	if "set_content" in scopes:
		if funcname.isupper():
			print("GOT A CHOC CALL:", el.callee.name)
		if funcname in functions:
			# Descend into the function (but only once, since this is static
			# analysis). Note that the current scopes do NOT apply - we use the
			# top-level scope only, since functions in this mapping are top-levels.
			descend(functions.pop(funcname), (scopes[0], "set_content"))

@element
def ExpressionStatement(el, scopes): descend(el.expression, scopes)

@element
def If(el, scopes):
	"""IfStatement ConditionalExpression"""
	descend(el.consequent, scopes)
	descend(el.alternate, scopes)

@element
def SwitchStatement(el, scopes):
	descend(el.cases, scopes)
@element
def SwitchCase(el, scopes):
	descend(el.consequent, scopes)

@element
def TryStatement(el, scopes):
	descend(el.block, scopes)
	descend(el.handler, scopes)
	descend(el.finalizer, scopes)

@element
def ArrayExpression(el, scopes):
	descend(el.elements, scopes)

@element
def ObjectExpression(el, scopes):
	# Not sure what contexts this would make sense in. Figure it out, then add
	# descend calls accordingly.
	pass

@element
def Unary(el, scopes):
	"""UnaryExpression AwaitExpression SpreadExpression YieldExpression"""
	descend(el.argument, scopes)

@element
def Binary(el, scopes):
	"""BinaryExpression LogicalExpression"""
	descend(el.left, scopes)
	descend(el.right, scopes)

# TODO: Any assignment, add it to the appropriate scope (if declaration, the latest)
# Don't worry about subscoping within a function
# All additions are some_scope.setdefault(name, []).append(el)
@element
def VariableDeclaration(el, scopes):
	for scope in reversed(scopes):
		if scope != "set_content": break
	else: return # uhh shouldn't happen, the top level should always be a real scope
	for decl in el.declarations:
		if decl.init:
			scope.setdefault(decl.id.name, []).append(decl.init)

@element
def AssignmentExpression(el, scopes):
	for scope in reversed(scopes):
		if scope != "set_content": break
	else: return # uhh shouldn't happen, the top level should always be a real scope
	print("Assigning to", el.left)
	# As per declarations

def process(fn):
	with open(fn) as f: data = f.read()
	data = """
	import choc, {set_content, on, DOM} from "https://rosuav.github.io/choc/factory.js";
	const {FORM, LABEL, INPUT} = choc;
	function update() {
		let el = FORM(LABEL(["Speak thy mind:", INPUT({name: "thought"})]))
		set_content("main", el)
	}
	"""
	module = esprima.parseModule(data, {"loc": True})
	global source_lines; source_lines = data.split("\n")
	# First pass: Collect top-level functions
	global functions; functions = { }
	for el in module.body:
		# Anything exported, just look at the base thing
		if el.type in ("ExportNamedDeclaration", "ExportDefaultDeclaration"):
			el = el.declaration

		# function func(x) {y}
		if el.type == "FunctionDeclaration": functions[el.id.name] = el
		# const func = x => y
		# const func = function (x) {y}
		if el.type == "VariableDeclaration":
			for decl in el.declarations:
				if decl.init and decl.init.type in ("ArrowFunctionExpression", "FunctionExpression"):
					functions[decl.id.name] = decl.init
		# Note that reassigning to a variable won't trigger this currently.
	# Second pass: Recursively look for all set_content calls.
	descend(module, ())

if __name__ == "__main__":
	import sys
	if len(sys.argv) == 1:
		print("USAGE: python3 %s fn [fn...]", file=sys.stderr)
		print("Will audit Choc Factory imports for those files.")
		# TODO: option to autofix
	for fn in sys.argv[1:]: process(fn)
