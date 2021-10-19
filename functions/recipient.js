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




app.post('/awardable', async (req, res) => {
    uid = req.body.uid;
    let badgedata = await db.collection('user').doc(uid).collection('issuer').doc(req.body.issuer).collection('BadgeClass').doc(req.body.badge).get();
    //if staff is operating
    if (badgedata.data() === undefined) {
        const issuerdata = await db.collection('Issuer').doc(req.body.issuer).get();
        let staffs = [];
        staffs = issuerdata.data().staff;
        if (staffs.includes(String(uid))) {
            uid = issuerdata.data().admin;

        }
        else {
            return res.json({ "message": "Protected :)" });
        }

    }

    badgedata = await db.collection('user').doc(uid).collection('issuer').doc(req.body.issuer).collection('BadgeClass').doc(req.body.badge).get();

    if (badgedata.data().awardable === 0) {
        return res.json({ "message": "recharge" });
    }
    else {
        return res.json({ "message": "ok" });
    }
});

//recipient adding in BadgeClass
app.post('/Adding', async (req, res) => {

    uid = req.body.uid;

    let count = Number(req.body.count);
    let candedates = req.body.candedates;
    let flag = 1;
    let recipentClass
    let badgedata = await db.collection('user').doc(uid).collection('issuer').doc(req.body.issuer).collection('BadgeClass').doc(req.body.badge).get();


    //if staff is operating
    if (badgedata.data() === undefined) {
        const issuerdata = await db.collection('Issuer').doc(req.body.issuer).get();
        let staffs = [];
        staffs = issuerdata.data().staff;
        if (staffs.includes(String(uid))) {
            uid = issuerdata.data().admin;

        }
        else {
            return res.json({ "message": "Protected :)" });
        }

    }

    badgedata = await db.collection('user').doc(uid).collection('issuer').doc(req.body.issuer).collection('BadgeClass').doc(req.body.badge).get();

    if (badgedata.data().awardable < count) {
        return res.json({ "message": "recharge", "awardable": badgedata.data().awardable, "count": req.body.count });
    }
    else {
        for (i = 0; i < count; i++) {
            recipentClass = {
                name: candedates[i].name,
                email: candedates[i].email,
                address: candedates[i].address,
                issuedOn: candedates[i].issuedate,
                sendmail: "false",
                badge: `https://us-central1-openbadges-c7d08.cloudfunctions.net/BadgeClass/Show?id=${req.body.badge}`,
                badgeId: req.body.badge,
                verification: {
                    "type": "hosted"
                },
                revoked: false
            };
            if (candedates[i].evidence && candedates[i].evidence !== '') {
                const checkEvidence = candedates[i].split(':');
                if (checkEvidence[0] === 'https' || checkEvidence[0] === 'http') {
                    recipentClass.evidence = candedates[i].evidence
                } else {
                    return res.json({
                        'message': 'Evidence should be a link (eg : http://example.com)'
                    });
                }
            }
            if (candedates[i].narrative && candedates[i].narrative !== '') { recipentClass.narrative = candedates[i].narrative }
            if (candedates[i].expires && candedates[i].expires !== '') { recipentClass.expires = candedates[i].expires }

            recipentadding(uid, req.body.issuer, req.body.badge, recipentClass);
        }

        if (flag === 1) {
            res.json({ "message": `Recipients Added` });
        }
        else {
            res.json({ "message": `Recipients not added ` });
        }

    }

});



async function recipentadding(uid, issuer, badge, recipentClass) {
    await db.collection('user').doc(uid).collection('issuer').doc(issuer).collection('BadgeClass').doc(badge).collection('recipients').add(recipentClass);
    await db.collection('user').doc(uid).collection('issuer').doc(issuer).collection('BadgeClass').doc(badge).update({ awardable: admin.firestore.FieldValue.increment(-1) })
}

const crypto = require('crypto');
const { resolve } = require('path');

const ENCRYPTION_KEY = `pmgticrwqhynuofvyuofbymxzdrqsyjm` // Must be 256 bits (32 characters)

function decrypt(text) {
    let textParts = text.split(':');
    let iv = Buffer.from(textParts.shift(), 'hex');
    let encryptedText = Buffer.from(textParts.join(':'), 'hex');
    let decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);

    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString();
}

app.post('/Revoke', async (req, res) => {
    const uid = req.body.uid;
    const issuer = req.body.issuerId;
    const recipients = req.body.recipients;
    const badge = req.body.badgeId;
    let reason = 'No reason specified'
    if (req.body.reason && req.body.reason !== '') {
        reason = req.body.reason;
    }
    let promises = [];
    recipients.forEach(id => {
        promises.push(db.collection('user').doc(uid).collection('issuer').doc(issuer).collection('BadgeClass').doc(badge).collection('recipients').doc(id).get());
    });

    const recipentCollection = await Promise.all(promises);

    let promises2 = [];
    let work1 = [];
    recipentCollection.forEach(doc => {
        promises2.push(db.collection('Assertion').doc(doc.data().assertionId).get());
        work1.push(db.collection('user').doc(uid).collection('issuer').doc(issuer).collection('BadgeClass').doc(badge).collection('recipients').doc(doc.id).update({ revoked: true, revokationReason: reason }));
    })

    const assertionCollection = await Promise.all(promises2);
    let work2 = [];
    let work3 = [];
    assertionCollection.forEach(doc => {
        let recipentId = doc.data().recipentId;
        if (recipentId !== undefined) {
            recipentId = decrypt(doc.data().recipentId);
            console.log(recipentId);
            work2.push(db.collection('user').doc(recipentId).collection('ReceivedBadges').doc(doc.id).update({ revoked: true, revokationReason: reason }));
        }
        work3.push(db.collection('Assertion').doc(doc.id).update({ revoked: true, revokationReason: reason }));
    });
    try {
        await Promise.all(work1);
        await Promise.all(work2);
        await Promise.all(work3);
        return res.json({
            'message': 'success'
        });
    } catch (error) {
        res.json({
            'message': 'failed',
            'error': error
        })
    }

})

//recipient Approval

// app.post('/Approval', (req, res) => {
//     db.collection('user').doc(req.body.uid).collection('issuer').doc(req.body.issuer).collection('BadgeClass').doc(req.body.badge).update({
//         requestapproval: 'true'
//     }).then(doc => {
//         res.json({ "message": "Recipients Approved", "BadgeId": doc.id });
//         return console.log("Badge Approved");
//     }).catch(err => {
//         res.json({ "message": "Something Went Wrong", "error": err });
//         return console.log("Something went wrong");
//     })
// });
exports.recipients = functions.https.onRequest(app);

