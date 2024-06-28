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
/* Example SVGs from https://www.reshot.com/free-svg-icons/item/next-R53XN6VMYT/ https://www.reshot.com/free-svg-icons/item/right-arrow-9NWDR8GZ2P/
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" xml:space="preserve">
	<path fill="#6E83B7" d="M502 256 302 106v80H146v140h156v80zM78 186h40v140H78zM10 186h40v140H10z"/>
</svg>

<svg data-name="01-Next" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
	<path style="fill:#1c69a1" d="m1 1 20 31L1 63v-7l15-24L1 9V1z"/>
	<path style="fill:#fa5f07" d="m27 1 20 31-20 31v-7l15-24L27 9V1z"/>
	<path style="fill:#2483c6" d="m16 1 21 31-19 31H1l20-31L1 1h15z"/>
	<path style="fill:#fab503" d="m42 1 21 31-19 31H27l20-31L27 1h15z"/>
	<path style="fill:#2483c6" d="M1 1v8l15 23h5L1 1z"/>
	<path style="fill:#fd9c04" d="M27 1v8l15 23h5L27 1z"/>
	<path style="fill:#6bdcff" d="m1 1 20 31h16L16 1H1z"/>
	<path style="fill:#ffdb02" d="m27 1 20 31h16L42 1H27z"/>
	<path style="fill:none;stroke:#000;stroke-linejoin:round;stroke-width:2px" d="m8.097 12-1.291-2M22.29 56 18 63H1l20-31L9.387 14"/>
	<path style="fill:none;stroke:#000;stroke-linejoin:round;stroke-width:2px" d="M5.516 8 1 1h15l21 31-13.484 22"/>
	<path style="fill:none;stroke:#000;stroke-linejoin:round;stroke-width:2px" d="M1 1v8l15 23L1 56v7M34.097 12l-1.291-2M48.29 56 44 63H27l20-31-11.613-18"/>
	<path style="fill:none;stroke:#000;stroke-linejoin:round;stroke-width:2px" d="M31.516 8 27 1h15l21 31-13.484 22"/>
	<path style="fill:none;stroke:#000;stroke-linejoin:round;stroke-width:2px" d="M27 1v8l15 23-15 24v7"/>
</svg>
*/

/* Example HTML from https://mustardmine.com

<main>
<p><img src='/static/MustardMineBanner.png' alt='&quot;Mustard Mine&quot; banner' title='&quot;Mustard Mine&quot; banner'></p>
<p>Mustard Mine is a Twitch channel bot. It offers a wide variety of tools to streamers
and viewers, including:</p>
<ul>
<li>Simple commands to give information</li>
<li>Responses to stream support such as subscriptions and cheers</li>
<li>Integrations with online shops (Ko-fi, Fourth Wall)</li>
<li>Goal bars, including multi-leveled goal bars</li>
<li>Hype Train tracking and reporting</li>
<li>Management of channel point rewards</li>
<li>Stream preparation eg setting title, category, tags</li>
<li>On-screen alerts</li>
<li>Raid target searching in various forms</li>
<li>And, as they say, much much more!</li>
</ul>
</main>

*/
