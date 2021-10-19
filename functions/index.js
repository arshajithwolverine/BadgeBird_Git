const functions = require('firebase-functions');

const admin = require('firebase-admin');

const serviceAccount = require("./serviceaccount.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://openbadges-c7d08.firebaseio.com"
});


const db = admin.firestore();

//express portion
const express = require('express');
const cors = require('cors');





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








const Assertion = require("./Assertion");
exports.Assertion = Assertion.Assertion;

const BadgeClass = require("./BadgeClass");
exports.BadgeClass = BadgeClass.BadgeClass;

const RazorPay = require("./Razorpay");
exports.RazorPay = RazorPay.RazorPay;

const recipients = require("./recipient");
exports.recipients = recipients.recipients;

const userSide = require("./userSide");
exports.userSide = userSide.userSide;
exports.EmailVerification = userSide.EmailVerification;
exports.LinkAccount = userSide.LinkAccount;

const verification = require('./verification');
exports.Verification = verification.Verification;

const baking = require('./baking');
exports.BakingImage = baking.BakingImage;
exports.recipientMail = baking.recipientMail


const unitTest = require('./unitTest');
exports.UnitTest = unitTest.UnitTest;
//recipient


//git
//sending email------------------------------------------------------------------------------------------------------------------------------------------
// const sendgridkey = require("./sendgridkey.json")
// const SENDGRID_API_KEY = sendgridkey.key;

// const sgMail = require('@sendgrid/mail');
// const { send } = require('@sendgrid/mail');
// sgMail.setApiKey(SENDGRID_API_KEY);

// exports.recipientMail = functions.firestore.document('user/{userId}/issuer/{issuerId}/BadgeClass/{BadgeClassId}/recipients/{recipientId}').onCreate(async (snap, context) => {

//     const userId = context.params.userId;
//     const issuerId = context.params.issuerId;
//     const BadgeClassId = context.params.BadgeClassId;
//     const RecipientId = context.params.recipientId;
//     let imageurl = '';
//     const imagedoc = await db.collection('BadgeClass').doc(BadgeClassId).get();
//     imageurl = imagedoc.data().image;
//     console.log(imageurl);


//     let assertionId = await assertionAdd(userId, issuerId, BadgeClassId, RecipientId)
//     functions.logger.log("Return Assetion id : " + assertionId);

//     return db.collection('user').doc(userId).collection('issuer').doc(issuerId).collection('BadgeClass').doc(BadgeClassId).collection('recipients').doc(RecipientId).get().then(doc => {
//         const user = doc.data();

//         const msg = {
//             to: user.email,
//             from: 'pkd16cs016@gecskp.ac.in',
//             subject: 'OpenBadge',
//             //custom template
//             templateId: 'd-f9bb1117f6fc4909a3de1618fad970b4',
//             dynamic_template_data: {
//                 name: user.name,
//                 link: `https://openbadges-c7d08.web.app/Assertion/0/${assertionId}/0`,
//                 imageurl: `${imageurl}`
//             }
//         };
//         mailsend(msg, doc.id, userId, BadgeClassId, issuerId);
//         return console.log(msg.dynamic_template_data);
//     });


// });

// function mailsend(msg, doc, userId, BadgeClassId, issuerId) {
//     sgMail.send(msg).then(() => {
//         return db.collection('user').doc(userId).collection('issuer').doc(issuerId).collection('BadgeClass').doc(BadgeClassId).collection('recipients').doc(doc).update({
//             sendmail: 'true'
//         });
//     }).catch(err => console.log(err));
// }

// //export recipient API's
// let crypto = require('crypto');
// const saltName = 'SANYASAM';
// function hashEmailAddress(email, salt) {
//     var sum = crypto.createHash('sha256');
//     sum.update(email + salt);
//     return 'sha256$' + sum.digest('hex');
// }


// async function assertionAdd(userId, IssuerId, BadgeId, RecipientId) {
//     let Admin;
//     let assertionId;

//     const badgesnap = await db.collection('BadgeClass').doc(BadgeId).get();
//     const badgedata = {
//         "id": badgesnap.data().id,
//         "name": badgesnap.data().name,
//         "description": badgesnap.data().description,
//         "image": badgesnap.data().image,
//         "imagepath": badgesnap.data().imagepath,
//         "criteria": badgesnap.data().criteria
//     }
//     const issuersnap = await db.collection('Issuer').doc(IssuerId).get();
//     const issuerdata = {
//         "id": issuersnap.data().id,
//         "name": issuersnap.data().name,
//         "url": issuersnap.data().url,
//         "email": issuersnap.data().email,

//     }

//     const tempAdmin = await db.collection('Issuer').doc(IssuerId).get();
//     Admin = tempAdmin.data().admin;
//     const snapshot = await db.collection('user').doc(Admin).collection('issuer').doc(IssuerId).collection('BadgeClass').doc(BadgeId).collection('recipients').doc(RecipientId).get();

