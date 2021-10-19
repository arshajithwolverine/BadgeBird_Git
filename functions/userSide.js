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





let crypto = require('crypto');
//sending email------------------------------------------------------------------------------------------------------------------------------------------
const sendgridkey = require("./sendgridkey.json")
const SENDGRID_API_KEY = sendgridkey.key;

const sgMail = require('@sendgrid/mail');
const { send } = require('@sendgrid/mail');
sgMail.setApiKey(SENDGRID_API_KEY);

app.post('/AddStaff', (req, res) => {
    var uid = req.body.uid;
    db.collection('user').doc(uid).collection('issuer').doc(req.body.issuer).collection('staffs').add({
        email: req.body.email,
        status: 'false'
    }).then(async doc => {
        const issuerData = await db.collection('user').doc(uid).collection('issuer').doc(req.body.issuer).get();

        const msg = {
            to: req.body.email,
            from: 'pkd16cs016@gecskp.ac.in',
            subject: 'Invitations as Staff',
            //custom template
            templateId: 'd-b529389b41a949afa82018d86bdc8f60',
            dynamic_template_data: {
                content: `${issuerData.data().name} invited you as an OpenBadges Staff!`,
                link: `https://openbadges-c7d08.web.app/Invitation/${req.body.issuer}/${doc.id}`
            }
        };

        await sgMail.send(msg).then(() => {
            res.json({ "message": "Mail Send" })
            return console.log("mail sent");
        }).catch(err => {
            console.log(err);
            res.json({ "Message": "Failed", "error": err });
        });
        return console.log("Mail Complete");

    }).catch(err => {
        console.log(err);
    });
});

//New 3
app.post('/DeleteStaff', async (req, res) => {
    const uid = req.body.uid;
    const staffDocId = req.body.staffId;
    const issuer = req.body.issuerId;
    const staffDocData = await db.collection('user').doc(uid).collection('issuer').doc(issuer).collection('staffs').doc(staffDocId).get();
    const staffId = staffDocData.data().staffId;
    const staffData = await db.collection('user').doc(staffId).collection('issuer').doc('invited').get();
    let invited = staffData.data().issuers;
    let newArr = [];
    invited.forEach(data => {
        if (data.issuerid !== issuer) {
            newArr.push(data);
        }
    })
    try {
        await db.collection('user').doc(staffId).collection('issuer').doc('invited').update({
            issuers: newArr
        });
    } catch (error) {
        console.log('Error Skipped')
    }
    try {
        await db.collection('user').doc(uid).collection('issuer').doc(issuer).collection('staffs').doc(staffDocId).delete();
    } catch (error) {
        console.log('Error Skipped')
    }
    try {
        staffDelete(uid, issuer, staffId)
    } catch (error) {
        console.log('Error Skipped')
    }
    res.json({
        "message": "success"
    });
});

async function staffDelete(admin, issuer, staff) {
    const issuerdata = await db.collection('Issuer').doc(issuer).get();
    if (issuerdata.data().staff !== undefined) {
        let arr = [];
        arr = issuerdata.data().staff;
        let newArr = [];
        arr.forEach(data => {
            if (data !== staff) {
                newArr.push(data);
            }
        })
        await db.collection('Issuer').doc(issuer).update({
            staff: newArr
        });

    }
    const admindata = await db.collection('user').doc(admin).collection('issuer').doc(issuer).get();
    if (admindata.data().staff !== undefined) {
        let arr = [];
        arr = admindata.data().staff;
        let newArr = [];
        arr.forEach(data => {
            if (data !== staff) {
                newArr.push(data);
            }
        })
        await db.collection('user').doc(admin).collection('issuer').doc(issuer).update({
            staff: newArr
        });

    }
}

async function staffAddInAdmin(admin, issuer, staff) {
    const issuerdata = await db.collection('Issuer').doc(issuer).get();
    if (issuerdata.data().staff === undefined) {
        await db.collection('Issuer').doc(issuer).update({
            staff: [staff]
        });

    } else {
        let arr = [];
        arr = issuerdata.data().staff;
        arr.push(staff);
        await db.collection('Issuer').doc(issuer).update({
            staff: arr
        });

    }
    const admindata = await db.collection('user').doc(admin).collection('issuer').doc(issuer).get();
    if (admindata.data().staff === undefined) {
        await db.collection('user').doc(admin).collection('issuer').doc(issuer).update({
            staff: [staff]
        });

    } else {
        let arr = [];
        arr = admindata.data().staff;
        arr.push(staff);
        await db.collection('user').doc(admin).collection('issuer').doc(issuer).update({
            staff: arr
        });

    }
}

