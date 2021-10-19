const functions = require('firebase-functions');
const admin = require('firebase-admin');
const db = admin.firestore();

//storage
const { Storage } = require('@google-cloud/storage');
const storage = new Storage();
const path = require('path');
const os = require('os');
const fs = require('fs');

//sending email------------------------------------------------------------------------------------------------------------------------------------------
const sendgridkey = require("./sendgridkey.json")
const SENDGRID_API_KEY = sendgridkey.key;
const sgMail = require('@sendgrid/mail');
const { send } = require('@sendgrid/mail');
sgMail.setApiKey(SENDGRID_API_KEY);

let crypto = require('crypto');
const saltName = 'SANYASAM';
function hashEmailAddress(email, salt) {
    var sum = crypto.createHash('sha256');
    sum.update(email + salt);
    return 'sha256$' + sum.digest('hex');
}
const pngitxt = require('png-itxt');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))


exports.BakingImage = functions.runWith({ timeoutSeconds: 300 }).firestore.document('user/{userId}/issuer/{issuerId}/BadgeClass/{BadgeId}/recipients/{recipientId}').onCreate(async (snap, context) => {
    const userId = context.params.userId;
    const IssuerId = context.params.issuerId;
    const BadgeId = context.params.BadgeId;
    const RecipientId = context.params.recipientId;

    const badgesnap = await db.collection('BadgeClass').doc(BadgeId).get();
    const badgedata = {
        "id": badgesnap.data().id,
        "name": badgesnap.data().name,
        "description": badgesnap.data().description,
        "image": badgesnap.data().image,
        "imagepath": badgesnap.data().imagepath,
        "criteria": badgesnap.data().criteria
    }
    const issuersnap = await db.collection('Issuer').doc(IssuerId).get();
    const issuerdata = {
        "id": issuersnap.data().id,
        "name": issuersnap.data().name,
        "url": issuersnap.data().url,
        "email": issuersnap.data().email,

    }

    const recipientsnap = snap;

    const hashedValue = hashEmailAddress(recipientsnap.data().email, saltName);


    let assertion = {
        "@context": "https://w3id.org/openbadges/v2",
        type: 'Assertion',
        recipient: {
            type: 'email',
            hashed: true,
            salt: saltName,
            identity: hashedValue
        },
        badge: recipientsnap.data().badge,
        verification: recipientsnap.data().verification,
        awarded: false,
        issuedOn: recipientsnap.data().issuedOn,
        revoked: false,
        revokationReason: '',
        badgeId: recipientsnap.data().badgeId,
        details: [recipientsnap.data().name, recipientsnap.data().email, badgesnap.data().name, badgesnap.data().description, issuersnap.data().name, IssuerId]
    };
    if (recipientsnap.data().expires) { assertion.expires = recipientsnap.data().expires }
    if (recipientsnap.data().evidence && recipientsnap.data().evidence !== '') { assertion.evidence = recipientsnap.data().evidence }
    if (recipientsnap.data().narrative) { assertion.narrative = recipientsnap.data().narrative }


    const assertionDoc = await db.collection('Assertion').add({
        baked: false
    });
    //baking image
    const bakingdata = {
        "@context": "https://w3id.org/openbadges/v2",
        "id": `https://us-central1-openbadges-c7d08.cloudfunctions.net/Assertion/Show?id=${assertionDoc.id}`,
        "type": "Assertion",
        "recipient": {
            "type": "email",
            "identity": `${hashedValue}`,
            "hashed": true,
            "salt": `${saltName}`
        },
        "issuedOn": assertion.issuedOn,
        "verification": {
            "type": "hosted"
        },
        "badge": {
            "type": "BadgeClass",
            "id": `${badgedata.id}`,
            "name": `${badgedata.name}`,
            "description": `${badgedata.description}`,
            "image": `${badgedata.image}`,
            "criteria": `${badgedata.criteria}`,
            "issuer": {
                "id": `${issuerdata.id}`,
                "type": "Issuer",
                "name": `${issuerdata.name}`,
                "url": `${issuerdata.url}`,
                "email": `${issuerdata.email}`
            }
        }
    };


    const fileBucket = "gs://openbadges-c7d08.appspot.com/"
    const filePath = badgedata.imagepath;
    const contentType = "image/png";


    let fileName = path.basename(filePath);
    fileName = `${Math.floor(Math.random() * 100000000000000)}${fileName}`
    console.log('file name: ' + fileName);

    // Download file from bucket.
    const bucket = admin.storage().bucket(fileBucket);
    const tempFilePath = path.join(os.tmpdir(), fileName);
    const metadata = {
        contentType: contentType,
    };

    await bucket.file(filePath).download({ destination: tempFilePath });
    console.log('Image downloaded locally to', tempFilePath);
    //read,write,upload
    const newFileName = 'baked_' + fileName;
    const convertedFilePath = path.join(os.tmpdir(), newFileName);
    await fs.createReadStream(tempFilePath).pipe(pngitxt.set({
        type: 'iTXt',
        keyword: 'openbadges',
        compressed: false,
        compression_type: 0,
        language: '',
        translated: '',
        value: JSON.stringify(bakingdata)
    })).pipe(fs.createWriteStream(convertedFilePath));
    await delay(30000); //delay to complete baking
    const bakedFileName = `${newFileName}`;
    await bucket.upload(convertedFilePath, {
        destination: `bakedBadges/${bakedFileName}`,
        metadata: metadata,
        public: true
    });

    assertion.image = `https://firebasestorage.googleapis.com/v0/b/openbadges-c7d08.appspot.com/o/bakedBadges%2F${bakedFileName}?alt=media`;
    assertion.baked = true;
    assertion.id = `https://us-central1-openbadges-c7d08.cloudfunctions.net/Assertion/Show?id=${assertionDoc.id}`;
    assertion.flagArray = [
        userId,
        IssuerId,
        BadgeId,
        RecipientId
    ];
    await db.collection('Assertion').doc(assertionDoc.id).update(assertion);
    await db.collection('user').doc(userId).collection('issuer').doc(IssuerId).collection('BadgeClass').doc(BadgeId).collection('recipients').doc(RecipientId).update({
        assertionId: assertionDoc.id
    });

    fs.unlinkSync(tempFilePath);

})


