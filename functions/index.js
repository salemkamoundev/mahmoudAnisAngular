const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

exports.sendLink = onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');

    const token = req.query.token;
    const url = req.query.url;

    if (!token || !url) {
        res.status(400).send("Erreur: Fournissez un 'token' et une 'url'.");
        return;
    }

    try {
        // 1. Sauvegarder le lien dans Firestore
        await db.collection('links').add({
            url: url,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        // 2. Envoyer le Push silencieux à l'appareil
        const message = {
            data: { url: url },
            token: token
        };
        await admin.messaging().send(message);

        res.status(200).send(`Succès ! L'URL ${url} a été sauvegardée et envoyée.`);
    } catch (error) {
        console.error("Erreur:", error);
        res.status(500).send(`Erreur : ${error.message}`);
    }
});
