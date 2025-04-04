const { TwitterApi } = require('twitter-api-v2');
const schedule = require('node-schedule');
const axios = require('axios');
const express = require('express');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const client = new TwitterApi({
    appKey: 'MQnQJz6JfQ6FdbhGjmsgtN5aE',
    appSecret: 'MO4J0paVS0kvmPvSh715OjDU5R8cjJuWlOPN6Zz5JDPZqgmb5G',
    accessToken: '1509015998317404161-0PtKc05VWPikCLXyKtXvIIo5IQ8GUF',
    accessSecret: 'ejdT2uFYLQXFvHM1rkoJXe6U2FX0PHTqWjgqVQhm3EmoL',
});

const hashtags = "#NBA #Basketball #Stats";
const API_KEY = process.env.API_BASKETBALL_KEY; // Clé chargée depuis .env

// Données statiques de secours (inchangées)
const staticFallbackGames = [
    { game: "Bulls 87 - Jazz 86 (Final, 1998 Finals) - Jordan's 'Last Shot'", video: "https://www.youtube.com/watch?v=vdPQ3QxDZ1s" },
    { game: "Cavs 93 - Warriors 89 (Final, 2016 Finals) - LeBron's Block & Kyrie's 3", video: "https://www.youtube.com/watch?v=jL4pXNfN_LI" },
    { game: "Lakers 100 - Celtics 96 (Final, 2010 Finals) - Kobe's 5th ring", video: "https://www.youtube.com/watch?v=ZI1Fh6fzO3o" },
    { game: "Spurs 81 - Pistons 74 (Final, 2005 Finals) - Duncan's dominance", video: "https://www.youtube.com/watch?v=FGZJFH0V3h8" },
    { game: "Heat 103 - Spurs 100 (OT, 2013 Finals) - Ray Allen's clutch 3", video: "https://www.youtube.com/watch?v=YDiXQ7ST7XU" }
];

const staticFallbackStats = [
    { stat: "Michael Jordan scored 45 points for Bulls (1998 Finals - 'Last Shot').", video: "https://www.youtube.com/watch?v=vdPQ3QxDZ1s" },
    { stat: "LeBron James recorded a triple-double (27-11-11) for Cavs (2016 Finals).", video: "https://www.youtube.com/watch?v=jL4pXNfN_LI" },
    { stat: "Kobe Bryant scored 23 points and grabbed 15 rebounds for Lakers (2010 Finals).", video: "https://www.youtube.com/watch?v=ZI1Fh6fzO3o" },
    { stat: "Tim Duncan scored 25 points and 11 rebounds for Spurs (2005 Finals).", video: "https://www.youtube.com/watch?v=FGZJFH0V3h8" },
    { stat: "Ray Allen hit a game-tying 3-pointer with 5.2 seconds left for Heat (2013 Finals).", video: "https://www.youtube.com/watch?v=YDiXQ7ST7XU" }
];

// Fonction pour obtenir les dates
const getDateStrings = () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    return {
        today: today.toISOString().split('T')[0], // Format YYYY-MM-DD
        yesterday: yesterday.toISOString().split('T')[0],
    };
};

// Récupérer un résultat de match récent via API Basketball
async function getRecentGameResult() {
    const { today, yesterday } = getDateStrings();
    const url = `https://v1.basketball.api-sports.io/games?league=12&season=2024-2025&date=${today}`;

    try {
        const response = await axios.get(url, {
            headers: {
                'x-apisports-key': API_KEY, // Votre clé : d4e83ba1dc44a2aa020480241e57af83
            },
        });

        const games = response.data.response;
        if (games.length === 0) {
            const yesterdayUrl = `https://v1.basketball.api-sports.io/games?league=12&season=2024-2025&date=${yesterday}`;
            const yesterdayResponse = await axios.get(yesterdayUrl, {
                headers: {
                    'x-apisports-key': API_KEY,
                },
            });
            const yesterdayGames = yesterdayResponse.data.response;
            if (yesterdayGames.length === 0) {
                const staticGame = staticFallbackGames[Math.floor(Math.random() * staticFallbackGames.length)];
                return `${staticGame.game} [Static Fallback]`;
            }
            const game = yesterdayGames[Math.floor(Math.random() * yesterdayGames.length)];
            return `${game.teams.home.name} ${game.scores.home.total} - ${game.teams.away.name} ${game.scores.away.total} (Final, Yesterday)`;
        }

        const game = games[Math.floor(Math.random() * games.length)];
        return `${game.teams.home.name} ${game.scores.home.total} - ${game.teams.away.name} ${game.scores.away.total} (Final)`;
    } catch (error) {
        console.error("Erreur API Basketball (getRecentGameResult):", error.message);
        const staticGame = staticFallbackGames[Math.floor(Math.random() * staticFallbackGames.length)];
        return `${staticGame.game} [Static Fallback]`;
    }
}

// Récupérer une statistique aléatoire via API Basketball
async function getRandomStat() {
    const { today } = getDateStrings();
    const url = `https://v1.basketball.api-sports.io/games?league=12&season=2024-2025&date=${today}`;

    try {
        const response = await axios.get(url, {
            headers: {
                'x-apisports-key': API_KEY,
            },
        });

        const games = response.data.response;
        if (games.length === 0) {
            const staticStat = staticFallbackStats[Math.floor(Math.random() * staticFallbackStats.length)];
            return `${staticStat.stat} [Static Fallback]`;
        }

        const game = games[Math.floor(Math.random() * games.length)];
        const statsUrl = `https://v1.basketball.api-sports.io/statistics?game=${game.id}`;
        const statsResponse = await axios.get(statsUrl, {
            headers: {
                'x-apisports-key': API_KEY,
            },
        });

        const teamStats = statsResponse.data.response[0].statistics[0]; // Stats de l'équipe domicile
        return `${game.teams.home.name} a marqué ${teamStats.points} points dans le match.`;
    } catch (error) {
        console.error("Erreur API Basketball (getRandomStat):", error.message);
        const staticStat = staticFallbackStats[Math.floor(Math.random() * staticFallbackStats.length)];
        return `${staticStat.stat}`;
    }
}

// Sélectionner aléatoirement entre match et stat
async function getRandomNBAPost() {
    const isGameResult = Math.random() < 0.5;
    return isGameResult ? await getRecentGameResult() : await getRandomStat();
}

// Poster sur Twitter
async function postNBATweet() {
    const content = await getRandomNBAPost();
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const tweet = `${content} ${hashtags} [${timestamp}]`;

    try {
        if (tweet.length > 280) {
            const shortTweet = `${content.substring(0, 280 - hashtags.length - timestamp.length - 5)}... ${hashtags} [${timestamp}]`;
            await client.v2.tweet(shortTweet);
            console.log(`Short tweet posted: ${shortTweet}`);
        } else {
            await client.v2.tweet(tweet);
            console.log(`Tweet posted: ${tweet}`);
        }
    } catch (error) {
        console.error("Erreur lors de la publication du tweet:", error.message);
    }
}

// Planifier les posts toutes les 6 heures
schedule.scheduleJob('0 */6 * * *', () => {
    postNBATweet();
});

// Post initial au démarrage
postNBATweet();

// Démarrer le serveur Express
app.get('/', (req, res) => {
    res.send('NBA Twitter Bot is running!');
});

app.listen(PORT, () => {
    console.log(`NBA Bot started! Posting every 6 hours. Server running on port ${PORT}`);
});