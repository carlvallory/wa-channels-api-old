const qrcode = require('qrcode-terminal');
const axios = require('axios');
const http = require('http');
const url = require('url');
const { Client, NoAuth } = require('whatsapp-web.js');
const nextBase64 = require('next-base64');

const API_KEY = process.env.API_KEY || "";
const RECEIVER_URL = process.env.WA_RECEIVER_URL;
const RECEIVER_PATH = process.env.WA_RECEIVER_PATH;
const HOSTNAME = process.env.HTTP_HOSTNAME;
const PORT = process.env.HTTP_PORT || 3087;

const laramsgURL = "http://phplaravel-1040427-3658816.cloudwaysapps.com/msg";

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
        body: {
            text: "",
            image: null
        },
        image: null,
        to: {
            id: null,
            name: null,
            user: null
        },
        from: {
            id: null,
            name: null,
            user: null,
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

client.on('ready', async () => {
    msgObj.msg.to.id    = client.info.wid.user;
    msgObj.msg.to.user  = client.info.wid.user;
    msgObj.msg.to.name  = client.info.wid.name;

    let getStatus = await getSendLogin(String(msgObj.msg.to.user));

    console.log(client.info.wid.user);
    console.log('Client is Ready');
});

client.on('message', async msg => {
    const isBroadcast = msg.broadcast || msg.isStatus;

    if(msg.type != "sticker" && msg.type != "video"){ //permitir imagenes // && msg.type != "image"
        if(msg.hasMedia == false){
            //type chat
            if(msg.type == "chat"){
                const contact = await msg.getContact();
                const profilePicture = await contact.getProfilePicUrl();

                msgObj.msg.id           = msg.id.id;
                msgObj.msg.body.text    = nextBase64.encode(String(msg.body));
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

                while(msgObj.msg.body.text.includes("/") === true) {
                    mbi++;
                    msgObj.msg.body.text = nextBase64.encode(String(msgObj.msg.body.text));
                }

                msgObj.msg.body.text = msgObj.msg.body.text + "_" + mbi;

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
                    let getMsg = await getSendMsg(msg.id.id, msgObj.msg.body.text, msgObj);
                    let getStatus = await getSendStatus(String(msgObj.msg.id));
                    console.log(getMsg);
                }
            }
        }

        if(msg.hasMedia !== false){
            if(msg.type=="image") {

                const contact = await msg.getContact();
                const profilePicture = await contact.getProfilePicUrl();

                msgObj.msg.id           = msg.id.id;
                msgObj.msg.body.text    = nextBase64.encode(String(msg.caption));
                msgObj.msg.to.id        = msg.to;
                msgObj.msg.from.id      = msg.from;

                if(msg.type=="image") {
                    msgObj.msg.body.image = nextBase64.encode(String(msg.body));
                } else {
                    msgObj.msg.body.image = null;
                }

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
                let mii = 1;
                let mfni = 1;
                let mppi = 1;

                while(msgObj.msg.body.text.includes("/") === true) {
                    mbi++;
                    msgObj.msg.body.text = nextBase64.encode(String(msgObj.msg.body.text));
                }

                msgObj.msg.body.text = msgObj.msg.body.text + "_" + mbi;

                if(msgObj.msg.body.image != null) {
                    while(msgObj.msg.body.image.includes("/") === true) {
                        mii++;
                        msgObj.msg.body.image = nextBase64.encode(String(msgObj.msg.body.image));
                    }
                    msgObj.msg.body.image = msgObj.msg.body.image + "_" + mii;
                }

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

                if(msg.id.remote != 'status@broadcast') {
                    if(isBroadcast == false) {
                        let getMsg = await getSendMsg(msg.id.id, msgObj.msg.body.text, msgObj);
                        let getStatus = await getSendStatus(String(msgObj.msg.id));
                        console.log(getMsg);
                    }
                    console.log(msg);
                }
            }
        }
    }
});

client.on('disconnected', (reason) => {
    console.log('Client is disconected: ', reason);
    client.initialize();
});

client.initialize();

(async() => {
    msgObj.msg.id               = 1;
    msgObj.msg.body.text             = nextBase64.encode("Muy Buenos Días!!!");
    msgObj.msg.body.text             = msgObj.msg.body.text + "_1";
    msgObj.msg.to.id            = 10;
    msgObj.msg.from.id          = 11;
    msgObj.msg.from.name        = nextBase64.encode("name");
    msgObj.msg.from.name        = msgObj.msg.from.name + "_1";
    msgObj.msg.author           = "";
    msgObj.msg.participant      = false;
    msgObj.msg.profile.picture  = null;

    let getMsg = await getSendMsg(msgObj.msg.id, msgObj.msg.body.text, msgObj);
    let getStatus = await getSendStatus(String(msgObj.msg.id));
    
    console.log(getMsg);
  })()


async function getSendMsg(id, body, msgObj) {
    let author = "";
    let name = "";
    let profilePicture = null;
    let image = null;

    let url = "id/"+id+"/from/"+msgObj.msg.from.id+"/to/"+msgObj.msg.to.id+"/body/"+body

    if(msgObj.msg.body.image !== null && msgObj.msg.body.image != '' && msgObj.msg.body.image !== undefined) {
        image = msgObj.msg.body.image;
        url = url + "/image/"+image;
    } else {
        url = url + "/image/00"
    }

    if(msgObj.msg.from.name !== null && msgObj.msg.from.name != '' && msgObj.msg.from.name !== undefined) {
        name = msgObj.msg.from.name;
        url = url + "/name/"+name;
    } else {
        url = url + "/name/00"
    }

    if(msgObj.msg.profile.picture !== null && msgObj.msg.profile.picture != '' && msgObj.msg.profile.picture !== undefined) {
        profilePicture = msgObj.msg.profile.picture;
        url = url + "/picture/"+profilePicture;
    } else {
        url = url + "/picture/00"
    }

    if(msgObj.msg.author !== null && msgObj.msg.author != '' && msgObj.msg.author !== undefined) {
        author = msgObj.msg.author;
        url = url + "/author/"+author;
    } else {
        url = url + "/author/00"
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

async function getSendLogin(user) {
    encodedUser = nextBase64.encode(user);
    let url = "/login/"+encodedUser; 

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

async function getSendStatus(id) {
    encodedId = nextBase64.encode(id);
    let url = "/schedules/"+encodedId; 

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

process.on('unhandledRejection', (error) => {
    console.error('Unhandled Promise Rejection:', error);
});

const server = http.createServer((req, res) => {
    const baseURL =  req.protocol + '://' + req.headers.host + '/';
    const reqUrl = new URL(req.url,baseURL);

    if(reqUrl.pathname == "/logout") {
        client.getState().then((result) => {
            if(result.match("CONNECTED")){
                var q = url.parse(req.url, true).query;
                var user = q.user;
                var logout = setLogout(user);

                res.end(JSON.stringify({ status: 200, message: 'Log Out Success', data: user }));
            } else {
                console.error("Whatsapp Client not connected");

                res.end(JSON.stringify({ status: 500, message: 'Client State Null', data: user }));
            }
        });
    }
    
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end();
}).listen(PORT); 

function setLogout(user) { 
    try {
        client.logout();
        return true;
    } catch (error) {
        console.error(error.response);
        return false;
    }
}