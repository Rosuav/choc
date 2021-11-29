import esprima # ImportError? pip install -r requirements.txt

def process(fn):
	with open(fn) as f: data = f.read()

if __name__ == "__main__":
	import sys
	if len(sys.argv) == 1:
		print("USAGE: python3 %s fn [fn...]", file=sys.stderr)
		print("Will audit Choc Factory imports for those files.")
		# TODO: option to autofix
	for fn in sys.argv[1:]: process(fn)
