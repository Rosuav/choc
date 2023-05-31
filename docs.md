# The Chocolate Factory

## API documentation

### `choc.__version__` - currently-loaded library version

`choc.__version__` is a string consisting of three parts, major/minor/revision,
such as `"1.6.4"`. See [What's New](whatsnew) for details on what changed in
each version.

### `choc` - Construct a DOM element

    element = choc("TAG", attributes, contents);

* `attributes` - optional object mapping attribute names to their desired
  values. If omitted/null/empty, no attributes will be set.
  - Attributes will be set using `element.setAttribute` or by direct assignment
    where this is more suitable.
  - Force an attribute to be set by assignment by prefixing its name with a dot
    eg `{".foo": 42}` to set `element.foo = 42`
  - Force the use of setAttribute (not usually necessary) by prefixing the name
    with an at sign eg `{"@onclick": "hello?"}`
  - Attributes set by assignment are any that begin "on" (event handlers), plus
    the following: `volume`, `value`, `disabled`, `checked`.
  - For convenience, `htmlFor` and `for` have the same effect, as do `class`
    and `className`.
* `contents` - optional collection of children. See `set_content` below.
  Calling `choc("TAG", attr, contents)` is broadly equivalent to calling
  `set_content(choc("TAG", attr), contents)` (but see 'Special Cases' below).

In additional to the above syntax, this notation is also supported:

    element = choc.TAG(attributes, contents);

A destructuring import makes this more convenient:

    const {TAG} = choc;
    element = TAG(attributes, contents);

This is the recommended idiom, and can be managed by use of the chocimport script.

### `DOM` - Locate a DOM element

    element = DOM(selector);

* If precisely one element matches this selector, it is returned.
* If nothing matches, returns `undefined`.
* If multiple elements match, throws an error.

Note that this is very similar - but not identical - to both `document.querySelector`
and jQuery's selection. Their behaviours differ when zero or multiple elements match:

* `document.querySelector` will return the first match, ignoring any others.
* jQuery will always return a collection and then apply changes to them all. This is
  not an error if no elements match, and changes will be applied to no elements.

### `set_content` - Populate a DOM element

    element = set_content(elem_or_sel, contents);

* `elem_or_sel` is either a DOM element or a selector. Passing a selector is
  equivalent to calling `element = set_content(DOM(sel), contents);` but will
  throw if there is no such element.
* `contents` may be any of the following:
  - Any falsy value (`null`, `undefined`, `""`, or `0`) - no content at all
  - Any string or (non-zero) number - the given text. This does not support
    HTML and is thus safe against injection attacks.
  - A `Node` (including an Element as constructed by `choc()`) - moves the
    node from its current location in the document (if any) into here
  - An array of zero or more valid types of content
  - Note that nested arrays are valid, but arrays containing themselves are
    not, and will get your page stuck in an infinite loop :)

### `on` - Respond to DOM events

    idx = on(event, selector, callback, options);

* `event` - name of an event such as `"click"` or `"paste"`
* `selector` - CSS selector to identify matching elements. The elements do
  not have to exist at the time the event handler is established.
* `callback` - JavaScript function to call when the event occurs.
* `options` - normally omit this, but if additional options are needed,
  they can be provided. Not compatible with multiple uses of the same
  event handler.

The event will be attached to the document. Elements rendered in the
document are capable of triggering these events.

Inside the callback, the event object is exactly the one given by the
browser, with one additional attribute:

* `match` - the element which matched the selector

For example, `on("click", ".thing", e => set_content(e.match, "Hi!"));`
will change the contents of the element clicked on, regardless of the
presence of other elements with the same selector.

This is similar to `e.currentTarget` but due to technical limitations,
`currentTarget` will always be `document` during these event handlers.