app.post('/StaffAccept', async (req, res) => {
    const admin = await db.collection('Issuer').doc(req.body.issuer).get();
    const staff = req.body.uid;
    const issuer = req.body.issuer;
    const verifydoc = req.body.staffid;
    const inviteDoc = await db.collection('user').doc(admin.data().admin).collection('issuer').doc(issuer).collection('staffs').doc(verifydoc).get();
    if (!inviteDoc.exists) {
        return res.json({
            'message': 'Staff Not Added',
            'error': 'Invitation revoked by admin'
        });
    }

    if (inviteDoc.data().status === 'true') {
        return res.json({
            'message': 'Staff Not Added',
            'error': 'Invitation already accepted'
        });
    }

    const snap = await db.collection('user').doc(staff).collection('issuer').doc('invited').get();
    if (snap.exists) {
        staffAddInAdmin(admin.data().admin, issuer, staff);
        let arr = snap.data().issuers;
        arr.push({ "adminid": `${admin.data().admin}`, "issuerid": `${issuer}`, "name": `${admin.data().name}`, "email": `${admin.data().email}` });
        db.collection('user').doc(staff).collection('issuer').doc('invited').update({
            issuers: arr
        }).then(async doc => {
            await db.collection('user').doc(admin.data().admin).collection('issuer').doc(issuer).collection('staffs').doc(verifydoc).update({
                status: 'true',
                staffId: staff
            })
            return res.json({ 'message': 'Staff Added' });
        }).catch(err => {
            return res.json({ 'message': 'Staff Not Added', 'error': err });
        });
    }
    else {
        staffAddInAdmin(admin.data().admin, issuer, staff);
        db.collection('user').doc(staff).collection('issuer').doc('invited').set({
            issuers: [{ "adminid": `${admin.data().admin}`, "issuerid": `${issuer}`, "name": `${admin.data().name}`, "email": `${admin.data().email}` }]
        }).then(async doc => {
            await db.collection('user').doc(admin.data().admin).collection('issuer').doc(issuer).collection('staffs').doc(verifydoc).update({
                status: 'true',
                staffId: staff
            })
            return res.json({ 'message': 'Staff Added' });
        }).catch(err => {
            return res.json({ 'message': 'Staff Not Added', 'error': err });
        });
    }



});

app.post('/IssuerAdd', (req, res) => {

    let issuerClass = {
        "@context": "https://w3id.org/openbadges/v2",
        admin: req.body.uid,
        name: req.body.name,
        email: req.body.email,
        description: req.body.description,
        type: 'Issuer'
    };

    if (req.body.url && req.body.url !== '') {
        const urlCheck = req.body.url.split(':');
        if (urlCheck[0] === 'http' || urlCheck[0] === 'https') {
            issuerClass.url = req.body.url;
        } else {
            return res.json({ 'message': 'Url should be a link (eg: http://example.com))' });
        }
    }
    if (req.body.image && req.body.image !== '') { issuerClass.image = req.body.image }
    if (req.body.telephone && req.body.telephone !== '') {
        const telephone = String(req.body.telephone);
        let teleCheck
        if (telephone.charAt(0) === '+') {
            teleCheck = telephone.substring(1,);
            teleCheck = Number(teleCheck);
            if (!isNaN(teleCheck)) {
                return res.json({ 'message': 'Enter valid phone number' });
            } else {
                issuerClass.telephone = telephone;
            }
        } else {
            teleCheck = Number(teleCheck);
            if (!isNaN(teleCheck)) {
                return res.json({ 'message': 'Enter valid phone number' });
            } else {
                issuerClass.telephone = telephone;
            }
        }
    }
    console.log(issuerClass);
    db.collection('Issuer').add(issuerClass).then(async doc => {
        await db.collection('Issuer').doc(doc.id).update({
            id: `https://us-central1-openbadges-c7d08.cloudfunctions.net/IssuerShow?id=${doc.id}`
        })
        await db.collection('user').doc(req.body.uid).collection('issuer').doc(doc.id).set(issuerClass);
        await db.collection('user').doc(req.body.uid).collection('issuer').doc(doc.id).update({
            id: `https://us-central1-openbadges-c7d08.cloudfunctions.net/IssuerShow?id=${doc.id}`
        });
        res.json({ 'Message': 'Issuer Added', "doc": doc.id });
        return console.log("BadgeClass Approved");
    }).catch(err => {
        console.log(err);
        res.json({ "Message": "Issuer Not Added", "error": err });
    });
});

