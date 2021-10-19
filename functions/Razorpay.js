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


Razorpay = require('razorpay');
const rzkey = require('./RazorpayKey.json');
var instance = new Razorpay(rzkey);


app.post('/OrderCreate', async (req, res) => {
    console.log(req.body)
    OrderData = {};
    //user
    OrderData.payingUser = req.body.uid;
    OrderData.date = nowdate();

    //staff or not 
    let staffFlag = req.body.staff;

    //Issuer
    OrderData.issuer = {};
    const issuer = await db.collection('Issuer').doc(req.body.issuer).get();
    OrderData.issuer.email = issuer.data().email;
    OrderData.issuer.name = issuer.data().name;
    OrderData.issuer.id = req.body.issuer;

    //adminuser
    OrderData.adminUser = issuer.data().admin;

    //badge
    OrderData.badge = {};
    OrderData.badge.id = req.body.badge;
    const badge = await db.collection('BadgeClass').doc(req.body.badge).get();
    OrderData.badge.name = badge.data().name;


    //const validatePhoneNumber = require('validate-phone-number-node-js');
    //const resultphoneno = validatePhoneNumber.validate(OrderData.User.Contact);
    var validator = require("email-validator");
    const resultemail = validator.validate(OrderData.issuer.email);
    //if(resultphoneno===false || resultemail===false)
    if (resultemail === false) {
        return res.json({
            "message": "Invalid Credentials",
            "error": "Issuer Email Not Valid"
        })
    }
    OrderData.status = "issued";
    OrderData.awardable = Number(req.body.count);
    OrderData.amount = (req.body.count * 1000);
    const OrderRecieptInfo = await db.collection("Orders").doc("Order_Info").get();
    OrderData.orderNo = OrderRecieptInfo.data().OrderNo;

    db.doc("Orders/Order_Info").update({ OrderNo: admin.firestore.FieldValue.increment(1) })

    OrderData.orderRecieptId = `Order_rcptid_${OrderData.orderNo}`;



    var options = {
        amount: OrderData.amount * 100,  // amount in the smallest currency unit
        currency: "INR",
        receipt: OrderData.orderRecieptId
    };
    instance.orders.create(options, async function (err, order) {

        if (err !== null) {
            res.json({ "message": "Error", "error": err });
        }
        else {
            console.log("Order : " + order);
            OrderData.id = order.id;
            await db.collection("Orders").doc(order.id).set(OrderData);
            await db.collection('user').doc(OrderData.adminUser).collection('issuer').doc(req.body.issuer).collection('BadgeClass').doc(req.body.badge).collection('Orders').doc(order.id).set(OrderData);
            if (Number(staffFlag) === 0) {
                res.json({
                    "key": "rzp_test_Z6gylfiYBWDync",
                    "amount": OrderData.amount,
                    "currency": "INR",
                    "name": OrderData.badge.name,
                    "description": "Test Transaction",
                    "image": "https://firebasestorage.googleapis.com/v0/b/openbadges-c7d08.appspot.com/o/Path%201996.png?alt=media",
                    "order_id": OrderData.id,
                    "callback_url": `https://us-central1-openbadges-c7d08.cloudfunctions.net/RazorPayCallBack/v1?orderid=${order.id}&flag=0&staff=0`,
                    "cancel_url": `https://us-central1-openbadges-c7d08.cloudfunctions.net/RazorPayCallBack/v1?orderid=${order.id}&flag=1&staff=0`,
                    "prefill": {
                        "name": OrderData.issuer.name,
                        "email": OrderData.issuer.email
                    },
                    "notes": {
                        "address": "OpenBadges Corporate Office"
                    },
                    "theme": {
                        "color": "#0174DF"
                    }
                });
            } else if (Number(staffFlag) === 1) {
                res.json({
                    "key": "rzp_test_Z6gylfiYBWDync",
                    "amount": OrderData.amount,
                    "currency": "INR",
                    "name": OrderData.badge.name,
                    "description": "Test Transaction",
                    "image": "https://firebasestorage.googleapis.com/v0/b/openbadges-c7d08.appspot.com/o/Path%201996.png?alt=media",
                    "order_id": OrderData.id,
                    "callback_url": `https://us-central1-openbadges-c7d08.cloudfunctions.net/RazorPayCallBack/v1?orderid=${order.id}&flag=0&staff=1`,
                    "cancel_url": `https://us-central1-openbadges-c7d08.cloudfunctions.net/RazorPayCallBack/v1?orderid=${order.id}&flag=1&staff=1`,
                    "prefill": {
                        "name": OrderData.issuer.name,
                        "email": OrderData.issuer.email
                    },
                    "notes": {
                        "address": "OpenBadges Corporate Office"
                    },
                    "theme": {
                        "color": "#0174DF"
                    }
                });

            }
        }


    });

});


//Exporting razorpay
exports.RazorPay = functions.runWith({ "timeoutSeconds": 300, memory: '512MB' }).https.onRequest(app);


//other functions
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