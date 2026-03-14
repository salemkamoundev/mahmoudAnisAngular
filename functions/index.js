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
        // On récupère désormais les utilisateurs (identifiés par leur numéro)
        const usersSnapshot = await db.collection('users').get();
        
        if (usersSnapshot.empty) {
            res.status(404).send("Aucun appareil enregistré.");
            return;
        }

        let count = 0;
        const batch = db.batch();

        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            if (userData.phone) {
                count++;
                
                // On crée un document de lien pour ce numéro de téléphone
                const linkRef = db.collection('links').doc();
                batch.set(linkRef, {
                    url: url,
                    phone: userData.phone, // Utilisation du téléphone comme clé relationnelle
                    timestamp: admin.firestore.FieldValue.serverTimestamp()
                });
            }
        });

        if (count === 0) {
            res.status(404).send("Aucun numéro de téléphone valide.");
            return;
        }

        // On sauvegarde tous les liens en base de données
        await batch.commit();

        // Note : Le code d'envoi de Notification Push (FCM) a été supprimé ici car il nécessitait des tokens.
        // C'est ici que vous pourriez appeler une API (ex: Twilio) pour envoyer un SMS si besoin.

        res.status(200).send(`Succès ! Lien distribué à ${count} numéro(s) de téléphone.`);
    } catch (error) {
        console.error("Erreur:", error);
        res.status(500).send(`Erreur : ${error.message}`);
    }
});