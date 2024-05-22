const qrcode = require('qrcode-terminal');
const { Client, NoAuth } = require('whatsapp-web.js');

require('dotenv').config();

const CHANNEL = process.env.CHANNEL || "Prueba";
const DEBUG = process.env.DEBUG || false;
const wwebVersion = '2.2412.54';

const client = new Client(
    {
        authStrategy: new NoAuth(),
        puppeteer: {
            args: ['--no-sandbox'],
        },
        webVersionCache: {
            type: 'remote',
            remotePath: `https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/${wwebVersion}.html`,
        }
    }
);

let msgObj = {
    msg: {
        to: {
            id: null,
            name: null,
            user: null
        }
    },
    updated: false
};

client.on('qr', async (qr) => {
    console.log('QR RECEIVED', qr);
    qrcode.generate(qr, {small: true});
});

client.on('authenticated', () => {
    console.log('AUTHENTICATED');
});

client.on('auth_failure', msg => {
    // Fired if session restore was unsuccessful
    console.error('AUTHENTICATION FAILURE', msg);
});

client.on('ready', async () => {
    msgObj.msg.to.id    = client.info.wid.user;
    msgObj.msg.to.user  = client.info.wid.user;
    msgObj.msg.to.name  = client.info.wid.name;

    console.log(client.info.wid.user);
    console.log('Client is Ready');
    getSendMsg();
});

client.on('message', async msg => {
    const isBroadcast = msg.broadcast || msg.isStatus;

    if(msg.type != "sticker" && msg.type != "image" && msg.type != "video"){
        if(msg.hasMedia == false){
            console.log(msg.type)
            getSendMsg();
        }

    }
});

client.on('disconnected', (reason) => {
    console.log('Client is disconected: ', reason);
    client.initialize();
});

client.initialize().catch(error => {
    console.error('Error initializing WhatsApp client:', error);
});

async function getSendMsg() {
    try {
        let channelId = await getChannelId(CHANNEL); console.log(CHANNEL, channelId);
        if(!Array.isArray(channelId) || channelId.length === 0) { return false; }
        let channelPreviewData = await getChannelById(channelId[0]);
        let sendChannelData = await client.sendMessage(channelId[0], "Hola");
        console.log(sendChannelData);
    } catch(e){
        console.log("Error Occurred: ", e);
        return false;
    }
}

async function getChannelById(channelName) {
    let channel;
    if (typeof client.getChannelById === 'function') {
        try {
            channel = await client.getChannelById(channelName, { getMetadata: true });
        } catch (error) {
            console.error('Error getting channel:', error);
        }
    }

    return channel;
}

async function getChannelId(channelName) {
    const channels = await client.getChannels();
    const channelId = channels
        .filter(channel => channel.name == channelName)
        .map(channel => {
            return channel.id._serialized
        });
    return channelId;
}

//console.log(await client.getWWebVersion());

process.on('unhandledRejection', (error) => {
    console.error('Unhandled Promise Rejection:', error);
});