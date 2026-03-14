const puppeteer = require('puppeteer');
const fs = require('fs');

// ==========================================
// 0. RÉCUPÉRATION DES VARIABLES DEPUIS N8N
// ==========================================
// Exemple de réception : node script.js "Lyon,Marseille" 2 14
let emplacements = ["Paris, FR"]; // Valeurs de secours
let priceMin = 0;
let priceMax = 0;

if (process.argv.length > 2) {
    try {
        // On récupère "Lyon,Marseille", on coupe à la virgule, et on nettoie les espaces
        const villesRecues = process.argv[2];
        if (villesRecues && villesRecues.trim() !== "") {
            emplacements = villesRecues.split(',').map(ville => ville.trim());
        }

        priceMin = parseFloat(process.argv[3]) || 0;
        priceMax = parseFloat(process.argv[4]) || 0;
        
        console.log(`🟢 Paramètres n8n reçus -> Villes: ${emplacements.join(', ')} | Prix Min: ${priceMin} | Prix Max: ${priceMax}`);
    } catch (e) {
        console.log("🔴 Erreur lors de la lecture des arguments n8n. Utilisation des valeurs par défaut.", e.message);
    }
}

(async () => {
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: '/usr/local/bin/chromium',
      headless: false, // Navigateur visible
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    await page.goto('https://relay.amazon.fr/tours/loadboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // ==========================================
    // 1. CONNEXION AUTOMATIQUE
    // ==========================================
    try {
      await page.waitForSelector('#ap_email', { timeout: 5000 });
      console.log("Saisie des identifiants...");
      await page.type('#ap_email', 'ma7moudbelaid@yahoo.fr', { delay: 50 });
      
      const continueButton = await page.$('input#continue');
      if (continueButton) {
          await Promise.all([
              page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}),
              continueButton.click()
          ]);
      }

      await page.waitForSelector('#ap_password', { timeout: 5000 });
      await page.type('#ap_password', '1Aj080585€', { delay: 50 });
      
      await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}),
          page.click('#signInSubmit')
      ]);
      console.log("Connecté !");
    } catch (e) {
      console.log("Déjà connecté ou attente de l'OTP...");
    }

    // ==========================================
    // 2. ATTENTE DE SÉCURITÉ
    // ==========================================
    console.log("Attente de l'apparition du menu Amazon (Gérez l'OTP si besoin)...");
    await page.waitForSelector('#sidebar-wrapper', { timeout: 0 }); 

    // ==========================================
    // 3. OUVERTURE DU TABLEAU
    // ==========================================
    console.log("Ouverture du Tableau de charge...");
    await page.waitForSelector('#load-board-header', { visible: true, timeout: 15000 });
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 45000 }).catch(() => {}),
      page.evaluate(() => {
        const bouton = document.querySelector('#load-board-header');
        if (bouton) bouton.click();
      })
    ]);
    await new Promise(r => setTimeout(r, 4000));

    // ==========================================
    // 4. FILTRES D'ORIGINE (CORRIGÉ ET ROBUSTE)
    // ==========================================
    console.log("Saisie des origines depuis les paramètres n8n...");
    try {
      const placeholderText = 'Commencer votre saisie pour la recherche';
      
      // On capture l'ÉLÉMENT DOM précis une seule fois au début. 
      // Comme ça, même si Amazon change son texte caché (placeholder), on ne perd pas le champ !
      const originInputHandle = await page.waitForSelector(`input[placeholder*="${placeholderText}"]`, { visible: true, timeout: 15000 });
      
      for (const lieu of emplacements) {
        console.log(`Ajout de la ville : ${lieu}`);
        
        // 1. Assurer que le curseur est dans le champ
        await originInputHandle.click();
        await new Promise(r => setTimeout(r, 500));
        
        // 2. VIDAGE FORCÉ du champ AVANT de taper la nouvelle ville
        await page.evaluate((el) => {
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
            if (nativeInputValueSetter) {
                nativeInputValueSetter.call(el, '');
            } else {
                el.value = '';
            }
            // On prévient React que le champ est maintenant vide
            el.dispatchEvent(new Event('input', { bubbles: true }));
        }, originInputHandle);
        
        await new Promise(r => setTimeout(r, 500));
        
        // 3. Saisie propre dans le champ verrouillé
        await originInputHandle.type(lieu, { delay: 50 });
        
        // 4. Temps pour laisser l'API Amazon renvoyer les suggestions
        await new Promise(r => setTimeout(r, 2500)); 
        
        // 5. Flèche bas + Entrée pour sélectionner la pastille
        await page.keyboard.press('ArrowDown');
        await new Promise(r => setTimeout(r, 500));
        await page.keyboard.press('Enter');
        
        // 6. Pause pour laisser Amazon ajouter la pastille visuellement
        await new Promise(r => setTimeout(r, 1500));
      }
      
      // Clic tout en haut à gauche pour fermer la liste déroulante des villes
      await page.mouse.click(10, 10); 
      await new Promise(r => setTimeout(r, 1000));
      
      console.log("Toutes les villes ont été ajoutées !");
    } catch (e) {
      console.log("⚠️ Erreur sur les origines : ", e.message);
    }

    // ==========================================
    // 5. FILTRES DE PRIX
    // ==========================================
    console.log(`Tentative d'application des prix : Min ${priceMin}€ / Max ${priceMax}€`);
    // Note : Remplacez les sélecteurs 'input[name="min-price"]' par les vrais sélecteurs d'Amazon Relay.
    // try {
    //   if (priceMin > 0) {
    //      await page.type('input[name="min-price"]', priceMin.toString(), { delay: 50 });
    //   }
    //   if (priceMax > 0) {
    //      await page.type('input[name="max-price"]', priceMax.toString(), { delay: 50 });
    //   }
    //   await new Promise(r => setTimeout(r, 1000));
    // } catch (e) {
    //   console.log("⚠️ Erreur sur les prix : ", e.message);
    // }

    // ==========================================
    // 6. FILTRES D'ÉQUIPEMENT 
    // ==========================================
    console.log("Configuration de tous les équipements en cascade...");
    try {
      const equipementInput = 'input[aria-label*="Équipement"]';
      await page.waitForSelector(equipementInput, { visible: true, timeout: 10000 });
      await page.click(equipementInput);
      console.log("Clic réussi sur le champ Équipement !");
      
      await new Promise(r => setTimeout(r, 2000)); 

      await page.evaluate(async () => {
        const delay = ms => new Promise(res => setTimeout(res, ms));
        
        let encoreDesCasesVides = true;
        let tentatives = 0;
        const maxTentatives = 12; 

        while (encoreDesCasesVides && tentatives < maxTentatives) {
            encoreDesCasesVides = false;
            tentatives++;

            // 1. Dérouler tous les "Voir plus d'équipements"
            const liens = Array.from(document.querySelectorAll('span, a, div'));
            for (let el of liens) {
                if (el.textContent.includes("Voir plus") && el.offsetParent !== null) { 
                    el.click();
                    await delay(400); 
                }
            }

            // 2. Chercher les div déguisées en checkbox
            const customCheckboxes = Array.from(document.querySelectorAll('[role="checkbox"]'));
            
            for (let cb of customCheckboxes) {
                if (cb.getAttribute('aria-checked') === 'false' && cb.offsetParent !== null) {
                    cb.click();
                    encoreDesCasesVides = true;
                    await delay(300); 
                }
            }

            // 3. Fallback sécurité : vraies cases natives
            const nativeCheckboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
            for (let cb of nativeCheckboxes) {
                if (!cb.checked) {
                    const label = cb.closest('label');
                    if (label && label.offsetParent !== null) {
                        label.click();
                        encoreDesCasesVides = true;
                        await delay(300);
                    }
                }
            }
            
            await delay(500);
        }
      });

      console.log("Scannage terminé ! Tous les équipements ont été cochés.");
      await new Promise(r => setTimeout(r, 1000));

      console.log("Clic à l'extérieur pour fermer et valider le menu...");
      await page.mouse.click(10, 10);
      await new Promise(r => setTimeout(r, 1500)); 

    } catch (e) {
      console.log("⚠️ Erreur sur les équipements : ", e.message);
    }

    // ==========================================
    // 7. RECHERCHE DES CHARGEMENTS
    // ==========================================
    console.log("Clic sur le bouton 'Rechercher des chargements'...");
    try {
      await page.evaluate(() => {
        const boutons = Array.from(document.querySelectorAll('button'));
        const btnRecherche = boutons.find(b => b.textContent.trim().includes('Rechercher des chargements'));
        if (btnRecherche) btnRecherche.click();
      });

      console.log("Recherche lancée ! Attente de l'affichage des offres (8s)...");
      await new Promise(r => setTimeout(r, 8000));
    } catch (e) {
      console.log("⚠️ Erreur lors de la recherche : ", e.message);
    }

    // ==========================================
    // 8. CAPTURE D'ÉCRAN
    // ==========================================
    console.log("Prise de la photo !");
    const dir = '/Users/salemkammoun/.n8n-files';
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }
    
    const imagePath = dir + '/amazon_capture.png';
    await page.screenshot({ path: imagePath, fullPage: true });
    
    const title = await page.title();
    console.log(JSON.stringify({ statut: "🟢 Succès", titre: title, image_sauvegardee_dans: imagePath }));

    // ==========================================
    // 9. PAUSE DE FIN
    // ==========================================
    console.log("Mission accomplie. Le navigateur se fermera dans 30 secondes.");
    await new Promise(r => setTimeout(r, 30000));
    await browser.close();

  } catch (error) {
    console.log(JSON.stringify({ statut: "🔴 Erreur", detail: error.message }));
    console.log("Une erreur a eu lieu. Le navigateur restera ouvert 30 secondes pour inspection.");
    await new Promise(r => setTimeout(r, 30000));
    if (browser) await browser.close();
  }
})();