exports.recipientMail = functions.runWith({ timeoutSeconds: 300 }).firestore.document('Assertion/{assertionId}').onUpdate(async (change, context) => {
    const assertionId = context.params.assertionId;

    const newValue = change.after.data();
    const previousValue = change.before.data();

    if (previousValue.baked === false && newValue.baked === true) {
        const reqIds = newValue.flagArray;
        const recipientData = await db.collection('user').doc(reqIds[0]).collection('issuer').doc(reqIds[1]).collection('BadgeClass').doc(reqIds[2]).collection('recipients').doc(reqIds[3]).get();
        const user = recipientData.data();

        const filePath = url_to_path(newValue.image);
        const tempFilePath = path.join(os.tmpdir(), `${Math.floor(Math.random() * 100000000000000)}Image`);
        const bucket = storage.bucket('gs://openbadges-c7d08.appspot.com/');
        await bucket.file(filePath).download({ destination: tempFilePath });

        attachment = fs.readFileSync(tempFilePath).toString("base64");

        const msg = {
            to: user.email,
            from: 'pkd16cs016@gecskp.ac.in',
            subject: 'OpenBadge',
            //custom template
            templateId: 'd-f9bb1117f6fc4909a3de1618fad970b4',
            dynamic_template_data: {
                name: user.name,
                link: `https://openbadges-c7d08.web.app/Assertion/0/${assertionId}/0`,
                imageurl: `${newValue.image}`
            },
            attachments: [
                {
                    content: attachment,
                    filename: "Badge.png",
                    type: "image/png",
                    disposition: "attachment"
                }
            ]
        };
        sgMail.send(msg).then(() => {
            return db.collection('user').doc(reqIds[0]).collection('issuer').doc(reqIds[1]).collection('BadgeClass').doc(reqIds[2]).collection('recipients').doc(reqIds[3]).update({
                sendmail: 'true'
            });
        }).catch(err => console.log(err));
    }
})

function url_to_path(strg) {
    strg = strg.replace("https://firebasestorage.googleapis.com/v0/b/openbadges-c7d08.appspot.com/o/", "").replace("?alt=media", "")
    strg = strg.split("%2F").join("/");
    return strg;
}