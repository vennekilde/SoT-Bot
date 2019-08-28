import * as Discord  from "discord.js";
import * as moment from "moment";
import { scheduleJob } from "node-schedule";

let client = new Discord.Client();
client.login(process.env.BOT_TOKEN);

client.on("ready", async () => { // When the bot is ready
    console.log("Ready!"); // Log "Ready!"
});
client.on('messageReactionAdd', async (event: Discord.MessageReaction, user: Discord.User) => {
    try {
        if(event.message.channel.id === raidSignupChannelId && user.id !== client.user.id){
            for(let reaction of event.message.reactions.array()){
                if(reaction.count === 1) {
                    continue;
                }
                if(reaction.emoji.identifier === event.emoji.identifier) {
                    continue;
                }
                
                reaction.remove(user);
            }
        }
        return true;
    } catch(e){
        console.log(e);
    }
})
client.on('raw', packet => {
    // We don't want this to run on unrelated packets
    if (!['MESSAGE_REACTION_ADD', 'MESSAGE_REACTION_REMOVE'].includes(packet.t)) return;
    // Grab the channel to check the message from
    const channel = client.channels.get(packet.d.channel_id);
    // There's no need to emit if the message is cached, because the event will fire anyway for that
    if (!(channel instanceof Discord.TextChannel) || channel.messages.has(packet.d.message_id)) return;
    // Since we have confirmed the message is not cached, let's fetch it
    channel.fetchMessage(packet.d.message_id).then(message => {
        // Emojis can have identifiers of name:id format, so we have to account for that case as well
        const emoji = packet.d.emoji.id ? `${packet.d.emoji.name}:${packet.d.emoji.id}` : packet.d.emoji.name;
        // This gives us the reaction we need to emit the event properly, in top of the message object
        const reaction = message.reactions.get(emoji);
        // Adds the currently reacting user to the reaction's users collection.
        if (reaction) reaction.users.set(packet.d.user_id, client.users.get(packet.d.user_id));
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
const events = [
    {
        message: '<@&602939206498779137>\n' +
                 '╓──────────────────────────────────╖\n' +
                 '║ Closed raid\n'+
                 '║ Raid starts at $date\n'+
                 '╙──────────────────────────────────╜',
        date: {
            dayOfWeek: 6, //Sunday
            hour: 20
        },
    },
    {
        message: '<@&602939206498779137>\n' +
                 '╓──────────────────────────────────╖\n' +
                 '║ Closed raid\n'+
                 '║ Raid starts at $date\n'+
                 '╙──────────────────────────────────╜',
        date: {
            dayOfWeek: 2, //Wednesday
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
]

async function postEventMsg() {
    let channel = client.channels.get(raidSignupChannelId)
    if(channel instanceof Discord.TextChannel){
        await channel.fetchMessages();
        //Delete old messages
        for(let message of channel.messages.values()) {
            await message.delete();
        }

        //Create new messages
        for(let i = 0; i < events.length; i++){
            let event = events[i];
            let text: string = '';
            if(i !== 0){
                text += '\n━━━━━━━━━━━━━━\n\n';
            }
            let date = getNextDayOfWeek(new Date(), event.date.dayOfWeek + 1);
            date.setHours(event.date.hour, 0, 0, 0);
            let dateStr = moment(date).format('MMMM Do YYYY, HH:mm:ss G\\\MTZ');
            text += event.message.replace('$date', dateStr);
            text += "\n";
            let msg = await channel.send(text);
            for (let emoji of emojies){
                if(msg instanceof Discord.Message){
                    await msg.react(emoji);
                }
            }
        }
    }
}

function getNextDayOfWeek(date: Date, dayOfWeek: number) {
    // Code to check that date and dayOfWeek are valid left as an exercise ;)
    var resultDate = new Date(date.getTime());
    resultDate.setDate(date.getDate() + (7 + dayOfWeek - date.getDay()) % 7);
    return resultDate;
}

scheduleJob("0 0 20 * * 4", () => {
    postEventMsg();
})
scheduleJob("0 0 20 * * 3", async () => {
    postOverview(0);
})
scheduleJob("0 0 20 * * 7", async () => {
    postOverview(1);
})


async function postOverview(index: number) {
    let channel = client.channels.get(raidSignupChannelId);
    if(channel instanceof Discord.TextChannel){
        let messages = channel.messages.array();
        if(messages.length < index + 1){
            return;
        }
        let overviewMsg = "**Overview:** \n\n";
        let message = messages[index];
        for(let emoji of emojies) {
            let reactions = await message.reactions.get(emoji);
            if(reactions.count === 1){
                continue; //Skip bot
            }
            overviewMsg += `<:${emoji}>${emoji.split(':')[0]}: \n`; //<${emoji}> :sad: <:sad:>  <&${emoji}> ${emoji}
            overviewMsg += reactions.users.filter(user => user.id !== client.user.id).map(user => `<@${user.id}>`).join('\n') + "\n\n";
        }
        let overviewChannel = client.channels.get(raidOverviewChannelId);
        if(overviewChannel instanceof Discord.TextChannel){
            await overviewChannel.sendMessage(overviewMsg);
        }
    }
}

/*
function generate(timestamp: Date | String | Number = Date.now()) {
    if (timestamp instanceof Date) timestamp = timestamp.getTime();
    if (typeof timestamp !== 'number' || isNaN(timestamp)) {
      throw new TypeError(
        `"timestamp" argument must be a number (received ${isNaN(timestamp) ? 'NaN' : typeof timestamp})`
      );
    }
    if (INCREMENT >= 4095) INCREMENT = 0;
    // eslint-disable-next-line max-len
    const BINARY = `${(timestamp - EPOCH).toString(2).padStart(42, '0')}0000100000${(INCREMENT++).toString(2).padStart(12, '0')}`;
    return Util.binaryToID(BINARY);
}*/