//     const hashedValue = hashEmailAddress(snapshot.data().email, saltName);


//     var assertion = {
//         "@context": "https://w3id.org/openbadges/v2",
//         type: 'Assertion',
//         recipient: {
//             type: 'email',
//             hashed: true,
//             salt: saltName,
//             identity: hashedValue
//         },
//         badge: snapshot.data().badge,
//         verification: snapshot.data().verification,
//         awarded: false,
//         issuedOn: snapshot.data().issuedOn,
//         revoked: false,
//         revokationReason: '',
//         badgeId: snapshot.data().badgeId,
//         details: [snapshot.data().name, snapshot.data().email, badgesnap.data().name, badgesnap.data().description, issuersnap.data().name, IssuerId]
//     };
//     if (snapshot.data().expires) { assertion.expires = snapshot.data().expires }
//     if (snapshot.data().evidence) { assertion.evidence = snapshot.data().evidence }
//     if (snapshot.data().narrative) { assertion.narrative = snapshot.data().narrative }

//     console.log(assertion);

//     const doc = await db.collection('Assertion').add(assertion);
//     assertionId = doc.id;
//     await db.collection('user').doc(userId).collection('issuer').doc(IssuerId).collection('BadgeClass').doc(BadgeId).collection('recipients').doc(RecipientId).update({
//         assertionId: doc.id
//     });
//     await db.collection('Assertion').doc(doc.id).update({
//         id: `https://us-central1-openbadges-c7d08.cloudfunctions.net/Assertion/Show?id=${doc.id}`
//     });
//     // await db.collection('user').doc(req.body.uid).collection('ReceivedBadges').doc(doc.id).set(assertion);
//     // await db.collection('user').doc(req.body.uid).collection('ReceivedBadges').doc(doc.id).update({
//     //     id: `https://us-central1-openbadges-c7d08.cloudfunctions.net/Assertion/Show?id=${doc.id}`
//     // })


//     //baking image
//     const bakingdata = {
//         "@context": "https://w3id.org/openbadges/v2",
//         "id": `https://us-central1-openbadges-c7d08.cloudfunctions.net/Assertion/Show?id=${doc.id}`,
//         "type": "Assertion",
//         "recipient": {
//             "type": "email",
//             "identity": `${hashedValue}`,
//             "hashed": true,
//             "salt": `${saltName}`
//         },
//         "issuedOn": assertion.issuedOn,
//         "verification": {
//             "type": "hosted"
//         },
//         "badge": {
//             "type": "BadgeClass",
//             "id": `${snapshot.data().badge}`,
//             "name": `${badgedata.id}`,
//             "description": `${badgedata.description}`,
//             "image": `${badgedata.image}`,
//             "criteria": `${badgedata.criteria}`,
//             "issuer": {
//                 "id": `${issuerdata.id}`,
//                 "type": "Issuer",
//                 "name": `${issuerdata.name}`,
//                 "url": `${issuerdata.url}`,
//                 "email": `${issuerdata.email}`
//             }
//         }
//     };

//     await bake(badgedata.imagepath, bakingdata, doc.id);



//     return assertionId;
// }

// const pngitxt = require('png-itxt');

// async function bake(filepath, assertion, doc) {
//     const fileBucket = "gs://openbadges-c7d08.appspot.com/"
//     const filePath = filepath;
//     const contentType = "image/png";


//     const fileName = path.basename(filePath);
//     console.log('file name: ' + fileName);

//     // Download file from bucket.
//     const bucket = admin.storage().bucket(fileBucket);
//     const tempFilePath = path.join(os.tmpdir(), fileName);
//     const metadata = {
//         contentType: contentType,
//     };

//     await bucket.file(filePath).download({ destination: tempFilePath });
//     console.log('Image downloaded locally to', tempFilePath);
//     //read,write,upload
//     const newFileName = 'baked_' + fileName;
//     const convertedFilePath = path.join(os.tmpdir(), newFileName);
//     await fs.createReadStream(tempFilePath).pipe(pngitxt.set({
//         type: 'iTXt',
//         keyword: 'openbadges',
//         compressed: false,
//         compression_type: 0,
//         language: '',
//         translated: '',
//         value: JSON.stringify(assertion)
//     })).pipe(fs.createWriteStream(convertedFilePath));
//     //await pending
//     //udayipp await
//     function1();

//     //15 seconds wait
//     setTimeout(function2, 15000);
//     //end of udayipp await

//     const bakedFileName = `${newFileName}`;
//     await bucket.upload(convertedFilePath, {
//         destination: `bakedBadges/${bakedFileName}`,
//         metadata: metadata,
//         public: true
//     });

