const commandUrl = "/dashboard/command";

window.addEventListener("load", function() {
	const commandForm = document.getElementById("console-input");
	const dataNode = document.getElementById("console-data");
	const data = dataNode.textContent.replaceColorCodes();

	dataNode.innerHTML = "";
	dataNode.appendChild(data);

	dataNode.scrollTop = dataNode.scrollHeight;

	function sendCommand(command) {
		fetch(commandUrl, {
			method: "POST",
			credentials: "same-origin",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				"Accept": "application/json"
			},
			body: encodeURIComponent("command") + "=" + encodeURIComponent(command)
		}).then(
			(response) => response.json()
		).then(
			(html) => {
				dataNode.appendChild(String(html).replaceColorCodes());
				dataNode.scrollTop = dataNode.scrollHeight;
			}
		);
	}

	commandForm.addEventListener("submit", function(event) {
		event.preventDefault();
		const commandFormData = new FormData(commandForm);
		const commandData = commandFormData.get("command");

		if (commandData) {
			const command = commandData.replace("/", "");

			if (command) {
				dataNode.append(commandData, document.createElement("br"));
				sendCommand(command);
				commandForm.reset();
			}
		}
	});
});

// Adapted from https://github.com/FoxInFlame/MinecraftColorCodes

var obfuscators = [];
const styleMap = {
	"B'0": "font-weight:normal;text-decoration:none;color:#000000",
	"B'1": "font-weight:normal;text-decoration:none;color:#0000be",
	"B'2": "font-weight:normal;text-decoration:none;color:#00be00",
	"B'3": "font-weight:normal;text-decoration:none;color:#00bebe",
	"B'4": "font-weight:normal;text-decoration:none;color:#be0000",
	"B'5": "font-weight:normal;text-decoration:none;color:#be00be",
	"B'6": "font-weight:normal;text-decoration:none;color:#d9a334",
	"B'7": "font-weight:normal;text-decoration:none;color:#bebebe",
	"B'8": "font-weight:normal;text-decoration:none;color:#3f3f3f",
	"B'9": "font-weight:normal;text-decoration:none;color:#3f3ffe",
	"B'a": "font-weight:normal;text-decoration:none;color:#3ffe3f",
	"B'b": "font-weight:normal;text-decoration:none;color:#3ffefe",
	"B'c": "font-weight:normal;text-decoration:none;color:#fe3f3f",
	"B'd": "font-weight:normal;text-decoration:none;color:#fe3ffe",
	"B'e": "font-weight:normal;text-decoration:none;color:#fefe3f",
	"B'f": "font-weight:normal;text-decoration:none;color:#ffffff",
	"B'l": "font-weight:bold",
	"B'm": "text-decoration:line-through;text-decoration-skip:spaces",
	"B'n": "text-decoration:underline;text-decoration-skip:spaces",
	"B'o": "font-style:italic",
};

function obfuscate(string, elem) {
	var magicSpan,
		currNode,
		len = elem.childNodes.length;
	if(string.indexOf("<br>") > -1) {
		elem.innerHTML = string;
		for(var j = 0; j < len; j++) {
			currNode = elem.childNodes[j];
			if(currNode.nodeType === 3) {
				magicSpan = document.createElement("span");
				magicSpan.innerHTML = currNode.nodeValue;
				elem.replaceChild(magicSpan, currNode);
				init(magicSpan);
			}
		}
	} else {
		init(elem, string);
	}
	function init(el, str) {
		var i = 0,
			obsStr = str || el.innerHTML,
			len = obsStr.length;
		obfuscators.push( window.setInterval(function () {
			if(i >= len) i = 0;
			obsStr = replaceRand(obsStr, i);
			el.innerHTML = obsStr;
			i++;
		}, 0) );
	}
	function randInt(min, max) {
		return Math.floor( Math.random() * (max - min + 1) ) + min;
	}
	function replaceRand(string, i) {
		var randChar = String.fromCharCode( randInt(64,90) ); /*Numbers: 48-57 Al:64-90*/
		return string.substr(0, i) + randChar + string.substr(i + 1, string.length);
	}
}
function applyCode(string, codes) {
	var len = codes.length;
	var elem = document.createElement("span"),
		obfuscated = false;
	for(var i = 0; i < len; i++) {
		elem.style.cssText += styleMap[codes[i]] + ";";
		if(codes[i] === "B'k") {
			obfuscate(string, elem);
			obfuscated = true;
		}
	}
	if(!obfuscated) elem.innerHTML = string;
	return elem;
}
function parseStyle(string) {
	var codes = string.match(/B'.{1}/g) || [],
		indexes = [],
		apply = [],
		tmpStr,
		indexDelta,
		noCode,
		final = document.createDocumentFragment(),
		len = codes.length,
		string = string.replace(/\n|\\n/g, "<br>");

	for(var i = 0; i < len; i++) {
		indexes.push( string.indexOf(codes[i]) );
		string = string.replace(codes[i], "\x00\x00");
	}
	if(indexes[0] !== 0) {
		final.appendChild( applyCode( string.substring(0, indexes[0]), [] ) );
	}
	for(var i = 0; i < len; i++) {
		indexDelta = indexes[i + 1] - indexes[i];
		if(indexDelta === 2) {
			while(indexDelta === 2) {
				apply.push ( codes[i] );
				i++;
				indexDelta = indexes[i + 1] - indexes[i];
			}
			apply.push ( codes[i] );
		} else {
			apply.push( codes[i] );
		}
		if( apply.lastIndexOf("B'r") > -1) {
			apply = apply.slice( apply.lastIndexOf("B'r") + 1 );
		}
		tmpStr = string.substring( indexes[i], indexes[i + 1] );
		final.appendChild( applyCode(tmpStr, apply) );
	}
	return final;
}
function clearObfuscators() {
	var i = obfuscators.length;
	for(;i--;) {
		clearInterval(obfuscators[i]);
	}
	obfuscators = [];
}
String.prototype.replaceColorCodes = function() {
	clearObfuscators();
	var outputString = parseStyle(String(this));
	return outputString;
};
