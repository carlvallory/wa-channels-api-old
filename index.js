const qrcode = require('qrcode-terminal');
const axios = require('axios');
const http = require('http');
const url = require('url');
const { Client, NoAuth } = require('whatsapp-web.js');
const querystring = require('querystring');
const FormData = require('form-data');
const { channel } = require('diagnostics_channel');

require('dotenv').config();

const API_KEY = process.env.API_KEY || null;
const API_URL = process.env.API_URL || null;
const HOST = process.env.HTTP_HOST || "127.0.0.1";
const PORT = process.env.HTTP_PORT || 4003;
const CHANNEL = process.env.CHANNEL || "Prueba";

const client = new Client(
    {
        authStrategy: new NoAuth(),
        puppeteer: {
            args: ['--no-sandbox'],
        }
    }
);

const type = (function(global) {
    var cache = {};
    return function(obj) {
        var key;
        return obj === null ? 'null' // null
            : obj === global ? 'global' // window in browser or global in nodejs
            : (key = typeof obj) !== 'object' ? key // basic: string, boolean, number, undefined, function
            : obj.nodeType ? 'object' // DOM element
            : cache[key = ({}).toString.call(obj)] // cached. date, regexp, error, object, array, math
            || (cache[key] = key.slice(8, -1).toLowerCase()); // get XXXX from [object XXXX], and cache it
    };
}(this));

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

let bodyObj = { 
    object: {
        id: null,
        type: "",
        createdDate: "",
        canonicalUrl: null,
        canonicalUrlMobile: null,
        headlines: null,
        description: null,
        taxonomy: {
            category: null,
            website: null,
            section: null
        },
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

client.initialize();

async function getSendMsg() {
    try{
        let sendMessageData = false;
        let data = await fetchDataFromApis();
        let objResponse = getSendChannelByPost(data);
            
        if(objResponse == false) {
            console.log(false);
        } else {
            sendMessageData = true;
        }

        return sendMessageData;
    } catch(e){
        console.log("Error Occurred: ", e);
    }
}

async function getSendChannelByPost(obj) {
    try {
        let objResponse = await objectPost2json(obj);
        let sendChannelData = false;
        //obj with information to publish

        let channelId = await getChannelId("Vallory");
        if(objResponse != false) {
            sendChannelData = await client.sendMessage(channelId[0], objResponse.object.canonicalUrl);
        }

        return sendChannelData;
    } catch(e){
        console.log("Error Occurred: ", e);
        console.log("l: 143");
        return false;
    }
}

async function getChannelId(channelName) {
    const channels = await client.getChannels();
    const channelId = channels
        .filter(channel => channel.name == channelName)
        .map(channel => {
            return channel.id._serialized
        });

    console.log(channelId);

    return channelId;
}

async function objectPost2json(obj) {
    let body
    const copyData = [];

    if(isJson(obj)) {
        body = JSON.parse(obj);
    } else if(type(obj) == "object") {
        body = obj;
    } else {
        console.log("Error Occurred: ", "body is not json");
        console.log("l: 171");
        return false;
    }

    try {
        console.log(body)
        body.foreach((item) => {
            console.log(item);
            if(item.hasOwnProperty('canonical_url')) {
                console.log('object2json: evaluating');
            } else {
                console.log("Error Occurred: ", "URL doesnt exist");
                console.log("l: 182");
                return false;
            }
        
            bodyObj.object.id = new Date(body.create_date).valueOf();
            bodyObj.object.type                 = body.type;
            bodyObj.object.createdDate          = body.create_date;
            bodyObj.object.canonicalUrl         = body.canonical_url;
            bodyObj.object.canonicalUrlMobile   = body.canonical_url_mobile;
            bodyObj.object.headlines            = body.headlines;
            bodyObj.object.description          = body.description;
            bodyObj.object.taxonomy.category    = body.taxonomy.primary_section.name;
            bodyObj.object.taxonomy.website     = body.taxonomy.primary_section._website;
            bodyObj.object.taxonomy.section     = body.taxonomy.primary_section.path;

        });
    } catch (e) {
        console.log("Error Occurred: ", e);
        console.log("l: 201")
    }
    
    
    console.log("Error Occurred: ", "updated doesnt exist");
    return false;
}

function isJson(item) {
    if (typeof item !== "string") { return false; }
    if (!["{", "}", "[", "]"].some(value => item.includes(value))) { return false; }
    let value = typeof item !== "string" ? JSON.stringify(item) : item;

    try {
        value = JSON.parse(value);
    } catch (e) {
        console.log("Error Occurred: ", e);
        console.log("l: 218")
        return false;
    }
      
    return typeof value === "object" && value !== null;
}

async function fetchDataFromApis() {
    const apiUrl = API_URL + '?token=' + API_KEY;
    let data = null;

    try {
        const apiResponse = await axios.get(apiUrl);

        if(apiResponse.status == 200) {
            if(apiResponse.data.type == "results") {
                data = apiResponse.data.content_elements;
            }
        }

        return {
            data: data
        };
    } catch (error) {
        console.error('Error fetching data from APIs:', error);
        return null;
    }
}



process.on('unhandledRejection', (error) => {
    console.error('Unhandled Promise Rejection:', error);
});

const server = http.createServer((req, res) => {
    const baseURL =  req.protocol + '://' + req.headers.host + '/';
    const reqUrl = new URL(req.url,baseURL);

    if(reqUrl.pathname == "/msg") {
        if (req.method == 'POST') {
            let body = [];
            req.on('data', async (chunk) => {
                body.push(chunk);
            }).on('end', async () => {
                body = Buffer.concat(body).toString();
                console.log(body);
                // at this point, `body` has the entire request body stored in it as a string
                if(await getSendMsgByPost(body)) {
                    res.end(JSON.stringify({ status: 200, message: 'Success'}));
                } else {
                    res.end(JSON.stringify({ status: 500, message: 'Error'}));
                }
            });
        }


        client.getState().then((result) => {
            if(result.match("CONNECTED")){
                var q = url.parse(req.url, true).query;
                
                res.end(JSON.stringify({ status: 200, message: 'Log Out Success'}));
            } else {
                console.error("Whatsapp Client not connected");

                res.end(JSON.stringify({ status: 500, message: 'Client State Null'}));
            }
        });
    }

    if(reqUrl.pathname == "/channel") {
        if (req.method == 'POST') {
            let body = [];
            req.on('data', async (chunk) => {
                body.push(chunk);
            }).on('end', async () => {
                body = Buffer.concat(body).toString();
                if(await getSendChannelByPost(body)) {
                    res.end(JSON.stringify({ status: 200, message: 'Success'}));
                } else {
                    res.end(JSON.stringify({ status: 500, message: 'Error'}));
                }
            });
        }

        client.getState().then((result) => {
            if(result.match("CONNECTED")){
                var q = url.parse(req.url, true).query;
                
                res.end(JSON.stringify({ status: 200, message: 'Log Out Success'}));
            } else {
                console.error("Whatsapp Client not connected");

                res.end(JSON.stringify({ status: 500, message: 'Client State Null'}));
            }
        });
    }
    
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end();
}).listen(PORT); 
