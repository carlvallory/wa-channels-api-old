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

const API_KEY = JSON.parse(process.env.API_KEY) || null;
const API_URL = JSON.parse(process.env.API_URL) || null;
const CHANNEL = JSON.parse(process.env.CHANNEL) || null;
const C_PARAM = JSON.parse(process.env.C_PARAM) || null;
const WEBSITE = JSON.parse(process.env.WEBSITE) || null;
const WEB_URL = JSON.parse(process.env.WEB_URL) || null;
const HOST = process.env.HTTP_HOST || "127.0.0.1";
const PORT = process.env.HTTP_PORT || 4003;
const DB_PATH = process.env.DB_PATH || null;
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
            if(DEBUG === true) { console.log(msg.type); }
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
        let data = null;
        let objResponse = false;

        for (key in CHANNEL) {
            data = await fetchDataFromApis(key);
            objResponse = await getSendChannelByPost(data, key);
            console.log(key);
        }
        

        if(DEBUG === true) { console.log(data); }
            
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

async function getSendChannelByPost(obj, n) {
    try {
        let objResponse = await objectPost2json(obj, n);
        let sendChannelData = false;
        let objReady = false;
        //obj with information to publish
       
        let duplicateIds = await checkIds(objResponse);

        if(duplicateIds != false) {
            objReady = removeObjById(objResponse, duplicateIds);
        }

        if(DEBUG === true) { console.log(duplicateIds,143); }

        if(objReady == false || objReady.length === 0) {
            return false;
        }

        let channelName = await getSwitchChannel(n);

        let channelId = await getChannelId(channelName);

        if(!Array.isArray(channelId) || channelId.length === 0) {
            return false;
        }

        if(objResponse != false) {
            if(Array.isArray(objReady)) {
                if(objReady.length != 0) {
                    let newId = [];
                    for (let i = 0; i < objReady.length; i++) {
                        if(objReady[i].object.taxonomy.website == WEBSITE[n]) {
                            if(newId.length === 0 || !newId.includes(objReady[i].object.id)) {
                                let newUrl = WEB_URL[n] + objReady[i].object.canonicalUrl;
                                let og = await fetchOGMetadata(newUrl);
                                let image = await fetchImageFromUrl(og.ogImage);
                                let media = new MessageMedia('image/jpeg', Buffer.from(image).toString('base64'));

                                let ogTitle = truncateString(og.ogTitle, 75);
                                let ogDescription = truncateString(og.ogDescription, 48);

                                objReady[i].object.og.title = `*${ogTitle}*`;
                                objReady[i].object.og.description = `_${ogDescription}_`;
                                objReady[i].object.og.image = media; // TO DO BLOB attachment

                                const message = `${objReady[i].object.og.title}\n\n${objReady[i].object.og.description}\n\n${newUrl}`;

                                newId.push(objReady[i].object.id);
                                if(DEBUG === true) { console.log(objReady[i], 186); } // check

                                sendChannelData = await client.sendMessage(channelId[0], objReady[i].object.og.image, {caption: message});
                                //sendChannelData = await client.sendMessage(channelId[0], message);
                            }
                        }
                    }
                }
            }
        }

        return sendChannelData;
    } catch(e){
        console.log("Error Occurred: ", e);
        console.log("l: 200");
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

        if(DEBUG === true) { console.log(channelId, 213); } // check

    return channelId;
}

async function getSwitchChannel(n) {
    if(CHANNEL === null) {
        return CHANNEL[0];
    }

    return CHANNEL[n];
}

async function getKeyByChannelName(value) {
    return Object.keys(CHANNEL).find(key => CHANNEL[key] === value);
}

async function objectPost2json(obj, n) {
    let body
    let copyData = [];

    if(isJson(obj)) {
        if(DEBUG === true) { console.log("JSON"); }
        body = JSON.parse(obj);
    } else if(type(obj) == "object") {
        if(DEBUG === true) { console.log("OBJECT"); }
        body = obj;
    } else {
        console.log("Error Occurred: ", "body is not json");
        console.log("l: 230");
        return false;
    }

    if(isObject(obj) === false) {
        console.log("l: 235");
        return false;
    }

    try {

        if (!body.data || !Array.isArray(body.data)) {
            console.log("Error Occurred: ", "data is null or not an array");
            console.log("l: 264");
            return false;
        }

        for (let i = 0; i < body.data.length; i++) {

            dataObj = body.data[i];
            
            if(Object.keys(dataObj).length == 15 || Object.keys(dataObj).length == 9) {
                
                if(dataObj.hasOwnProperty('canonical_url')) {
                    if(DEBUG === true) { console.log('object2json: evaluating'); }
                } else {
                    console.log("Error Occurred: ", "URL doesnt exist");
                    console.log("l: 250");
                    return false;
                }

                if(dataObj.hasOwnProperty('created_date')) {
                    if(DEBUG === true) { console.log('object2json: evaluating'); }
                } else {
                    console.log("Created Date doesnt exist");
                    console.log("l: 260");
                }
                
                bodyObj.object.id = new Date(dataObj.created_date).valueOf();
                bodyObj.object.type                 = dataObj.type;
                bodyObj.object.createdDate          = dataObj.created_date;

                if(dataObj.hasOwnProperty('taxonomy')) {
                    if(dataObj.taxonomy.primary_section._website == WEBSITE[n]) {
                        bodyObj.object.canonicalUrl         = dataObj.canonical_url;
                        bodyObj.object.canonicalUrlMobile   = dataObj.canonical_url_mobile;
                        bodyObj.object.headlines            = dataObj.headlines.basic;
                        bodyObj.object.description          = dataObj.description.basic;
                        bodyObj.object.taxonomy.category    = dataObj.taxonomy.primary_section.name;
                        bodyObj.object.taxonomy.website     = dataObj.taxonomy.primary_section._website;
                        bodyObj.object.taxonomy.section     = dataObj.taxonomy.primary_section.path;
                    }
                } else {
                    if(dataObj.website == WEBSITE[n]) {
                        bodyObj.object.canonicalUrl         = dataObj.canonical_url;
                        bodyObj.object.canonicalUrlMobile   = null;
                        bodyObj.object.headlines            = dataObj.title;
                        bodyObj.object.description          = dataObj.description;
                        bodyObj.object.taxonomy.category    = dataObj.category.name;
                        bodyObj.object.taxonomy.website     = dataObj.website;
                        bodyObj.object.taxonomy.section     = null;
                    }
                }

                copyData.push(bodyObj);
            } else {
                console.log(Object.keys(dataObj).length);
                console.log("l: 275");
            }
        }

        return copyData;


    } catch (e) {
        console.log("Error Occurred: ", e);
        console.log("l: 285");
    }
    
    
    console.log("Error Occurred: ", "updated doesnt exist");
    return false;
}

function getIds(obj) {

    if (!Array.isArray(obj)) {
        console.log("Error Occurred: obj is not an array");
        console.log("l: 339");
        return [];
    }

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
    let duplicateId = getDuplicateId(storedIds, ids); // check
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

function removeObjByQty(arrayOfObjects) {
    return sliceArray(arrayOfObjects, 8);
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

async function moveJson(filepath) {
    $emptyArray = await writeJson(filepath, []);
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

async function fetchDataFromApis(n) {
    const apiUrl = API_URL[n] + `?${C_PARAM[n]}=` + API_KEY[n];
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

function sliceArray(array, start) {
    // Check if the array has more than n items
    if (array.length > start) {
        return array.slice(-start);
    }
    return array;
}

process.on('unhandledRejection', (error) => {
    console.error('Unhandled Promise Rejection:', error);
});

const server = http.createServer((req, res) => {
    let protocol = "http";
    if(req.protocol !== undefined) {    protocol = req.protocol; }

    const baseURL =  protocol + '://' + req.headers.host + '/';
    const reqUrl = new URL(req.url,baseURL);

    if(reqUrl.pathname == "/msg" || reqUrl.pathname == "/channel/update") {
        if(reqUrl.pathname == "/msg") {
            if (req.method == 'POST') {
                let body = [];
                req.on('data', async (chunk) => {
                    body.push(chunk);
                }).on('end', async () => {
                    body = Buffer.concat(body).toString();

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

        if(reqUrl.pathname == "/channel/update") {
            if (req.method == 'GET') {
                try {
                    if(DEBUG === true) {
                        console.log(req.method);
                    }
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
