const functions = require('firebase-functions');
const admin = require('firebase-admin');
const db = admin.firestore();

async function decodeIDToken(req, res, next) {
    if (req.path === '/Show') return next();

    const idToken = req.body.token;

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        console.log(decodedToken.uid);

        const snapshot = await db.collection('user').where('linkedAcc', 'array-contains', String(decodedToken.uid)).get();
        if (snapshot.empty) {
            console.log('No matching documents.');
            req.body.uid = decodedToken.uid;
        } else {
            req.body.uid = snapshot.docs[0].id;
        }
        return next();
    } catch (err) {
        console.log(err);
        res.json({ "message": "token not verified", "error": err });
        // req.body.tokenverify = false;
    }
    return console.log('Decode Completed');
}
//express portion
const express = require('express');
const cors = require('cors');


const app = express();
app.use(cors({ origin: true }));
// app.use(decodeIDToken);

let crypto = require('crypto');
const saltName = 'SANYASAM';
function hashEmailAddress(email, salt) {
    var sum = crypto.createHash('sha256');
    sum.update(email + salt);
    return 'sha256$' + sum.digest('hex');
}

const axios = require('axios');
app.post('/CheckLink', async (req, res) => {

    const link = req.body.link;

    axios.post('https://openbadge3.herokuapp.com/results', {
        data: link
    })
        .then(function (response) {
            console.log(response.status);
            let data = response.data;
            if (req.body.email && data.graph[0].recipient !== undefined) {
                const email = req.body.email;
                const hashedValue = hashEmailAddress(email, saltName);
                if (data.graph[0].recipient.hashed === true) {
                    if (data.graph[0].recipient.identity === hashedValue) {
                        data.report.recipientProfile = {
                            email: email
                        }
                    }
                } else {
                    if (data.graph[0].recipient.identity === email) {
                        data.report.recipientProfile = {
                            email: email
                        }
                    }
                }

            }
            res.json(data);
        })
        .catch(function (error) {
            console.log(error);
            res.json({
                'message': 'error',
                'error': error
            })
        });
});

//imageupload
const { Storage } = require('@google-cloud/storage');
const storage = new Storage();

const path = require('path');
const os = require('os');
const fs = require('fs');

const pngitxt = require('png-itxt');

app.post('/CheckImage', (req, res) => {

    const Image = req.body.image;
    const t = Date.now();

    const tmpdir = os.tmpdir();
    const filepath = path.join(tmpdir, `file${t}`);
    //for base 64
    fs.writeFile(filepath, Image, "base64", async function (err) {
        if (!err) {
            fs.createReadStream(filepath)
                .pipe(pngitxt.get('openbadges', function (err, data) {
                    if (!err && data) {
                        // console.log(data.keyword, ":", data.value);
                        const assertion = JSON.parse(data.value);
                        console.log(assertion.id);
                        const link = assertion.id;

                        axios.post('https://openbadge3.herokuapp.com/results', {
                            data: link
                        })
                            .then(function (response) {
                                console.log(response.data);
                                let data = response.data;
                                if (req.body.email && data.graph[0].recipient !== undefined) {
                                    const email = req.body.email;
                                    const hashedValue = hashEmailAddress(email, saltName);
                                    if (data.graph[0].recipient.hashed === true) {
                                        if (data.graph[0].recipient.identity === hashedValue) {
                                            data.report.recipientProfile = {
                                                email: email
                                            }
                                        }
                                    } else {
                                        if (data.graph[0].recipient.identity === email) {
                                            data.report.recipientProfile = {
                                                email: email
                                            }
                                        }
                                    }

                                }
                                res.json(data);
                            })
                            .catch(function (error) {
                                console.log(error);
                                res.json({
                                    'message': 'error',
                                    'error': error
                                })
                            });
                    }
                }))
        } else {
            res.json({
                'message': 'error', 'error': err
            })
        }
    });





});

app.post('/test', async (req, res) => {
    axios.get('http://localhost:5001/openbadges-c7d08/us-central1/Assertion/Show?id=Zx5lOFMHUUNcThFLthQ0').then(doc => {
        res.json(true);
    })
})

exports.Verification = functions.runWith({ timeoutSeconds: 540 }).https.onRequest(app);