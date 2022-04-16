Lindt - Master Chocolatier
==========================

(If you want chocolates you can actually eat, the creations of the
[Lindt & Sprungli company](https://www.lindt-spruengli.com/) are spectacular,
and are what inspired the name of this module.)

Rather than building your chocolates yourself, call on a master chocolatier!
This has overhead, of course, but can offer some hefty benefits. Replace all
use of 'choc' with 'lindt', and of 'set_content' with 'replace_content', and
our craftsmen will assemble chocolate to your exacting specifications.

Here's how you make your own chocolate:

    import {choc, set_content, on, DOM} from "https://rosuav.github.io/choc/factory.js";
    const {FORM, INPUT, LABEL} = choc; //autoimport
    set_content("body", FORM(
        LABEL(["Speak thy mind:", INPUT({name: "thought"})])
    );

Here's how you get a chocolatier to make it for you:

    import {lindt, replace_content, on, DOM} from "https://rosuav.github.io/choc/factory.js";
    const {FORM, INPUT, LABEL} = lindt; //autoimport
    replace_content("body", FORM(
        LABEL(["Speak thy mind:", INPUT({name: "thought"})])
    );

It's that simple! Of course, there are a number of consequences. Here are the
differences between choc/set_content and lindt/replace_content:

* The elements returned by lindt constructors aren't actual DOM elements; they
  are templates that can only be used by replace_content.
* Direct DOM manipulation will cause problems for replace_content; at best, you
  lose the benefits, and at worst, you can have corrupted results. If you use
  replace_content to set an element's content, always and only use replace_content
  for that element.
* For best results, it is sometimes necessary to set a key on lindt elements.
  This is optional but can improve performance. It's completely unnecessary with
  choc/set_content.
* Using set_content with lindt objects won't work. Using replace_content with choc
  objects will work, but without the benefits of lindt.

The key benefit of replace_content is that it will reuse existing DOM elements
rather than construct new ones. This means less flicker, hopefully less CPU load,
and better handling of user changes in inputs and textareas.

Stuff to keep in mind
---------------------

* Whatever array you pass to replace_content, don't mutate it. That's usually
  not a problem, as any array you create will need to be mapped through element
  creation anyway; but mutating this array can cause desynchronization, so don't.
* If your elements can be reordered within their arrays, consider giving them
  key attributes (eg `INPUT({key: "foo"})`) to ensure that they will be properly
  recognized and reused.
* To set a key on an array, use `lindt({key: "..."}, [...])`. This is lightweight
  as arrays always are (there's no corresponding DOM element), but it will be
  recognized by its key, not its position.
* Lindt is designed to do the right thing with minimal guidance, but in some
  cases, it will do more work than necessary. Ensure that variable-length sections
  are in their own arrays for best results (eg by mapping over an array of data to
  form an array of elements).
* Changes to the template get propagated into the DOM, but changes in the DOM are
  ignored. This has a few consequences, particularly with the 'value' attribute of
  an INPUT element:
  - Setting the value on a newly-created input will set its default/initial value
  - Keeping the template unchanged will allow the user to make changes, which are
    not affected by rerendering through replace_content
  - Changing the value in the template will change the input's contents to that value
  - It is NOT possible to query an input, then force it back to its default by
    re-assigning that. To accomplish this, the easiest way is to explicitly set the
    input's value; it may also be possible to trick replace_content into doing this
    for you, but this would be less efficient.
  - Certain special attributes (volume and value) cannot currently be removed from
    an object if they are removed from the template. I consider this to be a flaw,
    but one that's not easy to fix, and easy enough to work around (set them to
    plausible defaults instead of removing them altogether).
  - TEXTAREA and OPTION elements have value attributes that behave the same way. In
    the case of the TEXTAREA, a value attribute takes precedence over contained text
    and behaves as above; contained text is used only as the initial value, and will
    not be updated subsequently.
* Eat some Lindor balls while coding. They're worth it.
