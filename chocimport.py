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
	"""BlockStatement LabeledStatement WhileStatement DoWhileStatement ForStatement ForInStatement CatchClause"""
	descend(el.body, scopes)

@element
def CallExpression(el, scopes):
	print("Function call!", el)

@element
def ExpressionStatement(el, scopes): descend(el.expression, scopes)

def process(fn):
	with open(fn) as f: data = f.read()
	# module = esprima.parseModule(data)
	module = esprima.parseModule("""
	//import choc, {set_content, on, DOM} from "https://rosuav.github.io/choc/factory.js";
	//const {FORM, LABEL, INPUT} = choc;
	function update() {
		//let el = FORM(LABEL(["Speak thy mind:", INPUT({name: "thought"})]))
		set_content("main", el)
	}
	""")
	# First pass: Collect top-level functions
	functions = { }
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
