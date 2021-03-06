import * as Discord  from "discord.js";
import * as moment from "moment";
import * as momentTimezone from "moment-timezone";
import { scheduleJob } from "node-schedule";

// Discord channels
const raidSignupChannelId = '614621107642695682';
const raidOverviewChannelId = '614639046198689845';
// Discord roles
const membersRoleId = '602939206498779137';
const ignoreMembersWithRoles = [
    '621446430606884865'
]

// Discord emojies
const lateEmoji = '🇱';
const emojies = [
    //"Daredevil:614635453475323904",
    "Dragonhunter:797812158283907113",
    "Firebrand:614632660756594698",
    "Herald:614635418822115330",
    "Chrono:743612271191916594",
    "Scourge:614632522751410186",
    "Scrapper:614632521593782272",
    "Soulbeast:720001300376453201",
    "Berserker:811006739696189441",
    "Spellbreaker:614635528700297238",
    "Tempest:614632623133818890",
    "NotHere:614635815255015437"
]

// Events to post
const events = [
    {
        message: '<@&602939206498779137>\n' +
                 '╓──────────────────────────────────╖\n' +
                 '║ Closed raid Sunday\n' +
                 '║ Raid starts at $date\n' +
                 '║ If Late: click 🇱 - Sign up with class *Even if you click 🇱*\n'+
                 '╙──────────────────────────────────╜',
        date: {
            dayOfWeek: 6, //Sunday
            hour: 20
        },
    },
    {
        message: '<@&602939206498779137>\n' +
                 '╓──────────────────────────────────╖\n' +
                 '║ Closed raid Wednesday\n' +
                 '║ Raid starts at $date\n' +
                 '║ If Late: click 🇱 - Sign up with class *Even if you click 🇱*\n'+
                 '╙──────────────────────────────────╜',
        date: {
            dayOfWeek: 2, //Wednesday
            hour: 20
        },
    },
    {
        message: '<@&602939206498779137>\n' +
                 '╓──────────────────────────────────╖\n' +
                 '║ Closed raid Thursday\n' +
                 '║ Raid starts at $date\n' +
                 '║ If Late: click 🇱 - Sign up with class *Even if you click 🇱*\n'+
                 '╙──────────────────────────────────╜',
        date: {
            dayOfWeek: 3, //Thurdays
            hour: 20
        },
    },
];

scheduleJob({hour: 21, dayOfWeek: 4, minute: 0}, () => {
    postEventMsg();
})
scheduleJob({hour: 19, dayOfWeek: 3, minute: 0}, () => {
    postOverview(1);
})
scheduleJob({hour: 19, dayOfWeek: 4, minute: 0}, () => {
    postOverview(2);
})
scheduleJob({hour: 19, dayOfWeek: 0, minute: 0}, () => {
    postOverview(0);
})

let client = new Discord.Client();
client.login(process.env.BOT_TOKEN);

client.on("ready", async () => { // When the bot is ready
    // Preload reactions
    console.log('Preloading reactions');
    let channel = await client.channels.fetch(raidSignupChannelId)
    if(channel instanceof Discord.TextChannel){
        await channel.messages.fetch();
        for(let message of channel.messages.cache.array()) {
            if(message.author.id == client.user.id){
                for(let reaction of message.reactions.cache.array()){
                    await (await reaction.fetch()).users.fetch();
                }
            }
        }
    }
    console.log("Ready!"); // Log "Ready!"
});

