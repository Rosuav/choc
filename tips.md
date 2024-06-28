# Tips for Chocholate Factory and Lindt

## Quirky DOM elements

### SELECT

When a `<select>` element has a `value` attribute, if one of the `<option>`s matches that value, it
will display as selected. Due to browser quirks, this value must be set _after_ options
have been added. Since `set_content` returns its target element, the value can be set
afterward by chaining:

```
set_content(DOM("#selectelem"), [OPTION(...), OPTION(...)]).value = some_val;
```

## Converting existing HTML and SVG

Take advantage of a [quick conversion tool](convert.html) to do the bulk of the work. Some formatting
may want to be adjusted, and the necessary imports will need to be added (eg using autoimport), but
the majority of the translation should work correctly.

Suitable for HTML snippets, SVG images, and probably most other XML documents.
