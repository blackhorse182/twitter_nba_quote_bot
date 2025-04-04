// Importation des modules nécessaires
const { TwitterApi } = require('twitter-api-v2'); // Bibliothèque pour interagir avec l'API Twitter
const schedule = require('node-schedule'); // Planification des tâches
const express = require('express'); // Framework pour créer un serveur web
const axios = require('axios'); // Bibliothèque pour effectuer des requêtes HTTP
require('dotenv').config({ path: './keys.env' }); // Chargement des variables d'environnement depuis un fichier .env

// Initialisation de l'application Express et configuration du port
const app = express();
const PORT = process.env.PORT || 10000;

// Configuration du client Twitter avec les clés d'API
const client = new TwitterApi({
  appKey: process.env.TWITTER_APP_KEY,
  appSecret: process.env.TWITTER_APP_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

// Hashtags de base pour les tweets
const baseHashtags = "#NBA #Basketball #Stats";

// Fonction pour récupérer les résultats des matchs NBA
async function getNBAResults() {
  try {
    // Calcul de la date d'hier pour récupérer les matchs
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    // Requête à l'API NBA pour obtenir les matchs de la date spécifiée
    const response = await axios.get('https://api-nba-v1.p.rapidapi.com/games', {
      headers: {
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'api-nba-v1.p.rapidapi.com',
      },
      params: { date: dateStr },
    });

    // Traitement des résultats des matchs
    const games = response.data.response;
    if (!games || games.length === 0) {
      console.log('No games found for', dateStr);
      return [];
    }

    // Extraction des informations pertinentes pour chaque match
    const results = games.map(game => ({
      gameId: game.id,
      date: new Date(game.date.start).toDateString(),
      homeTeam: game.teams.home.name,
      awayTeam: game.teams.visitors.name,
      score: `${game.scores.home.points}-${game.scores.visitors.points}`,
    }));

    console.log('Games retrieved:', results);
    return results;
  } catch (error) {
    console.error('API Error in getNBAResults:', error.message);
    return [];
  }
}

// Fonction pour récupérer les statistiques du meilleur joueur d'un match
async function getTopPlayerStats(gameId, retries = 3) {
  try {
    // Requête à l'API NBA pour obtenir les statistiques des joueurs d'un match
    const response = await axios.get('https://api-nba-v1.p.rapidapi.com/players/statistics', {
      headers: {
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'api-nba-v1.p.rapidapi.com',
      },
      params: { game: gameId },
    });

    // Traitement des statistiques des joueurs
    const players = response.data.response;
    if (!players || players.length === 0) {
      console.log(`No player stats available for game ${gameId}`);
      return null;
    }

    // Sélection du joueur avec le plus de points
    const topPlayer = players.reduce((prev, curr) =>
      (parseInt(curr.points) || 0) > (parseInt(prev.points) || 0) ? curr : prev
    );

    return {
      name: `${topPlayer.player.firstname} ${topPlayer.player.lastname}`,
      points: topPlayer.points || '0',
      rebounds: topPlayer.totReb || '0',
      assists: topPlayer.assists || '0',
    };
  } catch (error) {
    console.error(`Error fetching player stats for game ${gameId}: ${error.response?.status || 'Unknown'}`, error.message);
    // Gestion des erreurs de limite de requêtes (rate limit)
    if (error.response?.status === 429 && retries > 0) {
      console.log(`Rate limit hit for game ${gameId}. Retrying in 15 seconds... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, 15 * 1000));
      return getTopPlayerStats(gameId, retries - 1);
    }
    return null;
  }
}

// Fonction pour générer le contenu du tweet à partir des résultats des matchs
async function getAllGamesPost() {
  try {
    const results = await getNBAResults();
    if (results.length === 0) throw new Error("No results found.");

    let postContent = `${results[0].date}:\n`;
    let statsAdded = false;
    let teamHashtags = new Set(); // Utilisation d'un Set pour éviter les doublons

    for (const game of results) {
      const gameLine = `${game.homeTeam} ${game.score} ${game.awayTeam}\n`;
      postContent += gameLine;

      // Ajout des hashtags des équipes
      teamHashtags.add(`#${game.homeTeam.replace(/\s+/g, '')}`); // Suppression des espaces
      teamHashtags.add(`#${game.awayTeam.replace(/\s+/g, '')}`);

      // Ajout des statistiques pour le premier match uniquement
      if (!statsAdded) {
        const topPlayer = await getTopPlayerStats(game.gameId);
        if (topPlayer) {
          const playerLine = `${topPlayer.name}: ${topPlayer.points} pts, ${topPlayer.rebounds} reb, ${topPlayer.assists} ast\n`;
          postContent += playerLine;
          statsAdded = true;
        }
      }
    }

    // Construction des hashtags dynamiques
    const allHashtags = `${baseHashtags} ${Array.from(teamHashtags).join(' ')}`;
    postContent += allHashtags;

    // Vérification et troncature si nécessaire
    if (postContent.length > 280) {
      const maxContentLength = 280 - allHashtags.length - 4;
      postContent = `${postContent.substring(0, maxContentLength)}... ${allHashtags}`;
    }

    return postContent;
  } catch (error) {
    console.error('Error retrieving NBA results:', error.message);
    return 'Error retrieving NBA results.';
  }
}

// Fonction pour poster un tweet avec les résultats NBA
async function postNBATweet() {
  try {
    const content = await getAllGamesPost();
    if (content === 'Error retrieving NBA results.') {
      console.log('No game results available, skipping tweet.');
      return;
    }
    if (typeof content !== 'string') throw new Error("Invalid content.");
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const tweet = `${content} [${timestamp}]`;

    // Vérification de la longueur du tweet
    if (tweet.length > 280) {
      const shortTweet = `${content.substring(0, 280 - timestamp.length - 4)}... [${timestamp}]`;
      await client.v2.tweet(shortTweet);
      console.log(`Short tweet posted: ${shortTweet}`);
    } else {
      await client.v2.tweet(tweet);
      console.log(`Tweet posted: ${tweet}`);
    }
  } catch (error) {
    console.error("Error posting tweet:", error.message);
    // Gestion des erreurs de limite de requêtes Twitter
    if (error.code === 429) {
      console.log('Twitter rate limit hit. Waiting 15 minutes...');
      await new Promise(resolve => setTimeout(resolve, 15 * 60 * 1000));
      await postNBATweet();
    }
  }
}

// Planification d'un tweet quotidien à minuit
schedule.scheduleJob('0 0 * * *', async () => await postNBATweet());

// Premier tweet au démarrage
postNBATweet().then(() => console.log("First tweet posted"));

// Route de base pour vérifier que le bot fonctionne
app.get('/', (req, res) => res.send('NBA Twitter Bot running!'));

// Démarrage du serveur Express
app.listen(PORT, () => {
  console.log(`NBA Bot started! Posting every 24 hours. Server running on port ${PORT}`);
});

// Test de la fonction getAllGamesPost
getAllGamesPost().then(result => console.log("Result of getAllGamesPost:", result));