client.on('messageReactionAdd', async (event: Discord.MessageReaction, user: Discord.User) => {
    try {
        if(event.message.channel.id === raidSignupChannelId && user.id !== client.user.id){
            console.log('User ' + user.username + ' added reaction '+ event.emoji.identifier + ' to msg ' + event.message.id)
            // Do not remove reactions, if the reaction was being late
            let updateOverview = true
            if (event.emoji.name !== lateEmoji) {
                for (let reaction of event.message.reactions.cache.array()) {
                    // Skip own bot reactions
                    if (reaction.count <= 1) {
                        continue;
                    }
                    // Skip late reactions
                    if (reaction.emoji.name === lateEmoji) {
                        continue;
                    }
                    // Skip reaction if they are the same as the one added
                    if (reaction.emoji.identifier === event.emoji.identifier) {
                        continue;
                    }
                    // Skip if user didn't react with this reaction
                    if (!reaction.users.cache.has(user.id)) {
                        continue;
                    }
                    console.log('Removing reaction ' + reaction.emoji.identifier + ' from msg ' + event.message.id + ' by user ' + user.username);
                    reaction.users.remove(user);
                    // The remove event will trigger and update who is joining
                    updateOverview = false
                }
            }
            if (updateOverview) updateWhoIsJoining(event.message);
        }
        return true;
    } catch(e){
        console.log(e);
    }
})
client.on('messageReactionRemove', async (event: Discord.MessageReaction, user: Discord.User) => {
    try {
        if(event.message.channel.id === raidSignupChannelId && user.id !== client.user.id){
            updateWhoIsJoining(event.message);
        }
        return true;
    } catch(e){
        console.log(e);
    }
})
/*client.on('raw', async packet => {
    // We don't want this to run on unrelated packets
    if (!['MESSAGE_REACTION_ADD', 'MESSAGE_REACTION_REMOVE'].includes(packet.t)) return;
    // Grab the channel to check the message from
    const channel = await client.channels.fetch(packet.d.channel_id);
    // There's no need to emit if the message is cached, because the event will fire anyway for that
    if (!(channel instanceof Discord.TextChannel)) return;
    // Since we have confirmed the message is not cached, let's fetch it
    let message = await channel.messages.fetch(packet.d.message_id)
    // Emojis can have identifiers of name:id format, so we have to account for that case as well
    const emoji = packet.d.emoji.id ? `${packet.d.emoji.name}:${packet.d.emoji.id}` : packet.d.emoji.name;
    // This gives us the reaction we need to emit the event properly, in top of the message object
    const reaction = await message.reactions.cache.get(emoji).fetch();
    // Adds the currently reacting user to the reaction's users collection.
    if (reaction) reaction.users.cache.set(packet.d.user_id, await client.users.fetch(packet.d.user_id));
    // Check which type of event it is before emitting
    if (packet.t === 'MESSAGE_REACTION_ADD') {
        client.emit('messageReactionAdd', reaction, await client.users.fetch(packet.d.user_id));
    }
    if (packet.t === 'MESSAGE_REACTION_REMOVE') {
        client.emit('messageReactionRemove', reaction, await client.users.fetch(packet.d.user_id));
    }
});*/

