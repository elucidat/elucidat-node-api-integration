# Elucidat API Integration

A library for connecting to the Elucidat API.
Find out more about Elucidat at [www.elucidat.com](https://www.elucidat.com/)

## Installation
Using npm:
```
$ npm install elucidat-api 
```

## Usage
An example for returning the HTML of a course using Node.js:
```
const elucidatAPI = require('elucidat-api');

const parameters = {
    path: '/v2/releases/launch',
    consumer_key: '',
    consumer_secret: '',
    fields: {
        'release_code': '',
        'name': '',
        'email_address': ''
    }
};

elucidatAPI(parameters, function (statusCode, response) {
    if (response.url) {
        // finally load the contents of the page
        https.get(response.url, function (res) {
            var pageContent = '';
            res.on('data', function (chunk) {
                pageContent += chunk;
            }).on('end', function () {
                process.stdout.write(pageContent);
            });
        }).on('error', function (e) {
            console.error(e.message);
        }).end();
    } else {
        console.error(response);
    }
});
```
For other methods see the API documentation at [help.elucidat.com](https://help.elucidat.com/).
