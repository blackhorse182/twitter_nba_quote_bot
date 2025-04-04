const { TwitterApi } = require('twitter-api-v2');
const schedule = require('node-schedule');
const express = require('express');
const NBA = require('nba-api-client');
require('dotenv').config({ path: './keys.env' });

const app = express();
const PORT = process.env.PORT || 3000;

const client = new TwitterApi({
    appKey: 'MQnQJz6JfQ6FdbhGjmsgtN5aE',
    appSecret: 'MO4J0paVS0kvmPvSh715OjDU5R8cjJuWlOPN6Zz5JDPZqgmb5G',
    accessToken: '1509015998317404161-0PtKc05VWPikCLXyKtXvIIo5IQ8GUF',
    accessSecret: 'ejdT2uFYLQXFvHM1rkoJXe6U2FX0PHTqWjgqVQhm3EmoL',
});

const hashtags = "#NBA #Basketball #Stats";

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

const getDateStrings = () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    return {
        today: today.toISOString().split('T')[0], // Format YYYY-MM-DD
        yesterday: yesterday.toISOString().split('T')[0],
    };
};

// Récupérer un résultat récent avec nba-api-client
async function getRecentGameResult() {
    const { today, yesterday } = getDateStrings();

    console.log("Date aujourd'hui:", today);
    console.log("Date hier:", yesterday);

    try {
        const games = await NBA.getGamesInDateRange(today, today);
        console.log("Réponse complète aujourd'hui:", JSON.stringify(games, null, 2));

        if (!games || games.length === 0) {
            console.log("Aucun match aujourd'hui, tentative pour hier...");
            const yesterdayGames = await NBA.getGamesInDateRange(yesterday, yesterday);
            console.log("Réponse complète hier:", JSON.stringify(yesterdayGames, null, 2));

            if (!yesterdayGames || yesterdayGames.length === 0) {
                const staticGame = staticFallbackGames[Math.floor(Math.random() * staticFallbackGames.length)];
                return staticGame.game; // Supprimé [Static Fallback]
            }

            const game = yesterdayGames[Math.floor(Math.random() * yesterdayGames.length)];
            return `${game.hTeam.triCode} ${game.hTeam.score} - ${game.vTeam.triCode} ${game.vTeam.score} (Final, Yesterday)`;
        }

        const game = games[Math.floor(Math.random() * games.length)];
        return `${game.hTeam.triCode} ${game.hTeam.score} - ${game.vTeam.triCode} ${game.vTeam.score} (Final)`;
    } catch (error) {
        console.error("Erreur NBA API (getRecentGameResult):", error.message);
        const staticGame = staticFallbackGames[Math.floor(Math.random() * staticFallbackGames.length)];
        return staticGame.game; // Supprimé [Static Fallback]
    }
}

// Récupérer une stat aléatoire
async function getRandomStat() {
    const { today } = getDateStrings();

    try {
        const games = await NBA.getGamesInDateRange(today, today);
        console.log("Réponse complète pour stats:", JSON.stringify(games, null, 2));

        if (!games || games.length === 0) {
            const staticStat = staticFallbackStats[Math.floor(Math.random() * staticFallbackStats.length)];
            return staticStat.stat; // Supprimé [Static Fallback]
        }

        const game = games[Math.floor(Math.random() * games.length)];
        const boxScore = await NBA.boxScore({ GameID: game.gameId });
        console.log("Box Score:", JSON.stringify(boxScore, null, 2));
        const playerStats = boxScore.stats.activePlayers;

        if (!playerStats || playerStats.length === 0) {
            const staticStat = staticFallbackStats[Math.floor(Math.random() * staticFallbackStats.length)];
            return staticStat.stat; // Supprimé [Static Fallback]
        }

        const player = playerStats[Math.floor(Math.random() * playerStats.length)];
        return `${player.firstName} ${player.lastName} a marqué ${player.points} points pour ${player.teamTricode}.`;
    } catch (error) {
        console.error("Erreur NBA API (getRandomStat):", error.message);
        const staticStat = staticFallbackStats[Math.floor(Math.random() * staticFallbackStats.length)];
        return staticStat.stat; // Supprimé [Static Fallback]
    }
}

async function getRandomNBAPost() {
    const isGameResult = Math.random() < 0.5;
    return isGameResult ? await getRecentGameResult() : await getRandomStat();
}

async function postNBATweet() {
    try {
        const content = await getRandomNBAPost();
        if (typeof content !== 'string') {
            throw new Error("Contenu invalide, attendu une chaîne : " + content);
        }
        const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const tweet = `${content} ${hashtags} [${timestamp}]`;

        if (tweet.length > 280) {
            const shortTweet = `${content.substring(0, 280 - hashtags.length - timestamp.length - 5)}... ${hashtags} [${timestamp}]`;
            await client.v2.tweet(shortTweet);
            console.log(`Short tweet posted: ${shortTweet}`);
        } else {
            await client.v2.tweet(tweet);
            console.log(`Tweet posted: ${tweet}`);
        }
    } catch (error) {
        console.error("Erreur dans postNBATweet:", error.message);
    }
}

schedule.scheduleJob('0 */6 * * *', async () => {
    await postNBATweet();
});

getRandomNBAPost().then(result => console.log("Résultat de getRandomNBAPost:", result));

postNBATweet().then(() => console.log("Post initial envoyé"));

app.get('/', (req, res) => {
    res.send('NBA Twitter Bot is running!');
});

app.listen(PORT, () => {
    console.log(`NBA Bot started! Posting every 6 hours. Server running on port ${PORT}`);
});