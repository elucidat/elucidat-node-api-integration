"use strict"

const axios = require('axios').default;
const crypto = require('crypto');
const qs = require('qs');

/**
 * Makes an API request to elucidat
 * @param headers
 * @param fields
 * @param url
 * @param consumer_secret
 * @return mixed
 */
async function callElucidat(options, callback) {

    const baseURL = options.protocol+options.hostname+(options.port !== 443 ? ':'+options.port : '')+'/v'+(options.version)+'/'+options.path;
    const headersAndFields = {};
    Object.assign(headersAndFields, options.headers);
    Object.assign(headersAndFields, options.fields || {});
    // build the signature
    options.headers['oauth_signature'] = buildSignature(
        options.consumer_secret, 
        headersAndFields, 
        options.method, 
        baseURL
    );

    // and put the request together
    const requestOptions = {
        url: baseURL + (options.method === 'GET' && options.fields ? '?'+buildBaseString(options.fields, '&') : '' ),
        method: options.method,
        headers: {
            'Authorization': buildBaseString(options.headers, ',')
        }
    };

    // add POST vars if there are some
    if (options.method !== 'GET') {
        requestOptions.data = qs.stringify(options.fields);
    }

    // now do the request
    return axios(requestOptions);

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
async function getNonce(params, callback) {
    const requestOptions = {
        protocol: params.protocol,
        hostname: params.hostname,
        version: params.version,
        path: params.path,
        port: params.port,
        method: params.method || 'GET',
        headers: authHeaders(params.consumer_key),
        consumer_secret: params.consumer_secret
    };
    //Make a request to elucidat for a nonce...any url is fine providing it doesnt already have a nonce
    return callElucidat(requestOptions, callback);
}

/* 
 *
 */
module.exports = function(params, callback) {
    const parameters = {
        protocol: params.protocol || 'https://',
        hostname: params.hostname || 'api.elucidat.com',
        port: params.port || 443,
        version: params.version || 2,
        path: params.path || 'projects',
        method: params.method || 'GET',
        consumer_key: params.consumer_key || '',
        consumer_secret: params.consumer_secret || '',
        fields: params.fields || {}
    };
    getNonce(parameters).then(nonceResponse => {
        if (nonceResponse.data.nonce) {
            parameters.headers = authHeaders(parameters.consumer_key, nonceResponse.data.nonce);
            setTimeout(function(){
                // give a little breathing room in case of high traffic
                callElucidat(parameters).then(response => {
                    callback(response.status, response.data);
                }).catch(error => {
                    callback(error.response.status, error.response.data);
                });
            }, 500);
            
        } else {
            callback(403, 'Error getting nonce...');
        }
    }).catch(error => {
        callback(error.response.status, error.response.data);
    });
};