//new 1
app.post('/IssuerEdit', async (req, res) => {

    var issuerClass = {
        "@context": "https://w3id.org/openbadges/v2",
        admin: req.body.uid,
        type: 'Issuer'
    };
    if (req.body.name) { issuerClass.name = req.body.name }
    if (req.body.email) { issuerClass.email = req.body.email }
    if (req.body.description) { issuerClass.description = req.body.description }
    if (req.body.url) { issuerClass.url = req.body.url }
    if (req.body.image) { issuerClass.image = req.body.image }
    if (req.body.telephone) { issuerClass.telephone = String(req.body.telephone) }
    console.log(issuerClass);
    await db.collection('Issuer').doc(req.body.issuerId).update(issuerClass)
    await db.collection('user').doc(req.body.uid).collection('issuer').doc(req.body.issuerId).update(issuerClass);
    console.log("BadgeClass Approved");
    res.json({ 'Message': 'Issuer Added', "doc": req.body.issuerId });
});

//new 2
app.post('/IssuerDelete', async (req, res) => {
    const issuerId = req.body.issuerId;
    const badgeCollection = await db.collection('user').doc(req.body.uid).collection('issuer').doc(issuerId).collection('BadgeClass').get();
    let promises = [];
    badgeCollection.forEach(doc => {
        promises.push(db.collection('Assertion').where('badgeId', '==', doc.id).get())
    });

    const checkData = await Promise.all(promises);
    console.log(checkData);
    let flag = true;
    if (checkData !== undefined) {
        checkData.forEach(data => {
            if (data.size !== 0) {
                flag = false;
            }
        })
    }


    if (flag) {
        db.collection('user').doc(req.body.uid).collection('issuer').doc(issuerId).delete().then(async doc => {
            await db.collection('Issuer').doc(issuerId).delete();
            return res.json({ 'message': 'Issuer Deleted' });
        }).catch(error => {
            return res.json({ 'message': 'blocked', 'error': error });
        })
    } else {
        return res.json({ "message": "blocked" })
    }


});

//signuproutine
app.post('/SignUpRoutine', async (req, res) => {
    db.collection('user').doc(req.body.uid).get().then(async doc => {
        if (doc.data() === undefined) {
            console.log("empty");
            await db.collection('user').doc(req.body.uid).set({
                linkedAcc: [req.body.uid],
                [req.body.uid]: true
            });


            admin.auth().getUser(req.body.uid).then(function (userRecord) {
                return console.log('Successfully fetched user data:', userRecord.toJSON());
            }).catch(function (error) {
                console.log('Error fetching user data:', error);
            });



            res.json({ "message": "Initiated" });





        } else {
            res.json({ "message": "Already Initiated" });
        }
        return console.log("routine");
    }).catch(async err => {
        res.json({ "message": "something went wrong", "error": err });
    });
});

// app.post('/AddAccount', async (req, res) => {
//     const mainacc = await db.collection('user').where('linkedAcc', 'array-contains', req.body.adminId).get();
//     let linkedAcc = mainacc.docs[0].data().linkedAcc;
//     linkedAcc.push(req.body.userId);
//     await db.collection('user').doc(mainacc.docs[0].id).update({
//         linkedAcc: linkedAcc,
//         [req.body.userId]: true
//     })
//     res.json({ "message": "Account linked" });
// });

