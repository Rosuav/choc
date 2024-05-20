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
