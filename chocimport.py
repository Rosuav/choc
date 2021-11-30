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

def process(fn):
	with open(fn) as f: data = f.read()
	print(esprima.parseModule(data))

if __name__ == "__main__":
	import sys
	if len(sys.argv) == 1:
		print("USAGE: python3 %s fn [fn...]", file=sys.stderr)
		print("Will audit Choc Factory imports for those files.")
		# TODO: option to autofix
	for fn in sys.argv[1:]: process(fn)