//     await db.collection('Assertion').doc(doc).update({
//         image: `https://firebasestorage.googleapis.com/v0/b/openbadges-c7d08.appspot.com/o/bakedBadges%2F${bakedFileName}?alt=media`
//     });
//     // await db.collection('user').doc(uid).collection('ReceivedBadges').doc(doc).update({
//     //     image: `https://firebasestorage.googleapis.com/v0/b/openbadges-c7d08.appspot.com/o/bakedBadges%2F${bakedFileName}?alt=media`
//     // });

//     // fs.createReadStream(convertedFilePath)
//     //     .pipe(pngitxt.get('openbadges', function (err, data) {
//     //         if (!err && data) {
//     //             console.log(data.keyword, ":", data.value)
//     //         }
//     //     }));



//     fs.unlinkSync(tempFilePath);
//     return console.log({ message: "Image baked", filename: `${fileName}` });
// }
// function function1() {
//     // stuff you want to happen right away
//     console.log('await started');
// }

// function function2() {
//     // all the stuff you want to happen after that pause
//     console.log('await completed');
// }


exports.IssuerShow = functions.https.onRequest((req, res) => {
    if (req.body.blahblah === "blahblah") {
        res.json({ "blahblah": "blahblah" });
        return;
    }
    db.collection('Issuer').doc(req.query.id).get().then(snap => {

        const userAgent = req.headers['user-agent'];
        console.log(`user-agent:${userAgent}`)
        const checkData = userAgent.split('/');
        console.log(checkData);
        if (checkData[0] === 'Mozilla') {
            return res.redirect(`https://openbadges-c7d08.web.app/Public/Issuers/${req.query.id}/Badges`);
        } else {
            return res.json(snap.data());
        }

    }).catch(err => {
        res.json({ "message": "something went wrong", "error": err });
    })
});

//RazorPay Payment
const pay = express();
pay.use(cors({ origin: true }));
pay.use(blahblah)

pay.post('/v1', async (req, res) => {
    const orderdata = await db.collection('Orders').doc(req.query.orderid).get();
    const issuerdata = await db.collection('Issuer').doc(orderdata.data().issuer.id).get();
    console.log(req.body);
    if (req.query.flag === '0') {
        console.log("pay entered");
        if (req.body.error) {
            console.log("if part")
            let error = [];
            error = req.body.error;
            console.log(error);
            await db.collection('Orders').doc(req.query.orderid).update({
                status: "failed",
                error: error
            });

            await db.collection('user').doc(orderdata.data().adminUser).collection('issuer').doc(orderdata.data().issuer.id).collection('BadgeClass').doc(orderdata.data().badge.id).collection('Orders').doc(req.query.orderid).update({
                status: "failed",
                error: error
            });
            //res.json({"message" : "Payment Unsuccessful"});
            if (Number(req.query.staff) === 0) {
                console.log(`https://openbadges-c7d08.web.app/Issuers/${issuerdata.data().admin}/${orderdata.data().issuer.id}/Issuer/Badges/${orderdata.data().badge.id}/awards/fail`)
                res.json({
                    "link": `https://openbadges-c7d08.web.app/Issuers/${issuerdata.data().admin}/${orderdata.data().issuer.id}/Issuer/Badges/${orderdata.data().badge.id}/awards/fail`
                })
            } else if (Number(req.query.staff) === 1) {
                console.log(`https://openbadges-c7d08.web.app/Issuers/${issuerdata.data().admin}/${orderdata.data().issuer.id}/Staff/Badges/${orderdata.data().badge.id}/awards/fail`)
                res.json({
                    "link": `https://openbadges-c7d08.web.app/Issuers/${issuerdata.data().admin}/${orderdata.data().issuer.id}/Staff/Badges/${orderdata.data().badge.id}/awards/fail`
                })
            }

        } else {
            console.log("Else part")
            await db.collection('Orders').doc(req.body.razorpay_order_id).update({
                status: "payed",
                paymentId: req.body.razorpay_payment_id
            });

            await db.collection('user').doc(orderdata.data().adminUser).collection('issuer').doc(orderdata.data().issuer.id).collection('BadgeClass').doc(orderdata.data().badge.id).collection('Orders').doc(req.body.razorpay_order_id).update({
                status: "payed",
                paymentId: req.body.razorpay_payment_id
            });
            await db.collection('user').doc(orderdata.data().adminUser).collection('issuer').doc(orderdata.data().issuer.id).collection('BadgeClass').doc(orderdata.data().badge.id).update({
                awardable: admin.firestore.FieldValue.increment(orderdata.data().awardable)
            });
            //res.json({"message" : "Payment Success"});
            if (Number(req.query.staff) === 0) {
                console.log(`https://openbadges-c7d08.web.app/Issuers/${issuerdata.data().admin}/${orderdata.data().issuer.id}/Issuer/Badges/${orderdata.data().badge.id}/awards/success`)
                res.json({
                    "link": `https://openbadges-c7d08.web.app/Issuers/${issuerdata.data().admin}/${orderdata.data().issuer.id}/Issuer/Badges/${orderdata.data().badge.id}/awards/success`
                })
            } else if (Number(req.query.staff) === 1) {
                console.log(`https://openbadges-c7d08.web.app/Issuers/${issuerdata.data().admin}/${orderdata.data().issuer.id}/Staff/Badges/${orderdata.data().badge.id}/awards/success`)
                res.json({
                    "link": `https://openbadges-c7d08.web.app/Issuers/${issuerdata.data().admin}/${orderdata.data().issuer.id}/Staff/Badges/${orderdata.data().badge.id}/awards/success`
                })
            }
        }
    } else if (req.query.flag === '1') {
        console.log("cancel detected");
        await db.collection('Orders').doc(req.query.orderid).update({
            status: "cancelled"
        });

        await db.collection('user').doc(orderdata.data().adminUser).collection('issuer').doc(orderdata.data().issuer.id).collection('BadgeClass').doc(orderdata.data().badge.id).collection('Orders').doc(req.query.orderid).update({
            status: "cancelled"
        });
        //res.json({"message" : "Payment Cancelled"});
        if (Number(req.query.staff) === 0) {
            console.log(`https://openbadges-c7d08.web.app/Issuers/${issuerdata.data().admin}/${orderdata.data().issuer.id}/Issuer/Badges/${orderdata.data().badge.id}/awards`)
            res.json({
                "link": `https://openbadges-c7d08.web.app/Issuers/${issuerdata.data().admin}/${orderdata.data().issuer.id}/Issuer/Badges/${orderdata.data().badge.id}/awards`
            })
        } else if (Number(req.query.staff) === 1) {
            console.log(`https://openbadges-c7d08.web.app/Issuers/${issuerdata.data().admin}/${orderdata.data().issuer.id}/Staff/Badges/${orderdata.data().badge.id}/awards`)
            res.json({
                "link": `https://openbadges-c7d08.web.app/Issuers/${issuerdata.data().admin}/${orderdata.data().issuer.id}/Staff/Badges/${orderdata.data().badge.id}/awards`
            })
        }

    }
})

