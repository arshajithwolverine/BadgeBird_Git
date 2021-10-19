const functions = require('firebase-functions');

const admin = require('firebase-admin');

const db = admin.firestore();

//express portion
const express = require('express');
const cors = require('cors');


const app = express();
app.use(cors({ origin: true }));
const axios = require('axios');


app.post('/Baking', async (req, res) => {
    const arr = [];
    for (i = 0; i < 1000; i++) {
        arr.push(req.body.candedates[0]);
    }
    axios.post('http://localhost:5001/openbadges-c7d08/us-central1/recipients/Adding', {
        uid: req.body.uid,
        count: req.body.count,
        issuer: req.body.issuer,
        badge: req.body.badge,
        candedates: arr
    })
        .then(function (response) {
            console.log(response.status);
            res.json(response.data);
        })
        .catch(function (error) {
            console.log(error);
            res.json(error)
        });
})

app.post('/Testing', async (req, res) => {
    const assertonData = await db.collection('Assertion').limit(50).get();
    const promises = [];
    assertonData.forEach(doc => {
        promises.push(axios.post('https://openbadge3.herokuapp.com/results', {
            data: doc.data().id
        }))
    })
    let count = 0;
    let errorArr = [];
    Promise.all(promises).then(response => {
        response.forEach(data => {
            count += 1;
            if (data.data.report.valid === false) {
                console.log(`Count : ${count}`)
                console.log(data.data.graph);
                errorArr.push(data.data.graph);
            }
        })
        res.json(errorArr);
    })
        .catch(function (error) {
            console.log(error);
            res.json(error)
        });
})

exports.UnitTest = functions.runWith({ timeoutSeconds: 540 }).https.onRequest(app);