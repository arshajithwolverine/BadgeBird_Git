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

//encoding,decoding
const crypto = require('crypto');

const ENCRYPTION_KEY = `pmgticrwqhynuofvyuofbymxzdrqsyjm` // Must be 256 bits (32 characters)
const IV_LENGTH = 16; // For AES, this is always 16

function encrypt(text) {
    let iv = crypto.randomBytes(IV_LENGTH);
    let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);

    encrypted = Buffer.concat([encrypted, cipher.final()]);

    return iv.toString('hex') + ':' + encrypted.toString('hex');
}



//assertionAdd
app.post('/Add', async (req, res) => {
    console.log(req.body.badge);
    const doc = await db.collection('Assertion').doc(req.body.badge).get()
    const recBadge = doc.data();
    if (recBadge.awarded === false) {
        console.log(recBadge);
        const badgeId = recBadge.badgeId;
        console.log(badgeId);
        const badgeDoc = await db.collection('BadgeClass').doc(badgeId).get();
        const IssuerId = badgeDoc.data().issuerId;
        const issuerDoc = await db.collection('Issuer').doc(IssuerId).get();
        await db.collection('user').doc(req.body.uid).collection('ReceivedBadges').doc(req.body.badge).set(recBadge);
        await db.collection('user').doc(req.body.uid).collection('ReceivedBadges').doc(req.body.badge).update({
            issuerName: issuerDoc.data().name,
            issueDocId: IssuerId,
            badgeName: badgeDoc.data().name,
            badgeDescription: badgeDoc.data().description,
            recipientName: recBadge.details[0],
            recipientMail: recBadge.details[1],
            awarded: true,
            private: false
        });
        const recipentId = encrypt(req.body.uid);
        console.log(`${req.body.uid}: encrypted : ${recipentId}`)
        await db.collection('Assertion').doc(req.body.badge).update({
            awarded: true,
            recipentId: recipentId
        });

        res.json({ message: 'Assertion added', id: `${req.body.badge}` });
    }
    else if (recBadge.awarded === true) {
        res.json({ message: 'Assertion already Awarded' });
    }

});

app.post('/BadgePrivate', async (req, res) => {
    const uid = req.body.uid;
    const badgeId = req.body.badgeid;

    await db.collection('user').doc(uid).collection('ReceivedBadges').doc(badgeId).update({
        private: true
    });

    res.json({
        'message': 'success'
    });
})

app.post('/BadgePublic', async (req, res) => {
    const uid = req.body.uid;
    const badgeId = req.body.badgeid;

    await db.collection('user').doc(uid).collection('ReceivedBadges').doc(badgeId).update({
        private: false
    });

    res.json({
        'message': 'success'
    });
})

//collection
//1. Create
app.post('/CollectionCreate', (req, res) => {
    db.collection('user').doc(req.body.uid).collection('collection').add({
        name: req.body.name,
        description: req.body.description,
        badges: req.body.collection,
        private: false
    }).then(doc => {
        return res.json({ "message": "Collection Created", "doc": doc.id });
    }).catch(err => {
        res.json({ "message": "Collection Not Created", "error": err });
    })

});
app.post('/CollectionPrivate', async (req, res) => {
    const uid = req.body.uid;
    const collectionId = req.body.collectionid;

    await db.collection('user').doc(uid).collection('collection').doc(collectionId).update({
        private: true
    });

    res.json({
        'message': 'success'
    });
})

app.post('/CollectionPublic', async (req, res) => {
    const uid = req.body.uid;
    const collectionId = req.body.collectionid;

    await db.collection('user').doc(uid).collection('collection').doc(collectionId).update({
        private: false
    });

    res.json({
        'message': 'success'
    });
})

//2. Add badges
app.post('/CollectionAdd', async (req, res) => {

    let arr = [];
    arr = req.body.collection;
    const collection = await db.collection('user').doc(req.body.uid).collection('collection').doc(req.body.collectionid).get();
    let beforearray = [];
    beforearray = collection.data().badges;

    arr.forEach(element => {
        beforearray.push(element);
    });

    db.collection('user').doc(req.body.uid).collection('collection').doc(req.body.collectionid).update({
        badges: beforearray
    }).then(doc => {
        return res.json({ "message": "collection updated" });
    }).catch(err => {
        res.json({ "message": "something went wrong", "error": err });
    })

});
//3. Delete badges
app.post('/CollectionUpdate', async (req, res) => {

    let arr = req.body.collection;

    db.collection('user').doc(req.body.uid).collection('collection').doc(req.body.collectionid).update({
        badges: arr
    }).then(doc => {
        return res.json({ "message": "collection updated" });
    }).catch(err => {
        res.json({ "message": "something went wrong", "error": err });
    })


})

//4. Delete collection
app.post('/CollectionDelete', async (req, res) => {

    await db.collection('user').doc(req.body.uid).collection('collection').doc(req.body.collectionid).delete()
    return res.json({ "message": "collection deleted" });
})


//assertionShow
app.get('/Show', (req, res) => {
    db.collection('Assertion').doc(req.query.id).get().then(snapshot => {
        let badge = snapshot.data();
        badge.details = null;


        const userAgent = req.headers['user-agent'];
        console.log(`user-agent:${userAgent}`)
        const checkData = userAgent.split('/');
        console.log(checkData);
        if (checkData[0] === 'Mozilla') {
            return res.redirect(`https://openbadges-c7d08.web.app/Assertions/${req.query.id}`)
        } else {
            return res.json(badge);
        }



    }).catch(error => {
        return res.json({ message: 'Someting Went Wrong', error: `${error}` });
    });
});

exports.Assertion = functions.https.onRequest(app);
