const commandUrl = "/dashboard/command";

window.addEventListener("load", function () {
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

	commandForm.addEventListener("submit", function (event) {
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
