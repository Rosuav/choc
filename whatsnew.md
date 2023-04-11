## Chocolate Factory version history

### v1.6.1, v1.6.2, v1.6.3

* Bugfix the flicker reduction - catch some instances where it was overeager
  in this optimization, resulting in incorrect display.

### v1.6.0

* Reduce flicker and improve performance in replace_content(). Should™ be
  entirely backward compatible. Lindt mode will now make better use of existing
  DOM elements, and will avoid rebuilding contents where possible.

### v1.5.0

* Attempting to insert a non-Node object into something (with set_content, the
  choc constructor, or any other form) will now raise an error. This is usually
  indicative of a bug anyway, and would most likely have caused a more obscure
  failure.

### v1.4.0

* `replace_content(null, lindt.P())` is now broadly equivalent to `choc.P()`,
  allowing a lindt-based script to turn a template into concrete DOM objects
  for when it won't be replaced into something else. This has no benefit over
  using choc directly.

### v1.3.0

* Calling `e.stopPropagation()` during an on() handler will now correctly
  end the bubbling of the event. While arguably a bugfix, this is potentially
  a feature of a sort, I guess?

### v1.2.0

* Attributes can be specified as `{"@attr": "val"}` or `{".attr": "val"}` to
  force them to use setAttribute or subscript assignment respectively. The
  default behaviour will continue to autodetect.

### v1.1.4

* Support `choc.TAG(42)` as equivalent to `choc.TAG("42")` - it was already
  supported if attributes were given.

### v1.1.3

* Give the same warning on set_content() that choc() and lindt() do when extra
  args are provided.

### v1.1.2

* Handle disabled and checked status through assignment. These could probably
  be done better with proper boolean handling, but they might still need to be
  special cases anyway.

### v1.1.1

* replace_content now accepts a single element rather than requiring an array.

### v1.1.0

* Master chocolatiers are now available to help design your factory! See
  [Lindt mode](lindt) for details.
* To strengthen the similarities between choc mode and lindt mode, it's now
  possible to import choc by name as well as by default. This allows a more
  consistent import command, instead of having choc special-cased. It will
  continue to (also) be the default for the foreseeable future.
* chocimport.py recognizes both lindt and choc as valid imports. It's up to
  you to make sure you use one or the other, or mix them compatibly.
* Constructing a SELECT element with a value should now work - it will fill
  the element with its contents before applying the value.
* As a side effect of some other changes, it's possible to construct a
  TEXTAREA with both child text and a value attribute. For compatibility
  with lindt mode, this is considered a feature, and the value attr wins.

### v1.0.3

* Special case a few more things. I clearly don't know what I'm doing here.

### v1.0.2

* Another patch to fix unintended backward compatibility breakage: names
  beginning with "on" will now create event handlers. This is not recommended
  and it is better to create handlers using on(), but this does work and will
  be maintained.

### v1.0.1

* 1.0 did introduce an unintended backward compatibility break: names like
  `className` used to work, but now `class` is needed. Reinstating compat
  by making `classname` an alias for `class`, and `htmlfor` an alias for
  `for`. Others will be added if they get noticed. Sorry about that!

### v1.0.0

* Very few functional changes, just some cleanups to error handling. This is
  deemed 1.0 as a recognition of the library's stability.
* Removed deprecated chocify() function
* Disconnected from the shed copy, which will remain for a while as an older
  copy of this file
* NOTE: Versions will, moving forward, be tagged in git, and thus accessible
  by URLs such as https://raw.githubusercontent.com/Rosuav/choc/v0.6.1/factory.js
* Removed documentation from core code file into an external Markdown file
* Added an explicit error when attempting to set_content a missing element
  (replacing the obscure "cannot read lastChild of undefined" error)
* Element attributes are now case insensitive. You no longer have to write
  `TD({colSpan: 2})`, it's now fine to write `TD({colspan: 2})`.
* Data attributes that include hyphens are now handled according to the HTML
  spec, instead of causing an error.
* Added a warning if extra args are passed eg `DIV({id}, SPAN(), SPAN())`
* `choc.__version__` will now always contain three parts, `maj.min.rev`.

### v0.6.1

* Last version available at https://rosuav.github.io/shed/chocfactory.js
* set_content now accepts arrays of arrays of elements, nested arbitrarily.

### v0.6

* Added options parameter to event hooks: `on("click", ".spam", e => ..., opt)`
  This allows additional options such as using the capturing phase.

### v0.5

* Added formless mode to fix_dialogs click_outside

### v0.4.x

* [0.4.4] Hack the setting of an input's form attribute so it works
* [0.4.3] Fix handling of click_outside with select elements
* [0.4.2] Improve handling of <form method=dialog>
* [0.4.1] Hack in some <form method=dialog> button handling
* [0.4] Hack in basic handling of <form method=dialog> on Firefox

### v0.3

* Implement a dialog fixer to add basic support for all browsers,
  even those that don't natively handle dialogs properly

### v0.2

* Added the DOM() function to grab a single DOM element by selector
* Tightened up error handling

### v0.1

* Initial release, in several stages all with the same version number.
