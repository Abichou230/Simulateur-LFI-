# Guide pas à pas : mettre en ligne le simulateur LFI

Aucune connaissance technique n'est nécessaire. Comptez 30 à 45 minutes la première fois. Les libellés des boutons peuvent légèrement changer sur les sites : cherchez les mots proches.

## Ce que contient le dossier

- `server.js` : le « moteur » qui calcule l'impôt et l'âge de départ, et qui sert la page web.
- `public/index.html` : la page que voient vos visiteurs.
- `config/bareme.json` : tous les chiffres (tranches d'impôt, âges de retraite). C'est le seul fichier que vous aurez à modifier plus tard.
- `package.json` : une fiche d'identité du projet. Ne pas modifier.

## Étape 1 : décompresser le dossier

1. Téléchargez le fichier `simulateur-lfi.zip`.
2. Faites un clic droit dessus, puis « Extraire tout » (Windows) ou double-cliquez (Mac).
3. Vous obtenez un dossier `simulateur-lfi` avec les fichiers ci-dessus.

## Étape 2 : créer un compte GitHub (le « coffre » du projet)

1. Allez sur https://github.com et cliquez sur **Sign up**.
2. Entrez votre e-mail, un mot de passe et un nom d'utilisateur, puis validez l'adresse e-mail reçue.

## Étape 3 : y déposer les fichiers

1. Une fois connecté, cliquez sur le **+** en haut à droite, puis **New repository**.
2. Nom : `simulateur-lfi`. Choisissez **Public**. Cliquez sur **Create repository**.
3. Sur la page suivante, cliquez sur le lien **uploading an existing file**.
4. Ouvrez le dossier extrait. Sélectionnez **tout son contenu** (`server.js`, `package.json`, `GUIDE.md` et les dossiers `public` et `config`) et glissez-le dans la fenêtre du navigateur. Les dossiers doivent apparaître avec leurs fichiers à l'intérieur.
5. Attendez la fin du chargement, puis cliquez sur le bouton vert **Commit changes**.

## Étape 4 : créer le serveur sur Render

1. Allez sur https://render.com et cliquez sur **Get Started**. Choisissez « Sign in with GitHub » et acceptez.
2. Cliquez sur **New +**, puis **Web Service**.
3. Dans la liste de vos dépôts GitHub, choisissez `simulateur-lfi`. Si rien n'apparaît, cliquez sur « Configure account » et autorisez Render à voir ce dépôt.
4. Remplissez le formulaire :
   - **Name** : `simulateur-lfi` (cela fixe l'adresse, par exemple `simulateur-lfi.onrender.com`).
   - **Region** : Frankfurt (le plus proche de la France).
   - **Runtime / Language** : Node.
   - **Build Command** : laissez vide ou écrivez `npm install`.
   - **Start Command** : `node server.js`
   - **Instance type** : Free.
5. Plus bas, dans **Environment Variables**, cliquez sur **Add Environment Variable** :
   - Nom : `ADMIN_KEY`
   - Valeur : un mot de passe de votre choix, long et sans espace (il servira à voir les statistiques).
6. Cliquez sur **Create Web Service**.

## Étape 5 : vérifier

1. Render affiche un journal qui défile. Au bout de 2 à 5 minutes, vous voyez « Your service is live ».
2. Cliquez sur l'adresse en haut de la page (`https://simulateur-lfi.onrender.com`). Le simulateur doit s'afficher et les chiffres se calculer.
3. Test rapide : revenu 30 000 €, 1 part. Vous devez lire environ **2 104 €** d'impôt actuel et **2 006 €** avec le barème LFI.
4. Cette adresse est publique : vous pouvez l'envoyer à qui vous voulez.

## Voir les statistiques d'usage

Ouvrez dans votre navigateur (en remplaçant par votre adresse et votre mot de passe) :

`https://simulateur-lfi.onrender.com/api/stats?cle=VOTRE_MOT_DE_PASSE`

Vous voyez le nombre de simulations d'impôt et de retraite. Aucune donnée personnelle n'est enregistrée : ni revenu, ni adresse IP, ni identité.

## Mettre à jour les chiffres (après le 6 novembre, par exemple)

1. Sur GitHub, ouvrez votre dépôt, dossier `config`, fichier `bareme.json`.
2. Cliquez sur l'icône crayon (**Edit**).
3. Modifiez uniquement les nombres (seuils, taux, âges, trimestres). Ne supprimez ni virgules, ni guillemets, ni accolades.
4. Cliquez sur **Commit changes**. Render redéploie tout seul en 2 à 3 minutes.
5. Si le site affiche une erreur après modification, annulez : GitHub garde l'historique (bouton **History**, puis restaurez l'ancienne version).

## À savoir sur l'offre gratuite

- Le site **s'endort après 15 minutes sans visite** : la première personne qui arrive attend 30 à 60 secondes. Pour l'éviter, l'offre payante de Render (environ 7 $ par mois) garde le site éveillé.
- Les **statistiques sont remises à zéro** à chaque mise à jour ou redémarrage, car l'offre gratuite n'a pas de stockage durable. Si vous voulez les conserver, notez les chiffres avant de modifier quoi que ce soit, ou demandez-moi de brancher une base de données.
- Le simulateur reste utilisable même si les statistiques sont remises à zéro.

## Avoir votre propre adresse (facultatif)

Achetez un nom de domaine (par exemple chez OVH ou Gandi, 10 à 15 € par an). Sur Render, ouvrez votre service, **Settings**, **Custom Domains**, et suivez les instructions affichées. Elles indiquent les deux lignes à recopier chez votre vendeur de domaine.

## Bonnes pratiques avant de diffuser

- Indiquez dans vos messages que c'est une **simulation indicative**, fondée sur les mesures publiées par LFI. La page le précise déjà.
- Relisez `config/bareme.json` après la sortie du programme complet : certaines valeurs sont des hypothèses (barème de 2022 revalorisé, étape à 62 ans pour la retraite).
- Si vous ne représentez pas officiellement LFI, évitez de présenter l'outil comme un outil du parti.
- Le simulateur n'enregistre aucune donnée personnelle. Si vous en ajoutez plus tard (e-mail, formulaire), il faudra une mention d'information et un registre RGPD.

## En cas de problème

- **Page blanche ou « Service indisponible »** : sur Render, ouvrez votre service et l'onglet **Logs**. Copiez les dernières lignes et envoyez-les-moi.
- **« Application failed to respond »** : vérifiez que la Start Command est bien `node server.js`.
- **Les chiffres ne bougent pas** : attendez 1 minute (le site se réveille) et rechargez la page.