exports.RazorPayCallBack = functions.https.onRequest(pay);



//----------------------------------------------------------------------------------------------------------
//other fuctions

//date
function nowdate() {
    var today = new Date();
    var dd = today.getDate();

    var mm = today.getMonth() + 1;
    var yyyy = today.getFullYear();
    if (dd < 10) {
        dd = '0' + dd;
    }

    if (mm < 10) {
        mm = '0' + mm;
    }
    today = yyyy + '/' + mm + '/' + dd;
    return today;
}

//date formating
function dateformat(tstamp) {
    let time = tstamp.toDate();
    let dateobj = new Date(time);

    let month = dateobj.getMonth() + 1;
    let year = dateobj.getFullYear();
    let date = dateobj.getDate();
    let hr = dateobj.getHours();

    let mint = dateobj.getMinutes();
    let sec = dateobj.getSeconds();
    // console.log(`${hr}:${mint}    ${date}/${month}/${year}`);
    console.log(`${year}-${month}-${date}T${hr}:${mint}:${sec}Z`);
    return `${year}-${month}-${date}T${hr}:${mint}:${sec}Z`;

}


//axios 


// exports.scheduledFunction = functions.pubsub.schedule('every 1 minutes').onRun((context) => {
//     const axios = require('axios');
//     console.log('This will be run every 5 minutes!');


//     axios.all([
//         axios.post("https://us-central1-openbadges-c7d08.cloudfunctions.net/Assertion", { blahblah: "blahblah" }),
//         axios.post("https://us-central1-openbadges-c7d08.cloudfunctions.net/BadgeClass", { blahblah: "blahblah" }),
//         axios.post("https://us-central1-openbadges-c7d08.cloudfunctions.net/IssuerShow", { blahblah: "blahblah" }),
//         axios.post("https://us-central1-openbadges-c7d08.cloudfunctions.net/recipients", { blahblah: "blahblah" }),
//         axios.post("https://us-central1-openbadges-c7d08.cloudfunctions.net/userSide", { blahblah: "blahblah" }),

//     ]).then(axios.spread((response1, response2, response3, response4, response5) => {

//         console.log("Finished")

//     })).catch(error => {
//         console.log(error);
//     });
//     return null;
// });


async function blahblah(req, res, next) {
    if (req.body.blahblah === "blahblah") {
        res.json({ "blahblah": "blahblah" });
        return;
    } else {
        return next();
    }
}