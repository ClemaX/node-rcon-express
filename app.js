const config = require("./config.json");

// Directory paths
const path = require("path");

// Crypto
const crypto = require("crypto");
const bcrypt = require("bcrypt");

// HTTP Router
const express = require("express");
const exphbs = require("express-handlebars");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");

const app = express();

// Database
const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");

const adapter = new FileSync(config.auth.databaseFile);
const db = low(adapter);

// RCON
const RCON = require("./node-rcon/RCON");

const serverConnections = [[{}]];

const listRegExp = /There are (?<online>\d+) of a max of (?<max>\d+) players online:/;

const connectServer = (serverConfig) => {
	const host = serverConfig.internalHost;
	const port = serverConfig.port;
	const password = serverConfig.password;
	const timeout = serverConfig.timeout;

	// Connect to RCON server
	return new Promise((resolve, reject) => {
		if (!serverConfig) {
			reject("Invalid serverConfig!");
		} else if (serverConnections[host] && serverConnections[host][port]) {
			resolve(serverConnections[host][port]);
		} else {
			const rcon = new RCON(timeout);

			rcon.connect(host, port, password).then(() =>
				rcon.send("list")
			).then((listResult) => {
				const { groups: players } = listResult.match(listRegExp);

				if (!players.online || !players.max) {
					reject("Could not list server users!\n");
				}
				const server = {
					externalHost: serverConfig.externalHost,
					externalIp: "TODO",
					version: serverConfig.version,
					running: true,
					players: players,
					rcon: rcon,
					log: ["Connected to the server!\n"]
				};

				if (!serverConnections[host]) {
					serverConnections[host] = [];
				}

				serverConnections[host][port] = server;

				resolve(serverConnections[host][port]);
			}).catch((error) => {
				reject(`Could not connect to ${host}:${port}: ${error}\n`);
			});
		}
	});
};

const disconnectServer = (serverConfig) => {
	const host = serverConfig.internalHost;
	const port = serverConfig.port;

	console.log(`Disconnecting RCON on ${host}:${port}!`);
	if (!serverConnections[host] || !serverConnections[host][port]) {
		return ("Invalid serverConfig!");
	}
	serverConnections[host][port].rcon.drain();
	serverConnections[host][port].rcon.end();

	delete serverConnections[host][port];
	console.log(`Deleted connection to ${host}:${port}!`);
};

// Default user
const hashedDefaultPassword
	= bcrypt.hashSync(config.defaultUser.password, config.auth.saltRounds);

db.defaults({
	users: [
		{
			username: config.defaultUser.username,
			password: hashedDefaultPassword,
			servers: config.defaultUser.servers
		}
	]
}).write();

// Serve static files
if (config.serveStatic) {
	app.use("/static", express.static(path.join(__dirname, "public")));
}

// Use Handlebars
app.engine("hbs", exphbs({ extname: ".hbs" }));

app.set("view engine", "hbs");

// Support URL-encoded bodies
app.use(bodyParser.urlencoded({ extended: true }));

// Parse HTTP Cookies
app.use(cookieParser());

// Authentication
app.use((req, res, next) => {
	// Get auth token from the cookies
	const authToken = req.cookies["AuthToken"];

	// Inject the user to the request
	req.authToken = authToken;
	req.user = authTokens[authToken];

	next();
});

// Login
const authTokens = [];

const requireAuth = (req, res, next) => {
	if (req.user) {
		next();
	} else {
		res.redirect("/login");
	}
};

const requireServer = (req, res, next) => {
	if (!req.user.servers[0]) {
		res.status(500).json("Internal Server Error");
	} else {
		connectServer(req.user.servers[0]).then((server) => {
			req.server = server;
			next();
		}).catch((error) => {
			console.error(`requireServer: Error connecting to server: ${error}`);
			req.server = null;
			res.status(500).json("Internal Server Error");
		});
	}
};

const generateAuthToken = () => {
	return crypto.randomBytes(config.auth.tokenSize).toString("hex");
};

// Root route
app.get("/", (req, res) => {
	if (req.user) {
		res.redirect("/dashboard");
	} else {
		res.redirect("/login");
	}
});

// Login route
app.get("/login", (req, res) => {
	if (req.user) {
		res.redirect("/dashboard");
	}
	else {
		res.render("login", { css: ["login.css"] });
	}
});

app.post("/login", (req, res) => {
	const { username, password } = req.body;

	// Find user in the database
	const user = db.get("users")
		.find({ username: username })
		.value();

	if (!user) {
		res.render("login", {
			css: ["login.css"],
			message: "Invalid username or password"
		});
	} else {
		// Generate authentication token
		const authToken = generateAuthToken();

		// Store authentication token
		authTokens[authToken] = user;

		// Compare password with hashed password
		bcrypt.compare(password, user.password)
			.then((result) => {
				if (result) {
					res.cookie("AuthToken", authToken);
					res.redirect("/dashboard");
				} else {
					res.render("login", {
						css: ["login.css"],
						message: "Invalid username or password"
					});
				}
			})
			.catch(() => {
				res.status(500).json("Internal Server Error");
			});
	}
});

// Logout route TODO: should be post
app.get("/logout", requireAuth, (req, res, next) => {
	// Disconnect RCON
	disconnectServer(req.user.servers[0]);

	// Invalidate authentication token
	delete authTokens[req.authToken];
	res.clearCookie("AuthToken");
	res.redirect("/login");
});

// Dashboard route
app.get("/dashboard", requireAuth, requireServer, (req, res, next) => {
	connectServer(req.user.servers[0]).then((server) => {
		res.render("dashboard", {
			css: ["dashboard.css"],
			js: ["colors.js", "console.js"],
			server: server
		});
	}).catch((error) => {
		console.error(error);
		res.render("dashboard", {
			css: ["dashboard.css"],
			server: {
				running: false,
				players: { online: 0, max: 0}
			},
			log: ["Could not connect to server!\n"]
		});
	});
});

// Command route
app.post("/dashboard/command", requireAuth, requireServer, (req, res, next) => {
	const { command } = req.body;

	if (command) {
		req.server.log.push(command + "\n");
		req.server.rcon.send(command).then((response) => {
			req.server.log.push(response);
			console.log(response);
			res.json(response);
		}).catch((error) => {
			console.error(error);
			res.status(500).json(error);
		});
	} else {
		res.status(400).json("Invalid command!\n");
	}
});

app.listen(config.listenPort, () => {
	console.log(`Server running on port ${config.listenPort}!`);
});
