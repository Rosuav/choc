import {choc, replace_content, DOM} from "https://rosuav.github.io/choc/factory.js";
const {} = choc; //autoimport

//Return a bare word if valid, otherwise a quoted string.
//Is deliberately very conservative; some of its quoted strings might be valid identifiers.
function quote_identifier(name) {
	if (/^[A-Za-z_][A-Za-z_0-9]*$/.exec(name)) return name;
	return JSON.stringify(name);
}
//Recursively generate Choc Fac function calls for the given element
function makechoc_contents(elem) {
	const children = [...elem.childNodes].map(ch => makechoc_element(ch))
		.filter(text => text !== "");
	//Skip the array when there's only one element with content in it
	if (children.length < 2) return children[0] || "";
	return ("[\n" +
		children.map(text => "\t" + text.replace(/\n/g, "\n\t") + ",\n").join("")
	+ "]");
}
function makechoc_element(elem) {
	if (elem.nodeType === elem.TEXT_NODE) {
		//Text nodes are returned as string literals. However, empty strings and those containing
		//only whitespace are dropped. TODO: Recognize inline vs block elements, and strip whites
		//around block elements only.
		if (elem.nodeValue.trim() === "") return "";
		return JSON.stringify(elem.nodeValue);
	}
	if (elem.nodeType === elem.ELEMENT_NODE) {
		let text = elem.tagName.toUpperCase() + "(";
		//If there are attributes, include them. Note that, in actual source code, I will often
		//put the attribute block onto its own line, but for this simple translator, keep it inline.
		const contents = makechoc_contents(elem);
		if (elem.attributes.length) {
			text += "{" + [...elem.attributes].map(attr =>
				quote_identifier(attr.name) + ": " + JSON.stringify(attr.value)
			).join(", ") + "}";
			if (contents !== "") text += ", ";
		}
		return text + contents + ")";
	}
	return ""; //Not sure what to do with other types (eg comment nodes).
}

on("submit", "#convert", e => {
	e.preventDefault();
	const html = DOM("#input").value; //Note that this might be XML (eg SVG) but I'll call the variable html still.
	//Autodetect HTML or XML mode; haven't had a problem working this way, but maybe an override
	//would be necessary for some inputs??
	const parser = new DOMParser();
	const doc = parser.parseFromString("<choc>" + html + "</choc>", "text/html");
	const result = doc.querySelector("choc");
	if (!result) {
		const error = doc.querySelector("parsererror");
		if (error) console.error("Got error", error); //TODO: See what they look like, and incorporate content into the output
		DOM("#output").value = "Unable to parse, check input";
		return;
	}
	DOM("#output").value = makechoc_contents(result);
});
