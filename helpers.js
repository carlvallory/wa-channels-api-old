// Define your helper functions
async function fetchDataFromApis(apiUrl, apiKey, cParam) {
    const axios = require('axios');
    const url = `${apiUrl}?${cParam}=${apiKey}`;
    let data = null;

    try {
        const apiResponse = await axios.get(url);

        if (apiResponse.status === 200) {
            if (apiResponse.data.type === "results") {
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

async function getChannelId(client, channelName) {
    const channels = await client.getChannels();
    const channelId = channels
        .filter(channel => channel.name === channelName)
        .map(channel => {
            return channel.id._serialized;
        });
    return channelId;
}

async function getChannelById(client, channelName) {
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

async function getSendMessage(client, channelName, messageText) {
    let message;
    if (typeof client.sendMessage === 'function') {
        try {
            message = await client.sendMessage(channelName, messageText);
        } catch (error) {
            console.error('Error sending message:', error);
        }
    }

    return message;
}


// Export the functions
module.exports = {
    fetchDataFromApis,
    getChannelId,
    getChannelById,
    getSendMessage
};
