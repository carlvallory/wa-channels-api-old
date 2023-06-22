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

let msgObj = { 
    updated: false,
    msg: {
        id: null,
        body: "",
        to: {
            id: null
        },
        from: {
            id: null,
            name: null,
            image: null
        },
        profile: {
            picture: null
        },
        author: null,
        participant: false
    } 
  };

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
    const isBroadcast = msg.broadcast || msg.isStatus;

    if(msg.type != "sticker" && msg.type != "video" && msg.type != "image"){ //permitir imagenes
        if(msg.hasMedia == false){
            //type chat
            if(msg.type == "chat"){
                const contact = await msg.getContact();
                const profilePicture = await contact.getProfilePicUrl();

                msgObj.msg.id           = msg.id.id;
                msgObj.msg.body         = nextBase64.encode(String(msg.body));
                msgObj.msg.to.id        = msg.to;
                msgObj.msg.from.id      = msg.from;

                if(msg._data.notifyName !== undefined) { 
                    msgObj.msg.from.name = nextBase64.encode(String(msg._data.notifyName));
                } else {
                    msgObj.msg.from.name = msg.from;
                }

                if(profilePicture !== undefined) { 
                    msgObj.msg.profile.picture = nextBase64.encode(String(profilePicture));
                } else {
                    msgObj.msg.profile.picture = null;
                }

                let mbi = 1;
                let mfni = 1;
                let mppi = 1;

                while(msgObj.msg.body.includes("/") === true) {
                    mbi++;
                    msgObj.msg.body = nextBase64.encode(String(msgObj.msg.body));
                }

                msgObj.msg.body = msgObj.msg.body + "_" + mbi;

                while(msgObj.msg.from.name.includes("/") === true) {
                    mfni++;
                    msgObj.msg.from.name = nextBase64.encode(String(msgObj.msg.from.name));
                }
                
                msgObj.msg.from.name = msgObj.msg.from.name + "_" + mfni;

                if(msgObj.msg.profile.picture != null) {
                    while(msgObj.msg.profile.picture.includes("/") === true) {
                        mppi++;
                        msgObj.msg.profile.picture = nextBase64.encode(String(msgObj.msg.profile.picture));
                    }

                    msgObj.msg.profile.picture = msgObj.msg.profile.picture + "_" + mppi;
                }

                msgObj.msg.author       = msg.author;
                msgObj.msg.participant  = msg.id.participant;
                msgObj.updated = true;
                
                
                console.log('ID: ', msg.id.id);
                console.log('MESSAGE RECEIVED', msg.body);
                //console.log(msg);

                if(isBroadcast == false) {
                    let getMsg = await getSendMsg(msg.id.id, msgObj.msg.body, msgObj);
                    console.log(getMsg);
                }
            }
        }
    }
});

client.initialize();

(async() => {
    msgObj.msg.id               = 1;
    msgObj.msg.body             = nextBase64.encode("Muy Buenos Días!!!");
    msgObj.msg.body             = msgObj.msg.body + "_1";
    msgObj.msg.to.id            = 10;
    msgObj.msg.from.id          = 11;
    msgObj.msg.from.name        = nextBase64.encode("name");
    msgObj.msg.from.name        = msgObj.msg.from.name + "_1";
    msgObj.msg.author           = "";
    msgObj.msg.participant      = false;
    msgObj.msg.profile.picture  = null;

    let getMsg = await getSendMsg(msgObj.msg.id, msgObj.msg.body, msgObj);
    console.log(getMsg);
  })()


async function getSendMsg(id, body, msgObj) {
    let author = "";
    let name = "";
    let profilePicture = null;

    let url = "id/"+id+"/from/"+msgObj.msg.from.id+"/to/"+msgObj.msg.to.id+"/body/"+body

    if(msgObj.msg.from.name !== null && msgObj.msg.from.name != '' && msgObj.msg.from.name !== undefined) {
        name = msgObj.msg.from.name;
        url = url + "/name/"+name;
    }
    if(msgObj.msg.profile.picture !== null && msgObj.msg.profile.picture != '' && msgObj.msg.profile.picture !== undefined) {
        profilePicture = msgObj.msg.profile.picture;
        url = url + "/profilepicture/"+profilePicture;
    }
    if(msgObj.msg.author !== undefined) {
        author = msgObj.msg.author;
        url = url + "/author/"+author;
    }

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
