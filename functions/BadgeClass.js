const functions = require('firebase-functions');

const admin = require('firebase-admin');


const db = admin.firestore();

//express portion
const express = require('express');
const cors = require('cors');


const app = express();
app.use(cors({ origin: true }));



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
app.use(decodeIDToken);





//storage
const { Storage } = require('@google-cloud/storage');
const storage = new Storage();
const spawn = require('child-process-promise').spawn;
const path = require('path');
const os = require('os');
const fs = require('fs');
const mkdirp = require('mkdirp');

//fetch
const fetch = require('node-fetch');




//BadgeClass Adding

app.post('/Create', async (req, res) => {

    uid = req.body.uid;
    const criteria = req.body.criteria;
    if (criteria.description === undefined || criteria.description === '') {
        return res.json({ 'message': 'Enter valid criteria' })
    }
    // const checkCriteria = criteria.url.split(':');
    // if (checkCriteria[0] !== 'http' && checkCriteria[0] !== 'https') {
    //     return res.json({ 'message': 'Critera Url should be a link( eg: http://example.com  )' })
    // }

    var badgeClass = {
        "@context": "https://w3id.org/openbadges/v2",
        name: req.body.name,
        description: req.body.description,
        imageUrl: req.body.imageUrl,
        image: req.body.image,
        imagepath: req.body.imagepath,
        issuer: `https://us-central1-openbadges-c7d08.cloudfunctions.net/IssuerShow?id=${req.body.issuer}`,
        issuerId: req.body.issuer,
        requestapproval: "false"
    };
    const criteriaTemp = {
        type: 'Criteria',
        narrative: criteria.description
    }
    badgeClass.criteria = criteriaTemp;

    if (req.body.alignment && req.body.alignment !== '' && (req.body.alignment.isArray && !req.body.alignment.length)) {
        const alignment = req.body.alignment;
        let alignmentFlag = true;
        const newAlignment = [];
        alignment.forEach(doc => {
            let temp = {
                targetName: doc.name,
                targetUrl: doc.url
            }
            if (doc.short_description) {
                temp.targetDescription = doc.short_description;
            }
            newAlignment.push(temp);
            const checkAlignment = doc.url.split(':');
            if (checkAlignment[0] !== 'http' && checkAlignment !== 'https') {
                alignmentFlag = false
            }
        });

        if (alignmentFlag) {
            badgeClass.alignment = newAlignment;
        } else {
            return res.json({ 'message': 'Alignment Url should be a link (eg: http://example.com)' });
        }
    }
    if (req.body.tags) {
        badgeClass.tags = req.body.tags;
    }
    if (Number(req.body.blockChain) === 1) {
        badgeClass.blockChain = true;
    } else {
        badgeClass.blockChain = false;
    }
    const issuerdata = await db.collection('Issuer').doc(req.body.issuer).get();

    //console.log(req.body.uid);
    db.collection('user').doc(uid).collection('issuer').doc(req.body.issuer).collection('BadgeClass').add(badgeClass).then(async doc => {
        await db.collection('user').doc(uid).collection('issuer').doc(req.body.issuer).collection('BadgeClass').doc(doc.id).update({
            id: `https://us-central1-openbadges-c7d08.cloudfunctions.net/BadgeClass/Show?id=${doc.id}`,
            type: 'BadgeClass',
            awardable: 10
        });
        await db.collection('BadgeClass').doc(doc.id).set(badgeClass).then(async tasker => {
            await db.collection('BadgeClass').doc(doc.id).update({
                id: `https://us-central1-openbadges-c7d08.cloudfunctions.net/BadgeClass/Show?id=${doc.id}`,
                type: 'BadgeClass',
            });
            return console.log("BadgeClass Approved");
        });
        if (issuerdata.data().badges === undefined) {
            await db.collection('Issuer').doc(req.body.issuer).update({
                badges: [doc.id]
            });
        } else {
            let arr = [];
            arr = issuerdata.data().badges;
            arr.push(doc.id);
            await db.collection('Issuer').doc(req.body.issuer).update({
                badges: arr
            });

        }

        return res.json({ "message": 'BadgeClass Added', "id": `${doc.id}` });
    }).catch(error => {
        return res.json({ message: 'Something went wrong', "error": error });
    });
    return console.log(uid);

});

