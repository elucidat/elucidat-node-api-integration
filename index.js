"use strict"

const https = require('https');
const crypto = require('crypto');

/**
 * Makes an API request to elucidat
 * @param headers
 * @param fields
 * @param url
 * @param consumer_secret
 * @return mixed
 */
function callElucidat(options, callback) {
    // build the signature
    options.headers['oauth_signature'] = buildSignature(
        options.consumer_secret, 
        Object.assign(options.headers, options.fields || {}), 
        options.method, 
        options.protocol+options.hostname+'/v'+(options.version)+'/'+options.path
    );
    // and put the request together
    const requestOptions = {
        hostname: options.hostname,
        path: '/v'+(options.version)+'/'+options.path + (options.method === 'GET' && options.fields ? '?'+buildBaseString(options.fields, '&') : '' ),
        method: options.method,
        headers: {
            'Authorization': buildBaseString(options.headers, ',')
        }
    };
    // now do the request
    https.request(requestOptions, (res) => {
        if (res.statusCode !== 200) {
            callback(res.statusCode, 'Error...');
        } else {
            res.on('data', (d) => {
                callback(res.statusCode, JSON.parse(d));
            });
        }
    }).on('error', (e) => {
        callback(400, e.message);
    }).end();
}

/**
 * Sorts object into order from keys - https://gist.github.com/stiekel/95526f20ec6915a594c6
 * @param object
 * @return object
 */
function ksort(obj) {
    var keys = Object.keys(obj).sort()
    , sortedObj = {};

    for(var i in keys) {
        sortedObj[keys[i]] = obj[keys[i]];
    }
    return sortedObj;
}

/**
 * Computes and returns a signature for the request.
 * @param $secret
 * @param $fields
 * @param $request_type
 * @param $url
 * @return string
 */
function buildSignature(consumer_secret, fields, requestType, url) {
    // fields must be in right order
    fields = ksort(fields);
    //Build base string to be used as a signature
    const baseInfo = requestType+'&'+url+'&'+buildBaseString(fields, '&'); //return complete base string
    //Create the signature from the secret and base string
    const compositeKey = encodeURIComponent(consumer_secret);
    // hash it
    return crypto.createHmac('sha1', consumer_secret).update(baseInfo).digest('base64')
}

/**
 * Builds a segment from an array of fields.  Its used to create string representations of headers and URIs
 * @param fields
 * @param delim
 * @return string
*/
function buildBaseString(obj, delim) {
    var str = [];
    for (var p in obj) {
        if (obj.hasOwnProperty(p)) {
            str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
        }
    }
    return str.join(delim);
}

/**
 * Returns typical headers needed for a request
 * @param consumer_key
 * @param nonce
 */
function authHeaders(consumer_key, nonce = '') {
    const headers = {
        'oauth_consumer_key': consumer_key,
        'oauth_signature_method': 'HMAC-SHA1',
        'oauth_timestamp': Math.round(Date.now() / 1000),
        'oauth_version':'1.0'
    };
    if (nonce.length)
        headers['oauth_nonce'] = nonce;
    return headers;
}

/**
 * Each request to the elucidat API must be accompanied by a unique key known as a nonce.
 * This key adds an additional level of security to the API.
 * A new key must be requested for each API call.
 * @param api_url
 * @param consumer_key
 * @param consumer_secret
 * @return bool
 */
function getNonce(params, callback) {
    const requestOptions = {
        protocol: params.protocol,
        hostname: params.hostname,
        version: params.version,
        path: params.path,
        method: params.method || 'GET',
        headers: authHeaders(params.consumer_key),
        consumer_secret: params.consumer_secret
    };
    //Make a request to elucidat for a nonce...any url is fine providing it doesnt already have a nonce
    callElucidat(requestOptions, callback);
}

/* 
 *
 */
module.exports = function(params, callback) {
    const parameters = {
        protocol: params.protocol || 'https://',
        hostname: params.hostname || 'api.elucidat.com',
        version: params.version || 2,
        path: params.path || 'projects',
        method: params.method || 'GET',
        consumer_key: params.consumer_key || '',
        consumer_secret: params.consumer_secret || '',
        fields: params.fields || {}
    };
    getNonce(parameters, function (statusCode, nonceResponse) {
        if (nonceResponse.nonce) {
            // console.log(nonceResponse);
            parameters.headers = authHeaders(parameters.consumer_key, nonceResponse.nonce);
            setTimeout(callElucidat(parameters, callback), 250);
            
        } else {
            callback(403, 'Error getting nonce...');
        }
    });
};
