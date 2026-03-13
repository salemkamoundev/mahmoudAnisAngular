const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

exports.sendLink = onRequest(async (req, res) => {
    // Autoriser le CORS
    res.set('Access-Control-Allow-Origin', '*');

    // On ne demande plus de token, juste l'URL !
    const url = req.query.url;

    if (!url) {
        res.status(400).send("Erreur: Fournissez une 'url' en paramètre (ex: ?url=https://google.com).");
        return;
    }

    try {
        // 1. Récupérer TOUS les appareils enregistrés dans la collection "tokens"
        const tokensSnapshot = await db.collection('tokens').get();
        
        if (tokensSnapshot.empty) {
            res.status(404).send("Aucun appareil enregistré dans la base de données.");
            return;
        }

        const tokens = [];
        const batch = db.batch();

        // 2. Préparer les données
        tokensSnapshot.forEach(doc => {
            const tokenData = doc.data();
            if (tokenData.token) {
                tokens.push(tokenData.token);
                
                // Préparer la sauvegarde du lien pour CET utilisateur spécifique
                // (Cela permet au frontend actuel de continuer à filtrer sans rien changer)
                const linkRef = db.collection('links').doc();
                batch.set(linkRef, {
                    url: url,
                    token: tokenData.token,
                    timestamp: admin.firestore.FieldValue.serverTimestamp()
                });
            }
        });

        if (tokens.length === 0) {
            res.status(404).send("Aucun token valide trouvé dans les documents.");
            return;
        }

        // 3. Exécuter la sauvegarde de tous les liens en une seule fois (très rapide)
        await batch.commit();

        // 4. Envoyer la notification PUSH à TOUS les tokens d'un coup
        const message = {
            data: { url: url },
            tokens: tokens // 'tokens' au pluriel pour la méthode Multicast
        };
        
        const response = await admin.messaging().sendEachForMulticast(message);

        // 5. Répondre avec un résumé
        res.status(200).send(`Succès ! L'URL ${url} a été envoyée à ${response.successCount} appareil(s) (Échecs: ${response.failureCount}).`);
    } catch (error) {
        console.error("Erreur globale:", error);
        res.status(500).send(`Erreur : ${error.message}`);
    }
});