//Update badgeClass
app.post('/Update', (req, res) => {
    const uid = req.body.uid;
    var badgeClass = {
        name: req.body.name,
        description: req.body.description,
        image: req.body.image,
        imagepath: req.body.imagepath,
        criteria: req.body.criteria,
    };
    if (req.body.alignment) {
        badgeClass.alignment = req.body.alignment;
    }
    if (req.body.tags) {
        badgeClass.tags = req.body.tags;
    }
    db.collection('BadgeClass').doc(req.body.badge).update(badgeClass).then(doc => {
        return console.log(`${doc.id} BadgeClass Update Succes`);
    }).catch(err => console.log(err));

    db.collection('user').doc(uid).collection('issuer').doc(req.body.issuer).collection('BadgeClass').doc(req.body.badge).update(badgeClass).then(doc => {

        return res.json({ "message": 'BadgeClass Updated', "id": `${req.body.badge}` });
    }).catch(error => {
        return res.json({ message: 'Something went wrong', "error": error });
    });



});


//Show BadgeClass
app.get('/Show', (req, res) => {
    db.collection('BadgeClass').doc(req.query.id).get().then(snapshot => {
        // let badgeClass = {};
        // badgeClass = snapshot.data();
        // console.log(badgeClass);
        // badgeClass.alignment = [];
        // badgeClass.alignment = snapshot.data().alignment;

        // console.log(snapshot.data());
        //console.log(snapshot.data().alignment[0].targetName);

        const userAgent = req.headers['user-agent'];
        console.log(`user-agent:${userAgent}`)
        const checkData = userAgent.split('/');
        console.log(checkData);
        if (checkData[0] === 'Mozilla') {
            return res.redirect(`https://openbadges-c7d08.web.app/Badges/Public/${req.query.id}`)
        } else {
            return res.json(snapshot.data());
        }

    }).catch(error => {
        res.json({ message: "something went wrong", "err": error });
    });
});

exports.BadgeClass = functions.https.onRequest(app);




//Approve BadgeClass

// exports.BadgeUpdate = functions.firestore.document('user/{userId}/issuer/{issuerId}/BadgeClass/{BadgeClassId}').onUpdate((snap, context) => {

//     var BadgeId = context.params.BadgeClassId;
//     var Badge = {
//         name: snap.after.data().name,
//         description: snap.after.data().description,
//         image: snap.after.data().image,
//         imagepath: snap.after.data().imagepath,
//         criteria: snap.after.data().criteria,
//         issuer: snap.after.data().issuer,
//         id: snap.after.data().id,
//         type: snap.after.data().type
//     };
//     if (snap.after.data().alignment) {
//         Badge.alignment = snap.after.data().alignment;
//     }
//     if (snap.after.data().tags) {
//         Badge.tags = snap.after.data().tags;
//     }


//     db.collection('BadgeClass').doc(BadgeId).update(Badge).then(function () {
//         return console.log("BadgeClass Approved");
//     }).catch(err => {
//         console.log(err);
//     });

// });
// app.post('/Approval', (req, res) => {
//     db.collection('user').doc(req.body.uid).collection('issuer').doc(req.body.issuer).collection('BadgeClass').doc(req.body.badge).update({
//         draft: 'false'
//     }).then(doc => {
//         res.json({ "message": "Badge Approved", "BadgeId": doc.id });
//         return console.log("Badge Approved");
//     }).catch(err => {
//         res.json({ "message": "Something Went Wrong", "error": err });
//         return console.log("Something went wrong");
//     })
// });


//export BadgeClass API's