async function postEventMsg() {
    console.log('Posting new raid message')
    let channel = await client.channels.fetch(raidSignupChannelId)
    if(channel instanceof Discord.TextChannel){
        await channel.messages.fetch();
        //Delete old messages
        for(let message of (await channel.messages.fetch()).values()) {
            if(!message.pinned && message.author.id == client.user.id){
                await message.delete();
            }
        }

        //Create new messages
        for(let i = 0; i < events.length; i++){
            let event = events[i];
            let text: string = '';
            if(i !== 0){
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
            if(eventMsg instanceof Discord.Message){
                for (let emoji of emojies){
                    await eventMsg.react(emoji);
                }
                await eventMsg.react(lateEmoji);
            }
        }
    } else {
        console.log('Could not post event msg, channel is not a TextChannel');
    }
}

async function editEventMessages() {
    console.log('Editing raid messages')
    let channel = await client.channels.fetch(raidSignupChannelId)
    if(channel instanceof Discord.TextChannel){
        //Create new messages
        let messages = (await channel.messages.fetch()).sort((a, b) => a.createdTimestamp - b.createdTimestamp).array();
        for(let i = 0; i < events.length; i++){
            let actualIndex = await getMessageIndex(i, messages);
            let message = messages[actualIndex];

            let event = events[i];
            let text: string = '';
            if(i !== 0){
                text += '\n━━━━━━━━━━━━━━\n\n';
            }
            let date = getNextDayOfWeek(momentTimezone.tz("Europe/Copenhagen"), event.date.dayOfWeek + 1);
            date.hours(event.date.hour).minutes(0).seconds(0);
            let dateStr = moment(date).format('MMMM Do YYYY, HH:mm:ss G\\\MTZ');
            text += event.message.replace('$date', dateStr);
            text += "\n";
            await message.edit(text);
        }
    } else {
        console.log('Could not post event msg, channel is not a TextChannel');
    }
}

//let timer: NodeJS.Timeout;
async function updateWhoIsJoining(message: Discord.Message){
    //clearTimeout(timer);
    //timer = setTimeout(async () => {
        let channel = client.channels.cache.get(raidSignupChannelId);
        if(message.author.id != client.user.id){
            //Assume we cannot edit other peoples messages
            return;
        }
        if(channel instanceof Discord.TextChannel){
            let overviewMessage = (await channel.messages.fetch({after: message.id, limit: 1})).first();
            let overviewText = await getOverview(message);
            overviewMessage.edit(overviewText.msg);
            console.log('Updated who is joining message');
        } else {
            console.log('Could not update who is joining msg, channel is not a TextChannel');
        }
    //}, 1000);
}

function getNextDayOfWeek(date: moment.Moment, dayOfWeek: number): moment.Moment {
    // Code to check that date and dayOfWeek are valid left as an exercise ;)
    var resultDate = moment(date);
    if(date.day() === dayOfWeek){
        resultDate.date(date.date() + 7);
    } else {
        resultDate.day(resultDate.day() + (7 + dayOfWeek - resultDate.day()) % 7);
    }
    return resultDate;
}

async function postOverview(eventIndex: number) {
    console.log('Posting overview with index: ' + eventIndex);
    let overviewMsg = await getOverviewFromIndex(eventIndex);
    if(overviewMsg !== undefined){
        // Find users who never responded'
        let members = (await client.guilds.cache.first().roles.fetch(membersRoleId)).members
            //Ignore users with roles defined in ignoreMembersWithRoles
            .filter(user =>  user.roles.cache.filter(role => ignoreMembersWithRoles.includes(role.id)).size == 0);
        overviewMsg.msg += `\n\nMembers who never responded: \n`;
        let reactionUsers = members.filter(user => !overviewMsg.users.has(user.id));
        overviewMsg.msg += reactionUsers
            .sort((a, b) => a.nickname.localeCompare(b.nickname))
            .map(user => user.displayName).join('\n') + "\n";

        let overviewChannel = client.channels.cache.get(raidOverviewChannelId);
        if(overviewChannel instanceof Discord.TextChannel){
            await overviewChannel.send(overviewMsg.msg);
        }
    } else {
        console.log('Could not get overviewMsg from index');
    }
}


async function getOverviewFromIndex(eventIndex: number): Promise<{msg: string, users: Discord.Collection<string, Discord.User>}> {
    let channel = client.channels.cache.get(raidSignupChannelId);
    if(channel instanceof Discord.TextChannel){
        let messages = (channel.messages.cache).sort((a, b) => a.createdTimestamp - b.createdTimestamp).array();
        let actualIndex = await getMessageIndex(eventIndex, messages);
        console.log('Actual msg index: '+actualIndex);
        let message = messages[actualIndex];
        console.log('Actual msg: '+JSON.stringify(message.content));
        return await getOverview(message);
    }
}

async function getOverview(message: Discord.Message): Promise<{msg: string, users: Discord.Collection<string, Discord.User>}> {
    let overviewMsg = "**Who is joining:** \n\n";
    let users: Discord.Collection<string, Discord.User> = new Discord.Collection();
    for(let emoji of emojies) {
        let overview = await getReactionOverview(message, emoji)
        overviewMsg += overview.msg
        for(let user of overview.users.array()){
            users.set(user.id, user);
        }
    }
    let overview = await getReactionOverview(message, lateEmoji, 'Late')
    overviewMsg += overview.msg
    for(let user of overview.users.array()){
        users.set(user.id, user);
    }
    return {msg: overviewMsg, users: users};
}

async function getReactionOverview(message: Discord.Message, emoji: string, name?: string): Promise<{msg: string, users: Discord.Collection<string, Discord.User>}>{
    let result: string;
    let reaction = message.reactions.resolve(emoji.split(':')[1])
    if(reaction == null) {
        return {msg: '', users: new Discord.Collection()}; //Skip bot
    }

    if(reaction == null || reaction.users.cache.size === 1){
        return {msg: '', users: new Discord.Collection()}; //Skip bot
    }
    result = (name ? emoji : `<:${emoji}>`) + ' ' + (name ? name : emoji.split(':')[0]) + ': \n';
    let reactionUsers = reaction.users.cache.filter(user => user.id !== client.user.id);
    //reactionUsers.forEach(u => reactions.users.set(u.id, u));
    result += reactionUsers
        .sort((a, b) => a.username.localeCompare(b.username))
        .map(user => `<@${user.id}>`).join('\n') + "\n\n";
    return {msg: result, users: reactionUsers}; //Skip bot
}

async function getMessageIndex(eventIndex: number, messages: Array<Discord.Message>){
    let actualIndex = 0;
    // Skip raid message along with who is joining message
    let messagesToSkip = eventIndex * 2; 
    for(let i = 0; i < messages.length; i++){
        if(messages[i].author.id !== client.user.id){
            continue;
        }
        if(messagesToSkip === 0){
            actualIndex = i;
        }
        messagesToSkip--;
    }
    return actualIndex;
}
