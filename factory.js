/* The Chocolate Factory (Thanks to DeviCat for the name!)

The MIT License (MIT)

Copyright (c) 2022 Chris Angelico

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

export function DOM(sel) {
	const elems = document.querySelectorAll(sel);
	if (elems.length > 1) throw new Error("Expected a single element '" + sel + "' but got " + elems.length);
	return elems[0]; //Will return undefined if there are no matching elements.
}

//Append one child or an array of children
function append_child(elem, child) {
	if (!child || child === "") return;
	if (Array.isArray(child)) {
		//TODO maybe: prevent infinite nesting (array inside itself)
		for (let c of child) append_child(elem, c);
		return;
	}
	if (typeof child === "string" || typeof child === "number") child = document.createTextNode(child);
	elem.appendChild(child);
}

export function set_content(elem, children) {
	if (typeof elem === "string") {
		const el = DOM(elem);
		if (!el) throw new Error("No element found for set_content: '" + elem + "'");
		elem = el;
	}
	while (elem.lastChild) elem.removeChild(elem.lastChild);
	append_child(elem, children);
	return elem;
}

const handlers = {};
export function on(event, selector, handler, options) {
	if (handlers[event]) return handlers[event].push([selector, handler]);
	handlers[event] = [[selector, handler]];
	document.addEventListener(event, e => {
		//Reimplement bubbling ourselves
		const top = e.currentTarget; //Generic in case we later allow this to attach to other than document
		let cur = e.target;
		while (cur && cur !== top) {
			e.match = cur; //We can't mess with e.currentTarget without synthesizing our own event object. Easier to make a new property.
			handlers[event].forEach(([s, h]) => cur.matches(s) && h(e));
			cur = cur.parentNode;
		}
		e.match = null; //Signal that you can't trust the match ref any more
	}, options);
	return 1;
}

//Apply some patches to <dialog> tags to make them easier to use. Accepts keyword args in a config object:
//	fix_dialogs({close_selector: ".dialog_cancel,.dialog_close", click_outside: true});
//For older browsers, this adds showModal() and close() methods
//If cfg.close_selector, will hook events from all links/buttons matching it to close the dialog
//If cfg.click_outside, any click outside a dialog will also close it. (May not work on older browsers.)
export function fix_dialogs(cfg) {
	if (!cfg) cfg = {};
	//For browsers with only partial support for the <dialog> tag, add the barest minimum.
	//On browsers with full support, there are many advantages to using dialog rather than
	//plain old div, but this way, other browsers at least have it pop up and down.
	let need_button_fix = false;
	document.querySelectorAll("dialog").forEach(dlg => {
		if (!dlg.showModal) {
			dlg.showModal = function() {this.style.display = "block";}
			dlg.close = function(ret) {
				if (ret) this.returnValue = ret;
				this.style.removeProperty("display");
				this.dispatchEvent(new CustomEvent("close", {bubbles: true}));
			};
			need_button_fix = true;
		}
	});
	//Ideally, I'd like to feature-detect whether form[method=dialog] actually
	//works, and do this if it doesn't; we assume that the lack of a showModal
	//method implies this being also unsupported.
	if (need_button_fix) on("click", 'dialog form[method="dialog"] button', e => {
		e.match.closest("dialog").close(e.match.value);
		e.preventDefault();
	});
	if (cfg.click_outside) on("click", "dialog", e => {
		//NOTE: Sometimes, clicking on a <select> will give spurious clientX/clientY
		//values. Since clicking outside is always going to send the message directly
		//to the dialog (not to one of its children), check for that case.
		if (e.match !== e.target) return;
		if (cfg.click_outside === "formless" && e.match.querySelector("form")) return;
		let rect = e.match.getBoundingClientRect();
		if (e.clientY < rect.top || e.clientY > rect.top + rect.height
				|| e.clientX < rect.left || e.clientX > rect.left + rect.width)
		{
			e.match.close();
			e.preventDefault();
		}
	});
	if (cfg.close_selector) on("click", cfg.close_selector, e => e.match.closest("dialog").close());
}

//Compatibility hack for those attributes where not ret[attr] <=> ret.setAttribute(attr). Might be made externally mutable? Maybe?
const attr_xlat = {classname: "class", htmlfor: "for"};

let choc = function(tag, attributes, children) {
	const ret = document.createElement(tag);
	//If called as choc(tag, children), assume all attributes are defaults
	if (typeof attributes === "string" || attributes instanceof Array || attributes instanceof Element) {
		//But if called as choc(tag, child, child), that was probably an error.
		//It's also possible someone tried to call choc(tag, child, attr); in
		//that case, the warning will be slightly confusing, but still point to
		//the right place.
		if (children) console.warn("Extra argument(s) to choc() - did you intend to pass an array of children?");
		return set_content(ret, attributes);
	}
	if (attributes) for (let attr in attributes) {
		if (attr.startsWith("on") || attr === "volume") ret[attr] = attributes[attr]; //Events should be created with on(), but can be done this way too.
		else ret.setAttribute(attr_xlat[attr.toLowerCase()] || attr, attributes[attr]);
	}
	if (children) set_content(ret, children);
	if (arguments.length > 3) console.warn("Extra argument(s) to choc() - did you intend to pass an array of children?");
	return ret;
}
choc.__version__ = "1.0.2";

//Interpret choc.DIV(attr, chld) as choc("DIV", attr, chld)
//This is basically what Python would do as choc.__getattr__()
choc = new Proxy(choc, {get: function(obj, prop) {
	if (prop in obj) return obj[prop];
	return obj[prop] = obj.bind(null, prop);
}});

//For modules, make the main entry-point easily available.
export default choc;

//For non-module scripts, allow some globals to be used. Also useful at the console.
window.choc = choc; window.set_content = set_content; window.on = on; window.DOM = DOM; window.fix_dialogs = fix_dialogs;