**NOTE**: Asynchronous event handlers are fully supported; however, as
the event object is not reconstructed for each handler, the `match`
attribute is only available during the initial, synchronous, part of the
function. For example:

    on("click", "button", async e => {
        console.log(e.match); //Works
        await something();
        console.log(e.match); //Is now null
    });

    //the same is true for other forms of asynchronicity:
    on("click", "button", e => {
        console.log(e.match); //Works
        setTimeout(() => {
            console.log(e.match); //Is now null
        }, 1000);
    });

### `fix_dialogs` - Provide extra functionality and compatibility for dialogs

    fix_dialogs({
        close_selector: selector,
        click_outside: false | true | "formless",
    });

Improves support for the `<dialog>` element in browsers that lack it, such as
older versions of Firefox. Regardless of the options provided, this will add
the `showModal` and `close` methods to all dialog elements, with a basic level
of functionality. Additional features can be selected, all are optional:

* `close_selector` - a CSS selector for clickable elements which should cause
  a dialog to be immediately closed. For example, set a CSS class on all your
  close buttons, and quickly and easily close the correct dialog with one
  event handler.
* `click_outside` - if true, clicking outside any dialog (on the shaded
  background where it's blocking access to the rest of the document) will close
  the dialog. If the string `"formless"`, this applies only when the dialog
  doesn't contain a `form` element.

### `lindt` - Construct an element template

    template = lindt("TAG", attributes, contents);

Analogous to choc() but for templated usage.

* Like choc(), can be called with attributes and/or contents omitted.
* Like choc(), can be called as `lindt.TAG(attributes, contents)` and is thus
  suitable for destructuring imports.
* Unlike choc(), contents will not be immediately applied to the element, but
  are retained as part of the template.
* Unlike choc(), does not return an actual DOM element. The resulting template
  can *only* be used with replace_content.
* `lindt` recognizes a special attribute `key` which can guide the template
  matching (see below), and can construct pseudo-element groupings with no tag
  such as `lindt({key: "some_key"}, contents)`. These are equivalent to arrays
  but have keys associated with them.

The `lindt` function is useful only in conjunction with `replace_content`.

### `replace_content` - Apply an element template

    element = replace_content(elem_or_sel, template);

Analogous to set_content() but for templated usage.

* `elem_or_sel` is either a DOM element or a selector. Passing a selector is
  equivalent to calling `element = replace_content(DOM(sel), template);`.
  Passing `null` will coalesce the template into an actual DOM element and
  return it, allowing it to be used in other ways. Note that this requires
  a non-array template.
* `template` may be any of the following:
  - Any falsy value (`null`, `undefined`, `""`, or `0`) - no content at all
  - Any string or (non-zero) number - the given text. This does not support
    HTML and is thus safe against injection attacks.
  - A `Node` (including an Element as constructed by `choc()`) - moves the
    node from its current location in the document (if any) into here
  - A template created by `lindt()`
  - An array of zero or more valid types of content
  - Note that nested arrays are valid, but arrays containing themselves are
    not, and will get your page stuck in an infinite loop :)

When using templates, `replace_content` will attempt to reuse DOM elements
as much as possible. Repeatedly calling `replace_content` on the same element
with similar templates will apply only those changes, keeping other elements
unchanged.

Recommended best practice:

* Aim to match existing elements where appropriate. If matching fails, the old
  element will be discarded and a new one created.
* Be consistent. Arrays can be used anywhere, but an array will never match a
  non-array.
* If elements might be reordered, consider giving each one a unique key. This
  is optional, but if keys are given, they will be used for matching.
* Avoid having multiple arrays next to each other, unless they will ALWAYS be
  present. For optional arrays, use pseudo-elements instead - construct a
  lindt template with no tag, which will behave like an array of elements but
  can be given a key.

### Compatibility features

The five primary functions `choc`, `set_content`, `on`, `DOM`, and `fix_dialogs`
are made available on the window object as pseudo-globals, for the convenience
of non-module code (where an `import` statement is not available). These may
therefore also be used from the browser console.

----
