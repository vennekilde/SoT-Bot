"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Discord = require("discord.js");
const moment = require("moment");
const momentTimezone = require("moment-timezone");
const node_schedule_1 = require("node-schedule");
let client = new Discord.Client();
client.login(process.env.BOT_TOKEN);
client.on("ready", async () => {
    console.log("Ready!"); // Log "Ready!"
});
client.on('messageReactionAdd', async (event, user) => {
    try {
        if (event.message.channel.id === raidSignupChannelId && user.id !== client.user.id) {
            for (let reaction of event.message.reactions.array()) {
                if (reaction.count === 1) {
                    continue;
                }
                if (reaction.emoji.identifier === event.emoji.identifier) {
                    continue;
                }
                await reaction.remove(user);
            }
            updateWhoIsJoining(event.message);
        }
        return true;
    }
    catch (e) {
        console.log(e);
    }
});
client.on('messageReactionRemove', async (event, user) => {
    try {
        if (event.message.channel.id === raidSignupChannelId && user.id !== client.user.id) {
            updateWhoIsJoining(event.message);
        }
        return true;
    }
    catch (e) {
        console.log(e);
    }
});
client.on('raw', packet => {
    // We don't want this to run on unrelated packets
    if (!['MESSAGE_REACTION_ADD', 'MESSAGE_REACTION_REMOVE'].includes(packet.t))
        return;
    // Grab the channel to check the message from
    const channel = client.channels.get(packet.d.channel_id);
    // There's no need to emit if the message is cached, because the event will fire anyway for that
    if (!(channel instanceof Discord.TextChannel) || channel.messages.has(packet.d.message_id))
        return;
    // Since we have confirmed the message is not cached, let's fetch it
    channel.fetchMessage(packet.d.message_id).then(message => {
        // Emojis can have identifiers of name:id format, so we have to account for that case as well
        const emoji = packet.d.emoji.id ? `${packet.d.emoji.name}:${packet.d.emoji.id}` : packet.d.emoji.name;
        // This gives us the reaction we need to emit the event properly, in top of the message object
        const reaction = message.reactions.get(emoji);
        // Adds the currently reacting user to the reaction's users collection.
        if (reaction)
            reaction.users.set(packet.d.user_id, client.users.get(packet.d.user_id));
        // Check which type of event it is before emitting
        if (packet.t === 'MESSAGE_REACTION_ADD') {
            client.emit('messageReactionAdd', reaction, client.users.get(packet.d.user_id));
        }
        if (packet.t === 'MESSAGE_REACTION_REMOVE') {
            client.emit('messageReactionRemove', reaction, client.users.get(packet.d.user_id));
        }
    });
});
const raidSignupChannelId = '614621107642695682';
const raidOverviewChannelId = '614639046198689845';
const membersRoleId = '602939206498779137';
const events = [
    {
        message: '<@&602939206498779137>\n' +
            '╓──────────────────────────────────╖\n' +
            '║ Closed raid Sunday\n' +
            '║ Raid starts at $date\n' +
            '╙──────────────────────────────────╜',
        date: {
            dayOfWeek: 6,
            hour: 20
        },
    },
    {
        message: '<@&602939206498779137>\n' +
            '╓──────────────────────────────────╖\n' +
            '║ Closed raid Wednesday\n' +
            '║ Raid starts at $date\n' +
            '╙──────────────────────────────────╜',
        date: {
            dayOfWeek: 2,
            hour: 20
        },
    }
];
const emojies = [
    "Daredevil:614635453475323904",
    "Firebrand:614632660756594698",
    "Herald:614635418822115330",
    "Mirage:614632725436956682",
    "Scourge:614632522751410186",
    "Scrapper:614632521593782272",
    "Spellbreaker:614635528700297238",
    "Tempest:614632623133818890",
    "NotHere:614635815255015437"
];
async function postEventMsg() {
    console.log('Posting new raid message');
    let channel = client.channels.get(raidSignupChannelId);
    if (channel instanceof Discord.TextChannel) {
        await channel.fetchMessages();
        //Delete old messages
        for (let message of channel.messages.values()) {
            if (!message.pinned && message.author.id == client.user.id) {
                await message.delete();
            }
        }
        //Create new messages
        for (let i = 0; i < events.length; i++) {
            let event = events[i];
            let text = '';
            if (i !== 0) {
                text += '\n━━━━━━━━━━━━━━\n\n';
            }
            let date = getNextDayOfWeek(momentTimezone.tz("Europe/Copenhagen"), event.date.dayOfWeek + 1);
            date.hours(event.date.hour).minutes(0).seconds(0);
            let dateStr = moment(date).format('MMMM Do YYYY, HH:mm:ss G\\\MTZ');
            text += event.message.replace('$date', dateStr);
            text += "\n";
            let eventMsg = await channel.send(text);
            let textOverview = await getOverviewFromIndex(i);
            await channel.send(textOverview.msg);
            for (let emoji of emojies) {
                if (eventMsg instanceof Discord.Message) {
                    await eventMsg.react(emoji);
                }
            }
        }
    }
    else {
        console.log('Could not post event msg, channel is not a TextChannel');
    }
}
async function updateWhoIsJoining(message) {
    let channel = client.channels.get(raidSignupChannelId);
    if (channel instanceof Discord.TextChannel) {
        let overviewMessage = (await channel.fetchMessages({ after: message.id, limit: 1 })).first();
        let overviewText = await getOverview(message);
        overviewMessage.edit(overviewText.msg);
    }
    else {
        console.log('Could not update who is joining msg, channel is not a TextChannel');
    }
}
function getNextDayOfWeek(date, dayOfWeek) {
    // Code to check that date and dayOfWeek are valid left as an exercise ;)
    var resultDate = moment(date);
    resultDate.day(date.day() + (7 + dayOfWeek - date.day()) % 7);
    return resultDate;
}
node_schedule_1.scheduleJob({ hour: 18, dayOfWeek: 4, minute: 0 }, () => {
    postEventMsg();
});
node_schedule_1.scheduleJob({ hour: 18, dayOfWeek: 3, minute: 0 }, () => {
    postOverview(0);
});
node_schedule_1.scheduleJob({ hour: 18, dayOfWeek: 7, minute: 0 }, () => {
    postOverview(1);
});
async function postOverview(eventIndex) {
    console.log('Posting overview with index: ' + eventIndex);
    let overviewMsg = await getOverviewFromIndex(eventIndex);
    if (overviewMsg !== undefined) {
        // Find users who never responded'
        let members = client.guilds.first().roles.get(membersRoleId).members;
        overviewMsg.msg += `\n\nMembers who never responded: \n`;
        let reactionUsers = members.filter(user => !overviewMsg.users.has(user.id));
        overviewMsg.msg += reactionUsers
            .sort((a, b) => a.nickname.localeCompare(b.nickname))
            .map(user => `<@${user.id}>`).join(', ') + "\n\n";
        let overviewChannel = client.channels.get(raidOverviewChannelId);
        if (overviewChannel instanceof Discord.TextChannel) {
            await overviewChannel.sendMessage(overviewMsg.msg);
        }
    }
    else {
        console.log('Could not get overviewMsg from index');
    }
}
async function getOverviewFromIndex(eventIndex) {
    let channel = client.channels.get(raidSignupChannelId);
    if (channel instanceof Discord.TextChannel) {
        let messages = (await channel.fetchMessages()).array();
        let actualIndex = await getMessageIndex(eventIndex, messages);
        let message = messages[actualIndex];
        return await getOverview(message);
    }
}
async function getOverview(message) {
    let overviewMsg = "**Who is joining:** \n\n";
    let users = new Discord.Collection();
    for (let emoji of emojies) {
        let reactions = await message.reactions.get(emoji);
        if (reactions == null || reactions.count === 1) {
            continue; //Skip bot
        }
        let users = await reactions.fetchUsers();
        overviewMsg += `<:${emoji}>${emoji.split(':')[0]}: \n`;
        let reactionUsers = users.filter(user => user.id !== client.user.id);
        reactionUsers.forEach(u => users.set(u.id, u));
        overviewMsg += reactionUsers
            .sort((a, b) => a.username.localeCompare(b.username))
            .map(user => `<@${user.id}>`).join('\n') + "\n\n";
    }
    return { msg: overviewMsg, users: users };
}
async function getMessageIndex(eventIndex, messages) {
    let actualIndex = 0;
    // Skip raid message along with who is joining message
    let messagesToSkip = eventIndex * 2;
    for (let i = 0; i < messages.length; i++) {
        if (messages[i].author.id !== client.user.id) {
            continue;
        }
        if (messagesToSkip === 0) {
            actualIndex = i;
        }
        messagesToSkip--;
    }
    return actualIndex;
}
//# sourceMappingURL=bot-discord.js.map