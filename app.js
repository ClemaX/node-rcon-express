const config = require('./config.json')

// Directory paths
const path = require('path');

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

const serverConnections = [[{}]];

const connectServer = (serverConfig) => {
	// Connect to RCON server
	return new Promise((resolve, reject) => {
		if (serverConnections[host][port]) {
			console.log(`Recycling RCON on ${serverConfig.host}:${serverConfig.port}`);
			resolve(serverConnections[host][port]);
		} else {
			const rcon = new RCON(config.RCON.timeout)
			connection.connect(serverConfig.host, serverConfig.port, serverConfig.password)
			.then(() => {
				console.log(`Connected to RCON on ${serverConfig.host}:${serverConfig.port}`);
				serverConnections[host][port] = {rcon: rcon, log: 'Connected to the server!'};
				resolve(serverConnections[host][port]);
			})
			.catch((error) => {
				console.error(`Could not connect to ${serverConfig.host}:${serverConfig.port}: ${error}`);
				reject(error);
			});
		}
	});
};

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

// Serve static files
app.use('/static', express.static(path.join(__dirname, 'public')));

// Use Handlebars
app.engine('hbs', exphbs({ extname: '.hbs' }));

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
		res.redirect('/login');
	}
}

const generateAuthToken = () => {
	return crypto.randomBytes(config.auth.tokenSize).toString('hex');
}

// Root route
app.get('/', (req, res) => {
	if (req.user) {
		res.redirect('/dashboard');
	} else {
		res.redirect('/login');
	}
});

// Login route
app.get('/login', (req, res) => {
	if (req.user) {
		res.redirect('/dashboard');
	}
	else {
		res.render('login', { css: ['login.css'] });
	}
});

app.post('/login', (req, res) => {
	const { username, password } = req.body;

	// Find user in the database
	const user = db.get('users')
		.find({ username: username })
		.value();

	if (!user) {
		res.render('login', {
			css: ['login.css'],
			message: 'Invalid username or password'
		});
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
					res.redirect('/dashboard');
				} else {
					res.render('login', {
						css: ['login.css'],
						message: 'Invalid username or password'
					});
				}
			})
			.catch(() => {
				res.status(500).json("Internal Server Error");
			});
	}
});

// Logout route
app.post("/logout", requireAuth, (req, res, next) => {
	// Invalidate authentication token
	delete authTokens[req.authToken];
	res.json("Logged out successfully!")
});

// Dashboard route
app.get('/dashboard', requireAuth, (req, res, next) => {
	res.render('dashboard', {css: ['dashboard.css']});
});

// Command route
app.post("/dashboard/command", requireAuth, (req, res, next) => {
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

app.listen(config.listenPort, () => {
	console.log(`Server running on port ${config.listenPort}!`);
});