//haris functions
app.post('/AddAccount', async (req, res) => {

    admin
        .auth()
        .getUserByEmail(req.body.linkemail)
        .then(async (userRecord) => {
            const CheckUser = (await db.collection("user").where("linkedAcc", "array-contains", userRecord.uid).limit(1).get()).size;
            if (CheckUser) {
                return res.json({ "message": "An account with this email already exists. Try again with another email" });
            }
            else {
                const CheckUnverifiedAdded = (await db.collection("user").doc(req.body.uid).collection("Unverified").where("linkemail", "==", req.body.linkemail).limit(1).get()).size;
                if (CheckUnverifiedAdded) {
                    return res.json({ "message": "This email has already been added and not yet verified." });
                }
                await db.collection("user").doc(req.body.uid).collection("Unverified").add({ "linkemail": req.body.linkemail, "userid": userRecord.uid, "verified": false })
                return res.json({ 'message': 'success' });
            }
        })
        .catch((error) => {
            if (error.code !== "auth/user-not-found") {
                return res.json({ 'message': error.message })
            }
            return admin
                .auth()
                .createUser({
                    email: req.body.linkemail,
                })
                .then(async snap => {
                    await db.collection("user").doc(req.body.uid).collection("Unverified").add({ "linkemail": req.body.linkemail, "userid": snap.uid, "verified": false })
                    return res.json({ 'message': 'success' });
                })
                .catch(err => {
                    functions.logger.error(err);
                    return res.json({ 'message': 'failed', 'error': err });
                })
        });

});

// app.get('/User/:userid/Verify/:verifyid', async (req, res) => {

//     db.collection("user").doc(req.params.userid).collection("Unverified").doc(req.params.verifyid).get()
//         .then(async snap => {
//             if (snap.exists) {
//                 await db.collection("user").doc(req.params.userid).collection("Unverified").doc(req.params.verifyid).delete();
//                 await db.collection("user").doc(req.params.userid).update({ "linkedAcc": admin.firestore.FieldValue.arrayUnion(snap.data().userid) })
//                 return res.redirect(`https://openbadges-c7d08.web.app/User/`);
//             }
//             else {
//                 return res.json(false);
//             }
//         })
//         .catch(err => {
//             functions.logger.error(err);
//             return res.json(false);
//         })

// })


app.post('/ViewLinkedEmails', async (req, res) => {
    const data = [];
    db.collection("user").doc(req.body.uid).get()
        .then(snap => {
            const promise = [];
            snap.data().linkedAcc.forEach(uid => {
                promise.push(admin.auth().getUser(uid));
            })
            return Promise.all(promise);
        })
        .then(snap => {
            snap.forEach(doc => {
                data.push({ email: doc.email, verified: true, provider: doc.providerData[0].providerId })
            })
            return db.collection("user").doc(req.body.uid).collection("Unverified").get();
        })
        .then(snap => {
            snap.forEach(doc => {
                data.push({ email: doc.data().linkemail, verified: false, provider: "mail" })
            })
            return res.json(data);
        })
        .catch(err => {
            functions.logger.error(err);
            return res.json(false);
        })



})


exports.userSide = functions.https.onRequest(app);

exports.LinkAccount = functions.https.onRequest(async (req, res) => {

    db.collection("user").doc(req.query.userid).collection("Unverified").doc(req.query.verifyid).get()
        .then(async snap => {
            if (snap.exists) {
                await db.collection("user").doc(req.query.userid).collection("Unverified").doc(req.query.verifyid).delete();
                await db.collection("user").doc(req.query.userid).update({ "linkedAcc": admin.firestore.FieldValue.arrayUnion(snap.data().userid) })
                return res.redirect(`https://openbadges-c7d08.web.app/User/`);
            }
            else {
                return res.json(false);
            }
        })
        .catch(err => {
            functions.logger.error(err);
            return res.json(false);
        })

})


//sending email------------------------------------------------------------------------------------------------------------------------------------------

exports.EmailVerification = functions.runWith({ timeoutSeconds: 300 }).firestore.document('user/{userid}/Unverified/{verifyid}').onCreate(async (snap, context) => {
    const userid = context.params.userid;
    const verifyid = context.params.verifyid;


    const msg = {
        to: snap.data().linkemail,
        from: 'pkd16cs016@gecskp.ac.in',
        subject: 'OpenBadge',
        //custom template
        templateId: 'd-222c422d38d94b6a8f13ee60bad001df',
        dynamic_template_data: {
            content: 'Link your account',
            link: `https://us-central1-openbadges-c7d08.cloudfunctions.net/LinkAccount?userid=${userid}&verifyid=${verifyid}`
        }
    };
    sgMail.send(msg).then(() => {
        return db.collection("user").doc(userid).collection("Unverified").doc(verifyid).update({
            sendmail: 'true'
        });
    }).catch(err => console.log(err));
})