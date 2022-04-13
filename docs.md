# The Chocolate Factory

## Basic usage

Using the Chocolate Factory in a module script is easy:

    import choc, {set_content, on, DOM} from "https://rosuav.github.io/choc/factory.js";
    const {FORM, INPUT, LABEL} = choc; //autoimport
    set_content("body", FORM(
        LABEL(["Speak thy mind:", INPUT({name: "thought"})])
    );



Can also be used in HTML:

    <script type=module src="https://rosuav.github.io/choc/factory.js"></script>
    <script defer src="/path/to/your/script.js"></script>

Once imported, the chocolate factory can be used in a number of ways:
* `TAG(attr, contents)` // recommended (requires second line of import)
* `choc.TAG(attr, contents)` // also supported (does not require destructuring)
* `choc("TAG", attr, contents)` // suitable for dynamic tag selection

Regardless of how it's called, choc will return a newly-created element with
the given tag, attributes, and contents. Both attributes and contents are
optional, but if both are given, must be in that order.

To replace the contents of a DOM element:
    set_content(element, contents);
The element can be either an actual DOM element or a selector. The contents
can be a DOM element (eg created by choc() above), or a text string, or an
array of elements, strings, and arrays. Text strings will NOT be interpreted
as HTML, and thus can safely contain untrusted content. Note that this will
update a single element only, and will raise an error if multiple elements
(or no elements) match.

Hooking events can be done by selector. Internally this attaches the event
to the document, so dynamically-created objects can still respond to events.
    on("click", ".some-class", e => {console.log("Hello");});
To distinguish between multiple objects that potentially match, e.match
will be set to the object that received the event. (This is distinct from
e.target and e.currentTarget.) NOTE: e.match is wiped after the event
handler returns. For asynchronous use, capture it in a variable first.
Additional options can be set with another argument, eg passing true to have
the event handler attached to the capturing phase instead. Important for some
types of events, irrelevant for others.

For other manipulations of DOM objects, start by locating one by its selector:
    DOM('input[name="thought"]').value = "..."
This is like document.querySelector(), but ensures that there is only one
matching element, thus avoiding the risk of catching the wrong one. (It's also
shorter. Way shorter.)

## Extra tricks

If you use the <dialog> tag, consider fix_dialogs(). It adds basic support to
browsers which lack it, and can optionally provide automatic behaviour for
close buttons and/or clicking outside the dialog to close it.
    import choc, {set_content, on, DOM, fix_dialogs} from "https://rosuav.github.io/choc/factory.js";
    fix_dialogs({close_selector: "button.close,input[type=submit]"});
    fix_dialogs({click_outside: true});
    //Clicking outside dialogs closes them, but only if there is
    //no <form> inside the <dialog>. Guards against accidental closings.
    fix_dialogs({click_outside: "formless"});

---

Choc Factory does not cache elements or attempt to minimize flicker. Where this
would be a problem, consider this notation:

    [
        ...
        DOM("#thing") || DIV({id: "thing"}, ...)
        ...
    ]

If the element exists, it will be reused, otherwise it will be seamlessly recreated.
