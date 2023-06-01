# The Chocolate Factory

## Inline SVG

The Chocolate Factory (in basic or templated form) can be used to create inline
SVG images the same way that any other DOM elements are created. There are a few
small differences, however, which result in a change to the way the imports need
to be structured.

Firstly, SVG tag names are *case sensitive*, mostly lower-case, and some SVG
attributes have hyphens in their names. Secondly, all SVG tags must have an XML
namespace specified. Fortunately, both problems can be solved on the import line.

Regular HTML imports can be created thus:

    const {P, B, I} = choc;
    const paragraph = P(["This has ", B("bold"), " and ", I("italic"), " text."]);

SVG images look like this instead:

    const {"svg:circle": CIRCLE, "svg:text": TEXT, "svg:svg": SVG} = choc;
    const doodle = SVG([
        CIRCLE({cx: 50, cy: 50, r: 30, fill: "blue"}),
        TEXT({x: 100, y: 50, "font-size": 30, fill: "red"}, "Hello world"),
    ]);

Note that, as of v1.7.0, this is not well supported by chocimport.js/py.
