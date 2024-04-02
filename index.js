const cheerio = require('cheerio');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const http = require('http');
const url = require('url');
const fs = require('fs');
const { Client, NoAuth, MessageMedia } = require('whatsapp-web.js');
const querystring = require('querystring');
const FormData = require('form-data');
const { channel } = require('diagnostics_channel');

require('dotenv').config();

const API_KEY = process.env.API_KEY || null;
const API_URL = process.env.API_URL || null;
const HOST = process.env.HTTP_HOST || "127.0.0.1";
const PORT = process.env.HTTP_PORT || 4003;
const CHANNEL = process.env.CHANNEL || "Prueba";
const DB_PATH = process.env.DB_PATH || null;
const WEBSITE = process.env.WEBSITE || null;
const WEB_URL = process.env.WEB_URL || null;
const DEBUG = process.env.DEBUG || false;

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

const client = new Client(
    {
        authStrategy: new NoAuth(),
        puppeteer: {
            args: ['--no-sandbox'],
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
        og: {
            title: null,
            description: null,
            image: null
        },
    },
    updated: false
};

let messageData = { 
    channel: null,
    image: null,
    message: null
 }

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

client.initialize();

async function getSendMsg() {
    try{
        let sendMessageData = false;
        let msgSend = false;
        let data = await fetchDataFromApis();
        let objResponse = await getSendChannelByPost(data);
        if(objResponse != false) {
            msgSend = await getSendMessage(objResponse);
        }

        if(DEBUG === true) {
            console.log(data);
        }
            
        if(msgSend == false) {
            console.log(false);
        } else {
            sendMessageData = true;
        }

        return sendMessageData;
    } catch(e){
        console.log("Error Occurred: ", e);
    }
}

// CHECK FOR ERRORS
async function getSendChannelByPost(obj) {
    try {
        if(DEBUG === true) { console.log(obj, 148); }
        let objResponse = await objectPost2json(obj);
        let channelPreviewData = false;
        let sendChannelData = false;
        let newChannelId = null;
        let message = null;
        //obj with information to publish
       
        let duplicateIds = await checkIds(objResponse);
        let objReady = removeObjById(objResponse, duplicateIds); console.log(objReady, 152);

        console.log(duplicateIds,154);

        if(objReady == false || objReady.length === 0) {
            return false;
        }

        let channelId = await getChannelId(CHANNEL); console.log(CHANNEL, channelId, 160);

        if(!Array.isArray(channelId) || channelId.length === 0) {
            return false;
        }

        if(objResponse != false) {
            if(Array.isArray(objReady)) {
                if(objReady.length != 0) {
                    let newId = [];
                    for (let i = 0; i < objReady.length; i++) {
                        console.log(objReady[i].object.taxonomy.website);
                        if(objReady[i].object.taxonomy.website == WEBSITE) {
                            if(newId.length === 0 || !newId.includes(objReady[i].object.id)) {
                                let newUrl = WEB_URL + objReady[i].object.canonicalUrl;
                                let og = await fetchOGMetadata(newUrl);
                                let image = await fetchImageFromUrl(og.ogImage);
                                let media = new MessageMedia('image/jpeg', Buffer.from(image).toString('base64'));

                                let ogTitle = truncateString(og.ogTitle, 75);
                                let ogDescription = truncateString(og.ogDescription, 48);

                                objReady[i].object.og.title = `*${ogTitle}*`;
                                objReady[i].object.og.description = `_${ogDescription}_`;
                                objReady[i].object.og.image = media; // TO DO BLOB attachment

                                message = `${objReady[i].object.og.title}\n\n${objReady[i].object.og.description}\n\n${newUrl}`;

                                newId.push(objReady[i].object.id);
                                console.log(objReady[i], 175);

                                newChannelId = channelId[0];

                                channelPreviewData = await client.getChannelById(newChannelId, { getMetadata: true });

                                console.log(channelPreviewData, 193); // ERROR

                                messageData.channel = newChannelId;
                                messageData.image = objReady[i].object.og.image;
                                messageData.message = message;
                                //sendChannelData = await client.sendMessage(channelId[0], objReady[i].object.og.image); //, {caption: message}
                                //sendChannelData = await client.sendMessage(channelId[0], message);
                            }
                        }
                    }
                }
            }
        }

        console.log (messageData, 224);

        return messageData;
    } catch(e){
        console.log("Error Occurred: ", e);
        console.log("l: 197");
        return false;
    }
}

async function getSendMessage(msgData) {
    let sendChannelData = false;
    console.log(msgData.channel);
    sendChannelData = await client.sendMessage(msgData.channel, msgData.message);
    //sendChannelData = await client.sendMessage(msgData.channel, msgData.image, {caption: msgData.message});
    return sendChannelData;
}

async function getChannelId(channelName) {
    const channels = await client.getChannels();
    console.log(channels, 210);
    const channelId = channels
        .filter(channel => channel.name == channelName)
        .map(channel => {
            return channel.id._serialized
        });

    console.log(channelId, 217);

    return channelId;
}

async function objectPost2json(obj) {
    let body
    const copyData = [];

    if(isJson(obj)) {
        console.log("JSON");
        body = JSON.parse(obj);
    } else if(type(obj) == "object") {
        console.log("OBJECT");
        body = obj;
    } else {
        console.log("Error Occurred: ", "body is not json");
        console.log("l: 227");
        return false;
    }

    if(isObject(obj) === false) {
        console.log("l: 232");
        return false;
    }

    try {

        for (let i = 0; i < body.data.length; i++) {

            dataObj = body.data[i];
            
            if(Object.keys(dataObj).length == 15) {
                
                if(dataObj.hasOwnProperty('canonical_url')) {
                    console.log('object2json: evaluating');
                } else {
                    console.log("Error Occurred: ", "URL doesnt exist");
                    console.log("l: 235");
                    return false;
                }

                if(dataObj.hasOwnProperty('created_date')) {
                    console.log('object2json: evaluating');
                } else {
                    console.log("Created Date doesnt exist");
                    console.log("l: 243");
                }

                if(DEBUG === true) {
                    console.log(dataObj); console.log(267);
                }
                
                bodyObj.object.id = new Date(dataObj.created_date).valueOf();
                bodyObj.object.type                 = dataObj.type;
                bodyObj.object.createdDate          = dataObj.created_date;
                bodyObj.object.canonicalUrl         = dataObj.canonical_url;
                bodyObj.object.canonicalUrlMobile   = dataObj.canonical_url_mobile;
                bodyObj.object.headlines            = dataObj.headlines.basic;
                bodyObj.object.description          = dataObj.description.basic;
                bodyObj.object.taxonomy.category    = dataObj.taxonomy.primary_section.name;
                bodyObj.object.taxonomy.website     = dataObj.taxonomy.primary_section._website;
                bodyObj.object.taxonomy.section     = dataObj.taxonomy.primary_section.path;

                copyData.push(bodyObj);
            } else {
                console.log("l: 259");
            }
        }

        return copyData;


    } catch (e) {
        console.log("Error Occurred: ", e);
        console.log("l: 268");
    }
    
    
    console.log("Error Occurred: ", "updated doesnt exist");
    return false;
}

function getIds(obj) {
    const ids = []
    obj.forEach(element => {
        ids.push(element.object.id)
    });

    return ids;
}

async function checkIds(obj) {
    let ids = getIds(obj);
    let filepath = DB_PATH + 'db/ids.json';

    let storedIdsData = await readJson(filepath);
    let storedIds = JSON.parse(storedIdsData); // Parse the JSON string into an array
    let duplicateId = getDuplicateId(storedIds, ids);
    let updatedIds = updateJson(storedIds, ids);

    let storeIds = await writeJson(filepath, updatedIds);

    if(storeIds) {
        return duplicateId;
    }

    return false;
}

function removeObjById(arrayOfObjects, duplicateIds) {
    if(!Array.isArray(duplicateIds)) return false;
    let filteredArray = arrayOfObjects.filter(value => !duplicateIds.includes(value.object.id));
    return filteredArray.length > 0 ? filteredArray : false;
}

function writeJson(filepath, ids) {
    return new Promise((resolve, reject) => {
        let jsonData = JSON.stringify(ids, null, 2);

        fs.writeFile(filepath, jsonData, (err) => {
            if (err) {
                console.error('Error writing file:', err);
                reject(false);
            } else {
                console.log('File successfully written.');
                resolve(true);
            }
        });
    });
}

async function readJson(filepath) {
    if (!fs.existsSync(filepath)) {
        $emptyArray = await writeJson(filepath, []);
    }
    return fs.readFileSync(filepath, 'utf8');
}

function updateJson(storedIds, newIds) {
    // Ensure both storedIds and newIds are arrays
    if (!Array.isArray(storedIds) || !Array.isArray(newIds)) {
        throw new Error("Invalid input: storedIds and newIds must be arrays.");
    }
    return Array.from(new Set([...storedIds, ...newIds]));
}

function getDuplicateId(storedIds, newIds) {
    return newIds.filter(value => storedIds.includes(value));
}

function isJson(item) {
    if (typeof item !== "string") { return false; }
    if (!["{", "}", "[", "]"].some(value => item.includes(value))) { return false; }
    let value = typeof item !== "string" ? JSON.stringify(item) : item;

    try {
        value = JSON.parse(value);
    } catch (e) {
        console.log("Error Occurred: ", e);
        console.log("l: 354")
        return false;
    }
      
    return typeof value === "object" && value !== null;
}

function isObject(variable) {
    return variable !== null && typeof variable === 'object' && !Array.isArray(variable);
}

async function fetchOGMetadata(url) {
    try {
        // Fetching the HTML content of the page
        const { data } = await axios.get(url);
        const cheerAxios = cheerio.load(data);

        // Extracting the Open Graph metadata
        const ogTitle = cheerAxios('meta[property="og:title"]').attr('content');
        const ogDescription = cheerAxios('meta[property="og:description"]').attr('content');
        const ogImage = cheerAxios('meta[property="og:image"]').attr('content');

        return {
            ogTitle,
            ogDescription,
            ogImage
        };
    } catch (error) {
        console.error(`Error fetching Open Graph Data: ${error}`);
        return {};
    }
}

async function fetchImageFromUrl(imageUrl) {
    try {
        // Fetching the HTML content of the page
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const image = response.data;

        return image;

    } catch (error) {
        console.error(`Error fetching Image: ${error}`);
        return false;
    }
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

function truncateString(str, num) {
    // If the length of str is less than or equal to num
    // just return str--don't truncate it.
    if (str.length <= num) {
      return trimString(str);
    }
    // Return str truncated with '...' concatenated to the end of str.
    return str.slice(0, num).trim().replace(/\s+/g, ' ') + '...';
}

function trimString(str) {
    // Return str trimmed string.
    return str.trim().replace(/\s+/g, ' ');
}


process.on('unhandledRejection', (error) => {
    console.error('Unhandled Promise Rejection:', error);
});

const server = http.createServer((req, res) => {
    let protocol = "http";
    if(req.protocol !== undefined) {    protocol = req.protocol; }

    const baseURL =  protocol + '://' + req.headers.host + '/';
    const reqUrl = new URL(req.url,baseURL);

    if(reqUrl.pathname == "/msg" || reqUrl.pathname == "/channel" || reqUrl.pathname == "/channel/update") {
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
                    res.end(JSON.stringify({ status: 200, message: 'Msg Success'}));
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
                    res.end(JSON.stringify({ status: 200, message: 'Checking Channel Success'}));
                } else {
                    console.error("Whatsapp Client not connected");
                    res.end(JSON.stringify({ status: 500, message: 'Client State Null'}));
                }
            });
        }

        if(reqUrl.pathname == "/channel/update") {
            if (req.method == 'GET') {
                try {
                    console.log(req.method);
                    var r = getSendMsg();
                    if(r) {
                        res.end(JSON.stringify({ status: 200, message: 'Success'}));
                    } else {
                        res.end(JSON.stringify({ status: 500, message: 'Error'}));
                    }
                } catch(e){
                    console.log("Error Occurred: ", e);
                }
            }

            client.getState().then((result) => {
                if(result.match("CONNECTED")){
                    res.end(JSON.stringify({ status: 200, message: 'Update Success'}));
                } else {
                    res.end(JSON.stringify({ status: 500, message: 'Client State Null'}));
                }
            });
        }
    } else {
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.end();
    }
    
}).listen(PORT); 
