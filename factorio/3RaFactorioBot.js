//Set up the Discord bot interface
var Discord = require("discord.js");
var bot = new Discord.Client();

//Set up code to get line number of Promise Rejections
process.on("unhandledRejection", (err) => {
	console.error("Uncaught Promise Error: \n" + err.stack);
});

//Set up the channel list
var fs = require("fs");
var channels;
try {
	channels = JSON.parse(fs.readFileSync("./channel_list.json", "utf8"));
} catch (err) {
	if (err.code == "ENOENT") {
		fs.writeFileSync("channel_list.json", JSON.stringify({}));
		channels = {};
	}
}

//Set up a blank list for Player storage, does not need to persist through restarts
//This will be used to build a current player list
playerlists = {};

//The list of public commands
var publiccommands = {
	"players": function (message, command) {
		if (command.length > 2) {
			message.channel.sendMessage("::players can be used either alone or with a single optional argument (::players [force])");
			return;
		}
		let force_name = null;
		let current = getChannelKey(channels, message.channel.id);
		if (current === null || channels[current].type == "chat") {
			message.channel.sendMessage("This channel is not registered to any server!\n");
			return;
		}
		if (command.length == 2) force_name = command[1];
		let serverid;
		if (channels[current].type == "pvp") serverid = current.substring(0, current.indexOf("-"));
		else serverid = current;
		if (channels[serverid].status != "started") {
			message.channel.sendMessage("This server is currently offline.");
			return;
		}
		let playerlist = playerlists[serverid];
		if (Object.keys(playerlist).length === 0) {
			message.channel.sendMessage("No players are currently online.");
			return;
		}
		let send_message;
		if (!force_name) send_message = "Players currently online: \n\n";
		else send_message = "Players currently online on force *" + force_name + "*:\n\n";
		for (var playername in playerlist) {
			if (!force_name || playerlist[playername].force == force_name) {
				send_message = send_message + "**" + playername + "**   Force: " + playerlist[playername].force + "   Status: " + playerlist[playername].status + "\n";
			}
		}
		if (send_message == ("Players currently online on force *" + force_name + "*:\n\n")) {
			message.channel.sendMessage("No players are currently online for force *" + force_name + "*");
			return;
		}
		message.channel.sendMessage(send_message);
	},
	"listservers": function (message, command) {
		if (Object.keys(channels).length === 0) {
			message.channel.sendMessage("No servers are currently registered. This may be a bug, please tag Moderators.");
			return;
		}
		let servers = "List of currently running servers:\n\n";
		for (var serverid in channels) {
			let current = channels[serverid];
			if (current.type == "server" && current.status == "started") {
				servers = servers + "**" + current.name + "** is currently running. Not PvP. Current players: " + Object.keys(playerlists[serverid]).length + "\n";
			}
			if (current.type == "pvp-main" && current.status == "started") {
				servers = servers + "**" + current.name + "** is currently running. PvP. Current players: " + Object.keys(playerlists[serverid]).length + "\n";
			}
		}
		if (servers == "List of currently running servers:\n\n") {
			message.channel.sendMessage("No servers are currently running.");
		} else {
			message.channel.sendMessage(servers);
		}
	},
	"status": function (message, command) {
		let registered_servers = 0;
		for (var serverid in channels) {
			let current = channels[serverid];
			if (current.type == "server" || current.type == "pvp-main") registered_servers++;
		}
		message.channel.sendMessage("3Ra Factorio Bot is running. There are currently " + registered_servers + " servers registered.");
	},
	"help": function (message, command) {
		message.channel.sendMessage("**::players** *[force]* - Get a list of all currently connected players, must be run in a registered channel. If the optional argument force is provided, it will print players only on that force.\n\n" +
			"**::listservers** - Get a list of all currently running servers, as well as the amount of players currently connected to each.\n\n" +
			"**::status** - Have the bot print a message saying that it is running correctly\n\n" + 
			"**::adminhelp** - Must have the Moderator role, shows commands that require Moderator role to run."
		);
	}
};

