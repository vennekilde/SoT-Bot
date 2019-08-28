import * as eris from "eris";
import * as moment from "moment";
import { scheduleJob } from "node-schedule";

let bot = new eris.Client(process.env.BOT_TOKEN,
    {
        autoreconnect: true,
        
    }
);

bot.on("ready", async () => { // When the bot is ready
    console.log("Ready!"); // Log "Ready!"
    //postEventMsg();
});
bot.on('messageReactionAdd', async (event: {id: string, channel: eris.TextChannel}, emoji: {id: string, name: string}, userId: string) => {
    try {
        if(event.channel.id === raidSignupChannelId && userId !== bot.user.id){
            let msg = await event.channel.getMessage(event.id);
            for(let reaction of Object.keys(msg.reactions)){
                if(reaction === emoji.name + ":" + emoji.id) {
                    continue;
                }
                await msg.removeReaction(reaction, userId);
            }
        }
    } catch(e){
        console.log(e);
    }
})

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
    let channel = bot.getChannel(raidSignupChannelId)
    //Delete old messages
    if(channel instanceof eris.TextChannel){
        channel.getMessages().then(async messages => {
            for(let message of messages){
                if(channel instanceof eris.TextChannel){
                    await channel.deleteMessage(message.id);
                }
            }
        })
    }
    //Create new messages
    if(channel instanceof eris.TextChannel){
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
            let msg = await channel.createMessage(text);
            for (let emoji of emojies){
                msg.addReaction(emoji);
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

bot.connect(); // Get the bot to connect to Discord

scheduleJob("* * 19 * * 3", () => {
    postEventMsg();
})
scheduleJob("* * 19 * * 2", async () => {
    postOverview(0);
})
scheduleJob("* * 19 * * 6", async () => {
    postOverview(1);
})


async function postOverview(index: number) {
    let channel = bot.getChannel(raidSignupChannelId);
    if(channel instanceof eris.TextChannel){
        let messages = await bot.getMessages(raidSignupChannelId);
        if(messages.length < index + 1){
            return;
        }
        let overviewMsg = "**Overview:** \n\n";
        let message = messages[index];
        for(let emoji of emojies) {
            let users = await message.getReaction(emoji);
            if(users.length === 1){
                continue; //Skip bot
            }
            overviewMsg += `${emoji.split(':')[0]}: \n`; //<${emoji}> :sad: <:sad:>  <&${emoji}> ${emoji}
            overviewMsg += users.filter(user => user.id !== bot.user.id).map(user => user.mention).join('\n') + "\n\n";
        }
        let overviewChannel = bot.getChannel(raidOverviewChannelId);
        if(overviewChannel instanceof eris.TextChannel){
            overviewChannel.createMessage(overviewMsg);
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