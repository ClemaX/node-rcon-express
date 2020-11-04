const config = require('./config.json')

// Crypto
const crypto = require('crypto');
const bcrypt = require('bcrypt');

// HTTP Router
const express = require('express');
const exphbs = require('express-handlebars');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');

const app = express();

// Database
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync')

const adapter = new FileSync(config.auth.databaseFile);
const db = low(adapter);

// RCON
const RCON = require('./node-rcon/RCON');

const rcon = new RCON(config.RCON.timeout);

// Connect to RCON server
rcon.connect(config.RCON.host, config.RCON.port, config.RCON.password)
	.then(() => {
		console.log(`Connected to RCON on ${config.RCON.host}:${config.RCON.port}`);
		app.listen(config.listenPort, () => {
			console.log(`Server running on port ${config.listenPort}!`);
		});
	})
	.catch((error) => {
		console.error(`Could not connect to ${config.RCON.host}:${config.RCON.port}: ${error}`);
		process.exit(1);
	});

// Default user
const hashedDefaultPassword
	= bcrypt.hashSync(config.defaultUser.password, config.auth.saltRounds);

db.defaults({
	users: [
		{
			username: config.defaultUser.username,
			password: hashedDefaultPassword,
		}
	]
}).write();

app.engine('hbs', exphbs({
	extname: '.hbs'
}));

app.set('view engine', 'hbs');

// Support URL-encoded bodies
app.use(bodyParser.urlencoded({ extended: true }))

// Parse HTTP Cookies
app.use(cookieParser());

// Authentication
app.use((req, res, next) => {
	// Get auth token from the cookies
	const authToken = req.cookies['AuthToken'];

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
		res.status(403).json("Unauthenticated");
	}
}

const generateAuthToken = () => {
	return crypto.randomBytes(config.auth.tokenSize).toString('hex');
}

app.post("/login", (req, res) => {
	const { username, password } = req.body;

	// Find user in the database
	const user = db.get('users')
		.find({ username: username })
		.value();

	if (!user) {
		res.json("Invalid credentials");
	} else {
		// Generate authentication token
		const authToken = generateAuthToken();

		// Store authentication token
		authTokens[authToken] = user;

		// Compare password with hashed password
		bcrypt.compare(password, user.password)
			.then((result) => {
				if (result){
					res.cookie('AuthToken', authToken);
					res.json("Logged in successfully!");
				} else {
					res.status(401).json("Invalid credentials");
				}
			})
			.catch((err) => {
				console.error(err);
			});
	}
});

app.post("/logout", requireAuth, (req, res, next) => {
	// Invalidate authentication token
	delete authTokens[req.authToken];
	res.json("Logged out successfully!")
});

app.post("/command", requireAuth, (req, res, next) => {
	const { command } = req.body;
	if (command) {
		console.log(`Executing RCON '${command}'...`);
		rcon.send(command)
			.then((response) => {
				console.log(`Result of command: ${response}`);
				res.json(response);
			})
			.catch((error) => {
				res.status(500).json(error);
			});
	} else {
		res.status(401).json("Invalid command!");
	}
});