//The list of Moderator only commands
var admincommands = {
	"setserver": function (message, command) {
		if (command.length < 3) {
			message.channel.sendMessage("The setserver command requires 2 arguments. ::setserver serverid servername");
			return;
		}
		//Check to see if serverid is already registered
		let serverid = command[1];
		if (channels[serverid]) {
			message.channel.sendMessage("Server " + serverid + " is already registered to another Discord channel! Please go ::unset the original first.\n");
			return;
		}
		//Check to see if this channel is already registered
		let current = getChannelKey(channels, message.channel.id);
		if (current !== null) {
			message.channel.sendMessage("This channel is already registered! Please use ::unset first if you want to change this.\n");
			return;
		}
		//Get the name to tag the server as
		let servername = command.slice(2).join(" ");
		channels[serverid] = { id: message.channel.id, name: servername, type: "server", status: "unknown" };
		let name_changed = message.channel.setName("factorio-" + servername);
		name_changed.then(() => {
			message.channel.setTopic("Server registered");
		});
		fs.unlinkSync("channel_list.json");
		fs.writeFileSync("channel_list.json", JSON.stringify(channels));
		playerlists[serverid] = {};
		message.channel.sendMessage("Messages from server " + serverid + " will now be sent to this channel with the prefix [" + servername + "].\n");
	},
	"setchannel": function (message, command) {
		if (command.length < 3) {
			message.channel.sendMessage("The setchannel command requires 2 arguments. ::setchannel channelid channelname");
			return;
		}
		//Check to see if channelid is already registered
		let channelid = command[1];
		if (channels[channelid]) {
			message.channel.sendMessage("Channel " + channelid + " is already registered to another Discord channel! Please go ::unset the original first.\n");
			return;
		}
		//Check to see if this channel is already registered
		let current = getChannelKey(channels, message.channel.id);
		if (current !== null) {
			message.channel.sendMessage("This channel is already registered! Please use ::unset first if you want to change this.\n");
			return;
		}
		//Get the name to tag the server as
		let channelname = command.slice(2).join(" ");
		channels[channelid] = { id: message.channel.id, name: channelname, type: "chat" };
		fs.unlinkSync("channel_list.json");
		fs.writeFileSync("channel_list.json", JSON.stringify(channels));
		message.channel.sendMessage("Messages from channel " + channelid + " will now be sent to this channel with the prefix [" + channelname + "].\n");
	},
	"setpvpmain": function (message, command) {
		if (command.length < 3) {
			message.channel.sendMessage("The setpvpmain command requires 2 arguments. ::setchannel serverid servername");
			return;
		}
		//Check to see if pvpid is already registered
		let serverid = command[1];
		if (channels[serverid] && channels[serverid].type != "registered") {
			message.channel.sendMessage("This server is already registered to another Discord channel! Please go ::unset the original first.");
			return;
		}
		//Check to see if this channel is already registered
		let current = getChannelKey(channels, message.channel.id);
		if (current !== null) {
			message.channel.sendMessage("This channel is already registered! Please use ::unset first if you want to change this.\n");
			return;
		}
		//Get the name to tag the server as
		let servername = command[2];
		channels[serverid] = { id: message.channel.id, name: servername, type: "pvp-main", forces: [] };
		message.channel.sendMessage("Shouts from any force on server *" + serverid + "* will now be sent to this channel with the prefix [" + servername + "].\n");
		if (!playerlists[serverid]) playerlists[serverid] = {};
		let name_changed = message.channel.setName("factorio-" + servername);
		name_changed.then(() => {
			message.channel.setTopic("Server registered");
		});
		fs.unlinkSync("channel_list.json");
		fs.writeFileSync("channel_list.json", JSON.stringify(channels));
	},
	"setpvpforce": function (message, command) {
		if (command.length < 3) {
			message.channel.sendMessage("The setpvpforce command requires 2 arguments. ::setchannel serverid forcename");
			return;
		}
		//Check to see if pvpid is already registered
		let serverid = command[1];
		if (!channels[serverid] || channels[serverid].type == "registered") {
			message.channel.sendMessage("The main server for this PvP force is not yet registered! You must use ::setpvpmain first!");
			return;
		}
		let forcename = command[2];
		let pvpid = serverid + "-" + forcename;
		if (channels[pvpid]) {
			message.channel.sendMessage("This force is already registered to another Discord channel! Please go ::unset the original first.");
			return;
		}
		//Check to see if this channel is already registered
		let current = getChannelKey(channels, message.channel.id);
		if (current !== null) {
			message.channel.sendMessage("This channel is already registered! Please use ::unset first if you want to change this.\n");
			return;
		}
		//Get the name to tag the server as
		let servername = channels[serverid].name;
		channels[pvpid] = { id: message.channel.id, name: servername + "-" + forcename, type: "pvp", main: serverid };
		message.channel.sendMessage("Messages from force *" + forcename + "* on server *" + serverid + "* will now be sent to this channel with the prefix [" + servername + "-" + forcename + "].\n");
		channels[serverid].forces.push(pvpid);
		let name_changed = message.channel.setName("factorio-" + servername + "-" + forcename);
		name_changed.then(() => {
			message.channel.setTopic("Server registered");
		});
		fs.unlinkSync("channel_list.json");
		fs.writeFileSync("channel_list.json", JSON.stringify(channels));
	},
	"changename": function (message, command) {
		//Change the name of a server
		if (command.length != 2) {
			message.channel.sendMessage("The changename command requires one argument. ::changename newname\n");
			return;
		}
		let newname = command[1];
		let current = getChannelKey(channels, message.channel.id);
		if (current === null) {
			message.channel.sendMessage("This channel is not registered to any server!\n");
			return;
		}
		if (channels[current].type == "pvp") {
			let oldname = channels[channels[current].main].name;
			channels[channels[current].main].name = newname;
			for (let i = 0; i < channels[channels[current].main].forces.length; i++) {
				let currentserver = channels[channels[current].main].forces[i];
				channels[currentserver].name = channels[currentserver].name.replace(oldname, newname);
				bot.channels.get(channels[currentserver].id).setName("factorio-" + channels[currentserver].name);
			}
		} else {
			let oldname = channels[current].name;
			channels[current].name = channels[current].name.replace(oldname, newname);
			bot.channels.get(channels[current].id).setName("factorio-" + newname);
		}
		fs.unlinkSync("channel_list.json");
		fs.writeFileSync("channel_list.json", JSON.stringify(channels));
	},
	"unset": function (message, command) {
		//Check to see if the server is registered to a channel
		let remove = getChannelKey(channels, message.channel.id);
		if (remove === null) {
			message.channel.sendMessage("There is nothing registered to this channel");
			return;
		}
		if (channels[remove].type == "pvp") {
			let main_name = remove.substring(0, remove.indexOf("-"));
			let main_channel = channels[main_name];
			main_channel.forces.splice(main_channel.forces.indexOf(remove), 1);
		} else if (channels[remove].type == "pvp-main") {
			let forces = channels[remove].forces;
			for (let i = 0; i < forces.length; i++) {
				let current = forces[i];
				let message_sent = bot.channels.get(channels[current].id).sendMessage("Main channel was unregistered.");
				message_sent.then((sent_message) => {
					let name_changed = sent_message.channel.setName("factorio-unset");
					name_changed.then(() => {
						sent_message.channel.setTopic("::unset was used here");
					});
				});
				delete channels[current];
			}
		}
		//Delete the server registration and update the channel_list.json
		delete channels[remove];
		if (playerlists[remove]) delete playerlists[remove];
		fs.unlinkSync("channel_list.json");
		fs.writeFileSync("channel_list.json", JSON.stringify(channels));
		message.channel.sendMessage("Successfully unregistered.\n");
		let name_changed = message.channel.setName("factorio-unset");
		name_changed.then(() => {
			message.channel.setTopic("::unset was used here");
		});
	},
	"setadmin": function (message, command) {
		//Set the admin warning messages to be delivered to this current channel
		let current = getChannelKey(channels, message.channel.id);
		if (current !== null) message.channel.sendMessage("The admin channel is currently already set. This command will overwrite the previous admin channel.\n");
		channels.admin = { id: message.channel.id, name: "Admin", type: "admin" };
		fs.unlinkSync("channel_list.json");
		fs.writeFileSync("channel_list.json", JSON.stringify(channels));
		message.channel.sendMessage("All Admin warnings and messages will now be sent here.\n");
	},
	"sendadmin": function (message, command) {
		if (channels.admin) {
			if (channels.admin.id == message.channel.id) {
				if (command.length < 3) {
					message.channel.sendMessage("Correct usage: ::sendadmin [serverid/all] command");
					return;
				} 
				let server = command[1];
				if (channels[server] || server == "all") {
					let sendcommand = command.slice(2).join(" ");
					let sendstring = "admin$" + server + "$/silent-command " + sendcommand.replace(/\n/g, " ") + "\n";
					safeWrite(sendstring);
				} else {
					message.channel.sendMessage("Serverid is not a registered server or 'all'.");
				}
				return;
			}
		}
		message.channel.sendMessage("Admin commands can only be done from the registered admin channel. Use ::setadmin to register one if you haven't already.");
	},
	"adminannounce": function (message, command) {
		if (channels.admin) {
			if (channels.admin.id == message.channel.id) {
				if (command.length < 3) {
					message.channel.sendMessage("Correct usage: ::adminannounce [serverid/all] announcement");
					return;
				}
				let server = command[1];
				if (channels[server] || server == "all") {
					let announcement = command.slice(2).join(" ");
					let sendstring = "admin$" + server + "$/silent-command game.print('[ANNOUNCEMENT] " + clean_message(announcement) + "')" + "\n";
					safeWrite(sendstring);
				} else {
					message.channel.sendMessage("Serverid is not a registered server or 'all'.");
				}
				return;
			}
		}
		message.channel.sendMessage("Admin commands can only be done from the registered admin channel. Use ::setadmin to register one if you haven't already.");
	},
	"registerserver": function (message, command) {
		if (channels.admin) {
			if (channels.admin.id == message.channel.id) {
				if (command.length != 2) {
					message.channel.sendMessage("Correct usage: ::registerserver serverid");
					return;
				}
				let serverid = command[1];
				if (channels[serverid]) {
					message.channel.sendMessage("This server is already registered!");
				} else {
					channels[serverid] = { id: null, name: null, type: "registered" };
					message.channel.sendMessage("Server " + serverid + " has been registered.");
					fs.unlinkSync("channel_list.json");
					fs.writeFileSync("channel_list.json", JSON.stringify(channels));
				}
				return;
			}
		}
		message.channel.sendMessage("Admin commands can only be done from the registered admin channel. Use ::setadmin to register one if you haven't already.");
	},
	"unregister": function (message, command) {
		if (channels.admin) {
			if (channels.admin.id == message.channel.id) {
				if (command.length != 2) {
					message.channel.sendMessage("Correct usage: ::unregister serverid");
					return;
				}
				let serverid = command[1];
				if (!channels[serverid]) {
					message.channel.sendMessage("This server is not registered!");
				} else {
					if (channels[serverid].type != "registered") {
						message.channel.sendMessage("This server was not registered with ::registerserver. This command will not work for this server.");
					} else {
						delete channels[serverid];
						message.channel.sendMessage("Server " + serverid + " has been unregistered.");
						fs.unlinkSync("channel_list.json");
						fs.writeFileSync("channel_list.json", JSON.stringify(channels));
					}
				}
				return;
			}
		}
		message.channel.sendMessage("Admin commands can only be done from the registered admin channel. Use ::setadmin to register one if you haven't already.");
	},
	"banhammer": function (message, command) {
		if (channels.admin) {
			if (channels.admin.id == message.channel.id) {
				if (command.length != 2) {
					message.channel.sendMessage("Correct usage: ::banhammer Factorio_username");
					return;
				}
				let username = command[1];
				let sendstring = "admin$all$/ban " + username + " 'Speak to us at www.3ragaming.com/Discord to request an appeal'\n";
				safeWrite(sendstring);
				message.channel.sendMessage("Player " + username + " has been banned from all currently running 3Ra servers.\n");
				return;
			}
		}
		message.channel.sendMessage("Admin commands can only be done from the registered admin channel. Use ::setadmin to register one if you haven't already.");
	},
	"restart": function (message, command) {
		if (channels.admin) {
			if (channels.admin.id == message.channel.id) {
				safeWrite("restart$\n");
				return;
			}
		}
		message.channel.sendMessage("Admin commands can only be done from the registered admin channel. Use ::setadmin to register one if you haven't already.");
	},
	"clearservers": function (message, command) {
		if (channels.admin) {
			if (channels.admin.id == message.channel.id) {
				channels = {};
				fs.unlinkSync("channel_list.json");
				fs.writeFileSync("channel_list.json", JSON.stringify(channels));
				return;
			}
		}
		message.channel.sendMessage("Admin commands can only be done from the registered admin channel. Use ::setadmin to register one if you haven't already.");
	},
	"adminhelp": function (message, command) {
		message.channel.sendMessage("**::setserver** *serverid servername* - Any messages internally tagged with serverid will be sent to the channel this command is run in, prefixed with '[servername]'.\n\n" +
			"**::setchannel** *channelid channelname* - Same as above, but using chat channels (coded by Articulating) rather than servers.\n\n" +
			"**::setpvpmain** *serverid* *servername* - Set the main channel for a PvP server. This command must be run before force specific forces can be registered." +
			"**::setpvpforce** *serverid forcename* - Only the messages from a specific force (forcename) of a PvP server will be sent to this channel (other arguments same as above). Cannot be used unless ::setpvpmain has been run.\n\n" +
			"**::changename** *newname* - Change the registered name of a server, must be done in the channel you wish to change. If done to a PvP channel, it will change the name of all PvP channels connected to the same server.\n\n" +
			"**::unset** - Unsets a channel that was previously registered using ::setserver, ::setchannel, or ::setpvp. Unsetting a single force PvP channel will only unset that channel, but unsetting the main PvP channel will unset all force specific channels.\n\n"
		);
		message.channel.sendMessage("**::setadmin** - Sets the channel that all admin warnings and messages are to be delivered to.\n\n" +
			"**::sendadmin** *[serverid/all] command* - Sends 'command' to 'serverid' as if you were typing directly into the console (/silent-command will automatically be attached to the beginning). " +
			"Replace serverid with \"all\" to send to all running servers. Serverid must be registered.\n\n" +
			"**::adminannounce** *[serverid/all] announcement* - Sends an announcement to 'serverid'. Replace serverid with \"all\" to send to all running servers. Serverid must be registered.\n\n" +
			"**::registerserver** *serverid* - Register a server for use, but do not attach a Discord channel to it. (Allows ::sendadmin and ::adminanounce to work).\n\n" +
			"**::unregister** *serverid* - Unregister a server registered with ::registerserver.\n\n" +
			"**::banhammer** *Factorio_username* - Bans a player from all running servers at once.\n\n" +
			"**::restart** - Have the bot restart, allowing any updates to the source code to occur without requiring shutting down everything else.\n\n" +
			"**::clearservers** - Delete and recreate a blank channel_list.json. This will unregister every server, including the admin channel. Used in case an update changes the structure of channel_list.json."
		);
	}
};

