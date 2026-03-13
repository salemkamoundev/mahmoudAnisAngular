const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
admin.initializeApp();

exports.sendLink = onRequest(async (req, res) => {
    // Autoriser le CORS (optionnel mais utile pour tester)
    res.set('Access-Control-Allow-Origin', '*');

    const token = req.query.token;
    const url = req.query.url;

    if (!token || !url) {
        res.status(400).send("Erreur: Fournissez un 'token' et une 'url' en paramètres de la requête.");
        return;
    }

    const message = {
        data: { url: url }, // On envoie l'URL dans l'objet 'data' (pas en notification visuelle systeme, mais géré par l'app web)
        token: token
    };

    try {
        await admin.messaging().send(message);
        res.status(200).send(`Succès ! L'URL ${url} a été envoyée à l'appareil.`);
    } catch (error) {
        console.error("Erreur d'envoi:", error);
        res.status(500).send(`Erreur : ${error.message}`);
    }
});
