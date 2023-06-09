const qrcode = require('qrcode-terminal');
const axios = require('axios');
const { Client, NoAuth } = require('whatsapp-web.js');
const nextBase64 = require('next-base64');

const API_KEY = "";
const RECEIVER_URL = process.env.WA_RECEIVER_URL;
const RECEIVER_PATH = process.env.WA_RECEIVER_PATH;

const laramsgURL = "http://phplaravel-937280-3593957.cloudwaysapps.com/msg";

const client = new Client(
    {
        authStrategy: new NoAuth(),
        puppeteer: {
            args: ['--no-sandbox'],
        }
    }
);

client.on('qr', async (qr) => {
    console.log('QR RECEIVED', qr);
    qrcode.generate(qr, {small: true});

    let getQR = await getSendQR(qr);
});

client.on('authenticated', () => {
    console.log('AUTHENTICATED');
});

client.on('auth_failure', msg => {
    // Fired if session restore was unsuccessful
    console.error('AUTHENTICATION FAILURE', msg);
});

client.on('ready', () => {
    console.log('Client is Ready');
});

client.on('message', async msg => {
    if(msg.type != "sticker" && msg.type != "video" && msg.type != "image"){
        if(msg.hasMedia == false){
            //type chat
            if(msg.type == "chat"){
                console.log('ID: ', msg.id.id);
                console.log('MESSAGE RECEIVED', msg.body);
                let getMsg = await getSendMsg(msg.id.id, msg.body);
                console.log(getMsg);
            }
        }
    }
});

client.initialize();

(async() => {
    let getMsg = await getSendMsg(1, "hola que tal");
    console.log(getMsg);
  })()


async function getSendMsg(id, body) {
    let url = "id/"+id+"/body/"+body;

    const laramsgApi = axios.create({
        baseURL: laramsgURL,
        params:
        {
            key: API_KEY
        },
    });

    console.warn(laramsgURL);
    console.warn(url);

    try {
        const { data } = await laramsgApi.get(url);
        console.log(data);
        return data;
    } catch (error) {
        console.error(error.response);
    }
}

async function getSendQR(qr) {
    encodedQr = nextBase64.encode(qr);
    let url = "/qr/"+encodedQr; 

    const laramsgApi = axios.create({
        baseURL: laramsgURL,
        params:
        {
            key: API_KEY
        },
    });

    console.warn(laramsgURL);
    console.warn(url);

    try {
        const { data } = await laramsgApi.get(url);
        console.log(data);
        return data;
    } catch (error) {
        console.error(error.response);
    }
}