//Cleans a message by escaping single quotes and double quotes, as well as clearing newlines
//Single quotes are double escaped, as the C program will strip one and the Factorio server will strip the other
function clean_message(message) {
	let escape_chars = message.replace(/\\/g, "");
	let single_quotes = escape_chars.replace(/'/g, "\\'");
	let new_lines = single_quotes.replace(/\n/g, " ");
	return new_lines;
}

//Function to get the key(s) relating to a value
function getChannelKey(object, value) {
	for (var key in object) {
		if (object[key].id == value) return key;
	}
	return null;
}

//Function to safely handle writing to stdout
function safeWrite(sendstring) {
	if (!process.stdout.write(sendstring)) {
		safe = false;
		process.stdout.once('drain', safeWrite(sendstring));
	} else {
		safe = true;
	}
}
var safe = true;

//Update channel description with current list of players
function updateDescription(channelid) {
	var playerliststring;
	let serverid;
	let force_name;
	if (channels[channelid].type == "pvp") {
		serverid = channelid.substring(0, channelid.indexOf("-"));
		force_name = channelid.substring(channelid.indexOf("-") + 1);
		playerliststring = "Server online. ## Connected players (Force " + force_name + "): ";
	} else {
		serverid = channelid;
		force_name = null;
		playerliststring = "Server online. ## Connected players: ";
	}
	let playerlist = playerlists[serverid];
	var playerlistcount = 0;
	if (Object.keys(playerlist).length === 0) {
		if (!force_name) bot.channels.get(channels[channelid].id).setTopic("Server online. No players connected");
		else bot.channels.get(channels[channelid].id).setTopic("Server online. No players connected (Force " + force_name + ")");
		return;
	}
	for (var playername in playerlist) {
		if (!force_name || playerlist[playername].force == force_name) {
			playerliststring = playerliststring + playername + ", ";
			playerlistcount++;
		}
	}
	if (playerlistcount === 0) {
		bot.channels.get(channels[channelid].id).setTopic("Server online. No players connected (Force " + force_name + ")");
		return;
	}
	let preparestring = playerliststring.substring(0, playerliststring.length - 2)
	let finalstring = preparestring.replace("##", playerlistcount);
	bot.channels.get(channels[channelid].id).setTopic(finalstring);
}

//Set utf8 encoding for both stdin and stdout
process.stdin.setEncoding('utf8');
process.stdout.setDefaultEncoding('utf8');

//Receive input from management program
process.stdin.on('readable', () => {
	let input = process.stdin.read();

	if (input !== null) {
		//Removes various invisible characters that would mess with the program
		if (input.indexOf("\r\n") != -1) input = input.substring(0, input.length - 2); //For testing on Windows, removes the \r\n that Windows adds with the Enter key
		if (input.indexOf("\n") != -1) input = input.substring(0, input.length - 1); //For testing on Linux, removes the \n that Linux adds with the Enter key

		//Get the channelid
		let separator = input.indexOf("$");
		let channelid = input.substring(0, separator);
		if (channelid == "emergency") {
			//Bot crashed, must restart
			if (!channels.admin) return;
			let roleid = bot.guilds.get("143772809418637313").roles.find("name", "Moderators").id;
			let tag = "<@&" + roleid + ">";
			let new_input = input.substring(separator + 1);
			bot.channels.get(channels.admin.id).sendMessage(tag + " The bot has crashed! The crash was detected and the bot restarted at " + new_input + "\n");
		} else if (channelid == "crashreport") {
			//Bot crashed, must restart
			if (!channels.admin) return;
			let roleid = bot.guilds.get("143772809418637313").roles.find("name", "Moderators").id;
			let tag = "<@&" + roleid + ">";
			let servername = input.substring(separator + 1);
			if (!channels[servername]) return;
			bot.channels.get(channels.admin.id).sendMessage(tag + " Server *" + servername + "* (" + channels[servername].name + ") has crashed!\n");
			let message_sent = bot.channels.get(channels[servername].id).sendMessage("**Server crash was detected. Moderators have been notified. Please wait for restart.**");
			message_sent.then((message) => {
				message.channel.overwritePermissions(bot.guilds.get("143772809418637313").roles.get("143772809418637313"), { 'SEND_MESSAGES': false });
			});
		} else if (channelid == "admin") {
			//Admin Warning System
			if (!channels.admin) return;
			let roleid = bot.guilds.get("143772809418637313").roles.find("name", "Moderators").id;
			let tag = "<@&" + roleid + ">";
			let new_input = input.substring(separator + 1);
			separator = new_input.indexOf("$");
			channelid = new_input.substring(0, separator);
			let channelname = channels[channelid].name;
			let message = new_input.substring(separator + 1);
			bot.channels.get(channels.admin.id).sendMessage(
				tag + "\n" +
				"**Admin Warning System was set off!**\n" +
				"Server ID: " + channelid + "\n" +
				"Server Name: " + channelname + "\n" +
				"Message: " + message
			);
		} else if (channelid == "output") {
			//Requested output from server being returned
			if (!channels.admin) return;
			let message = input.substring(separator + 1);
			bot.channels.get(channels.admin.id).sendMessage("Response: " + message + "\n");
		} else if (channelid == "PLAYER") {
			//Player Update
			let new_input = input.substring(separator + 1);
			separator = new_input.indexOf("$");
			channelid = new_input.substring(0, separator);
			if (channels[channelid]) {
				let data = new_input.substring(separator + 1).split(","); //Replaces the newline at the end while also splitting the arguments apart
				let action = data[0]; //Join,Leave,Force,Die,Respawn
				let player_id = data[1]; //Not really relevant, but included in case it may be needed sometime in the future
				let player_name = data[2]; //Player's username
				let force_name = data[3]; //Name of player's force
				var message;
			
				switch (action) {
					case "join":
						message = "**Player " + player_name + " has joined the server!**";
						playerlists[channelid][player_name] = { "force": force_name, "status": "alive" };
						break;
					case "leave":
						message = "**Player " + player_name + " has left the server!**";
						delete playerlists[channelid][player_name];
						break;
					case "force":
						message = "***Player " + player_name + " has joined force " + force_name + "!***";
						if (!playerlists[channelid][player_name]) return;
						playerlists[channelid][player_name].force = force_name;
						break;
					case "die":
						message = "**Player " + player_name + " was killed!**";
						if (!playerlists[channelid][player_name]) return;
						playerlists[channelid][player_name].status = "dead";
						break;
					case "respawn":
						message = "**Player " + player_name + " just respawned!**";
						if (!playerlists[channelid][player_name]) return;
						playerlists[channelid][player_name].status = "alive";
						break;
				}
				if (channels[channelid].type == "pvp-main") {
					updateDescription(channelid);
					bot.channels.get(channels[channelid].id).sendMessage(message);
					if (action != "leave") playerlists[channelid][player_name].force = force_name; //Redundancy, as what force the player is on is only important in PvP
					channelid = channelid + "-" + force_name;
					if (!channels[channelid]) return;
				}
				updateDescription(channelid);
				bot.channels.get(channels[channelid].id).sendMessage(message);
			}
		} else if (channels[channelid]) {
			if (channels[channelid].type == "registered") {
				return;
			} else if (channels[channelid].type == "pvp-main") {
				let message = input.substring(separator + 1);
				if (message == "**[ANNOUNCEMENT]** Server has started!") {
					//Open the channel for chat if the server is running
					let mainserver = channelid;
					let open_server = bot.channels.get(channels[mainserver].id).overwritePermissions(bot.guilds.get("143772809418637313").roles.get("143772809418637313"), { 'SEND_MESSAGES': true });
					open_server.then(() => {
						bot.channels.get(channels[mainserver].id).sendMessage(message);
					});
					bot.channels.get(channels[mainserver].id).setTopic("Server online. No players connected");
					let forces = channels[channelid].forces;
					for (let i = 0; i < forces.length; i++) {
						let insideid = forces[i];
						let open_server = bot.channels.get(channels[insideid].id).overwritePermissions(bot.guilds.get("143772809418637313").roles.get("143772809418637313"), { 'SEND_MESSAGES': true });
						open_server.then(() => {
							bot.channels.get(channels[insideid].id).sendMessage(message);
						});
						let force_name = insideid.substring(insideid.indexOf("-") + 1);
						bot.channels.get(channels[insideid].id).setTopic("Server online. No players connected (Force " + force_name + ")");
					}
					channels[mainserver].status = "started";
				} else if (message == "**[ANNOUNCEMENT]** Server has stopped!") {
					//Close the channel for chat if the server is stopped
					let mainserver = channelid;
					let message_sent = bot.channels.get(channels[mainserver].id).sendMessage(message);
					message_sent.then((message) => {
						message.channel.overwritePermissions(bot.guilds.get("143772809418637313").roles.get("143772809418637313"), { 'SEND_MESSAGES': false });
					});
					let forces = channels[channelid].forces;
					for (let i = 0; i < forces.length; i++) {
						let insideid = forces[i];
						let message_sent = bot.channels.get(channels[insideid].id).sendMessage(message);
						message_sent.then((message) => {
							message.channel.overwritePermissions(bot.guilds.get("143772809418637313").roles.get("143772809418637313"), { 'SEND_MESSAGES': false });
						});
						bot.channels.get(channels[insideid].id).setTopic("Server offline");
					}
					channels[mainserver].status = "stopped";
				} else {
					//Server is a PvP server, send to correct channel
					if (message.indexOf(" (shout):") > 0 && message.indexOf(" (shout)") < message.indexOf(":")) {
						//Message is a shout, send it to main channel
						let shoutless = message.replace(" (shout):", ":");
						bot.channels.get(channels[channelid].id).sendMessage("[" + channels[channelid].name + "] " + shoutless);
					} else {
						//Message is not a shout, send it to force specific channel
						separator = message.indexOf(":");
						let username = message.substring(0, separator);
						if (username.indexOf("[") != -1) username = username.substring(0, username.indexOf("[") - 1); //Remove any tag on the username
						let force_name = playerlists[channelid][username].force;
						let pvp_channelid = channelid + "-" + force_name;
						if (channels[pvp_channelid]) {
							if (message.charAt(0) == '[') bot.channels.get(channels[pvp_channelid].id).sendMessage(message);
							else bot.channels.get(channels[pvp_channelid].id).sendMessage("[" + channels[pvp_channelid].name + "] " + message);
						}
					}
				}
			} else {
				//Server is not PvP, send message normally
				let message = input.substring(separator + 1);
				if (message.indexOf(" (shout):") > 0 && message.indexOf(" (shout)") < message.indexOf(":")) message = message.replace(" (shout):", ":");
				if (message == "**[ANNOUNCEMENT]** Server has started!") {
					//Open the channel for chat if the server is running
					let open_server = bot.channels.get(channels[channelid].id).overwritePermissions(bot.guilds.get("143772809418637313").roles.get("143772809418637313"), { 'SEND_MESSAGES': true });
					open_server.then(() => {
						bot.channels.get(channels[channelid].id).sendMessage(message);
					});
					channels[channelid].status = "started";
					bot.channels.get(channels[channelid].id).setTopic("Server online. No players connected.");
				} else if (message == "**[ANNOUNCEMENT]** Server has stopped!") {
					//Close the channel for chat if the server is stopped
					let message_sent = bot.channels.get(channels[channelid].id).sendMessage(message);
					message_sent.then((message) => {
						bot.channels.get(channels[channelid].id).overwritePermissions(bot.guilds.get("143772809418637313").roles.get("143772809418637313"), { 'SEND_MESSAGES': false });
					});
					channels[channelid].status = "stopped";
					bot.channels.get(channels[channelid].id).setTopic("Server offline");
				} else {
					if (message.charAt(0) == '[') bot.channels.get(channels[channelid].id).sendMessage(message);
					else bot.channels.get(channels[channelid].id).sendMessage("[" + channels[channelid].name + "] " + message);
				}
			}
		} else return;
	}
});

//Receive input from Discord
bot.on('message', (message) => {
	//Ignore own messages
	if (message.author == bot.user) return;
	//Ignore DMs
	if (!message.member) return;
	//Set the prefix
	let prefix = "::";

	//If message is a command, run the correct command. Else, forward to the proper server (if channel is registered)
	if (message.content.startsWith(prefix)) {
		let command = message.cleanContent.substring(2).split(" ");
		if (publiccommands[command[0]]) {
			publiccommands[command[0]](message, command);
			return;
		}
		if (!message.member.roles.has(message.guild.roles.find("name", "Moderators").id)) return;
		if (admincommands[command[0]]) admincommands[command[0]](message, command);
		else return;
	} else {
		//Get an array of servers that match this channel id. End function if array length is 0 (unreigstered channel)
		let sendto = getChannelKey(channels, message.channel.id);
		var name;
		if (message.member.nickname === null) name = message.author.username;
		else name = message.member.nickname;
		if (sendto === null) return;
		while (!safe) {
			//Wait here until safe to continue, should not happen often
		}
		var addon;
		if (channels[sendto].type == "chat") addon = "chat$" + sendto; //Setup to send to a chat channel
		else if (channels[sendto].type == "server" || channels[sendto].type == "pvp-main") addon = sendto; //Setup to send to a server
		else if (channels[sendto].type == "pvp") {
			//Setup to send to a PVP server
			let serverid = sendto.substring(0, sendto.indexOf("-"));
			let force_name = sendto.substring(sendto.indexOf("-") + 1);
			addon = "PVP$" + serverid + "$" + force_name;
		} else return;
		var sendstring;
		if (channels[sendto].type == "pvp-main") sendstring = clean_message(addon + "$[DISCORD] " + name + "(shout): " + message.cleanContent) + "\n";
		else sendstring = clean_message(addon + "$[DISCORD] " + name + ": " + message.cleanContent) + "\n";
		safeWrite(sendstring);
	}
});

//Leaves any server that isn't 3Ra
bot.on('ready', () => {
	safeWrite("ready$\n");
	bot.user.setGame("3Ra - Factorio | ::help");
	//bot.guilds.forEach((guildobj, guildid, collection) => {
	bot.guilds.forEach((guildobj, guildid) => {
		if (guildid != "143772809418637313") guildobj.leave();
	});
	//Set any currently existing PvP servers back up for fresh player lists
	for (var key in channels) {
		if (channels[key].type == "pvp-main" || channels[key].type == "server") playerlists[key] = {};
	}
});

//If the bot joins a server that isn't 3Ra, immediately leave it
bot.on('guildCreate', (guild) => {
	if (guild.id != "143772809418637313") guild.leave();
});

//WARNING: THIS TOKEN IS NOT TO BE SHARED TO THE PUBLIC
var token = JSON.parse(fs.readFileSync("./token.json", "utf8"));
bot.login(token);
