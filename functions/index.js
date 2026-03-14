const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

exports.sendLink = onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');

    const url = req.query.url;

    if (!url) {
        res.status(400).send("Erreur: Fournissez une 'url' en paramètre.");
        return;
    }

    try {
        const tokensSnapshot = await db.collection('tokens').get();
        
        if (tokensSnapshot.empty) {
            res.status(404).send("Aucun appareil enregistré.");
            return;
        }

        const tokens = [];
        const batch = db.batch();

        tokensSnapshot.forEach(doc => {
            const tokenData = doc.data();
            if (tokenData.token) {
                tokens.push(tokenData.token);
                
                const linkRef = db.collection('links').doc();
                batch.set(linkRef, {
                    url: url,
                    token: tokenData.token,
                    timestamp: admin.firestore.FieldValue.serverTimestamp()
                });
            }
        });

        if (tokens.length === 0) {
            res.status(404).send("Aucun token valide.");
            return;
        }

        await batch.commit();

        // NOUVEAU : AJOUT DE LA NOTIFICATION ET DU LIEN CLIQUABLE
        const message = {
            notification: {
                title: "🔗 Nouveau lien reçu !",
                body: "Appuyez ici pour ouvrir l'application et voir le lien."
            },
            webpush: {
                fcm_options: {
                    // C'est cette ligne qui ouvre votre application au clic !
                    // Firebase Hosting utilise par défaut l'URL avec votre Project ID
                    link: "https://mtc-cda71.web.app" 
                }
            },
            data: { url: url }, // On garde ça au cas où l'app est déjà ouverte
            tokens: tokens
        };
        
        const response = await admin.messaging().sendEachForMulticast(message);

        res.status(200).send(`Succès ! Envoyé à ${response.successCount} appareil(s) (Échecs: ${response.failureCount}).`);
    } catch (error) {
        console.error("Erreur:", error);
        res.status(500).send(`Erreur : ${error.message}`);
    }
});
