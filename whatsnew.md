## Chocolate Factory version history

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
