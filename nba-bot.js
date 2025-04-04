const { TwitterApi } = require('twitter-api-v2');
const schedule = require('node-schedule');
const express = require('express');
const NBA = require('nba-api-client'); // Nouvelle dépendance
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
        today: today.toISOString().split('T')[0].replace(/-/g, ''), // Format YYYYMMDD
        yesterday: yesterday.toISOString().split('T')[0].replace(/-/g, ''),
    };
};

// Récupérer un résultat récent avec nba-api-client
async function getRecentGameResult() {
    const { today, yesterday } = getDateStrings();

    try {
        const games = await NBA.scoreboardV2({ GameDate: today });
        const gameData = games.GameHeader;
        console.log("Données brutes des matchs aujourd'hui:", gameData);

        if (!gameData || gameData.length === 0) {
            const yesterdayGames = await NBA.scoreboardV2({ GameDate: yesterday });
            const yesterdayData = yesterdayGames.GameHeader;
            console.log("Données brutes des matchs hier:", yesterdayData);

            if (!yesterdayData || yesterdayData.length === 0) {
                const staticGame = staticFallbackGames[Math.floor(Math.random() * staticFallbackGames.length)];
                return `${staticGame.game} [Static Fallback]`;
            }

            const game = yesterdayData[Math.floor(Math.random() * yesterdayData.length)];
            return `${game.HOME_TEAM_ABBREVIATION} ${game.HOME_TEAM_PTS} - ${game.VISITOR_TEAM_ABBREVIATION} ${game.VISITOR_TEAM_PTS} (Final, Yesterday)`;
        }

        const game = gameData[Math.floor(Math.random() * gameData.length)];
        return `${game.HOME_TEAM_ABBREVIATION} ${game.HOME_TEAM_PTS} - ${game.VISITOR_TEAM_ABBREVIATION} ${game.VISITOR_TEAM_PTS} (Final)`;
    } catch (error) {
        console.error("Erreur NBA API:", error.message);
        const staticGame = staticFallbackGames[Math.floor(Math.random() * staticFallbackGames.length)];
        return `${staticGame.game} [Static Fallback]`;
    }
}

// Récupérer une stat aléatoire (exemple basique avec box score)
async function getRandomStat() {
    const { today } = getDateStrings();

    try {
        const games = await NBA.scoreboardV2({ GameDate: today });
        const gameData = games.GameHeader;

        if (!gameData || gameData.length === 0) {
            const staticStat = staticFallbackStats[Math.floor(Math.random() * staticFallbackStats.length)];
            return `${staticStat.stat} [Static Fallback]`;
        }

        const game = gameData[Math.floor(Math.random() * gameData.length)];
        const boxScore = await NBA.boxScoreTraditionalV2({ GameID: game.GAME_ID });
        const playerStats = boxScore.PlayerStats;

        if (!playerStats || playerStats.length === 0) {
            const staticStat = staticFallbackStats[Math.floor(Math.random() * staticFallbackStats.length)];
            return `${staticStat.stat} [Static Fallback]`;
        }

        const player = playerStats[Math.floor(Math.random() * playerStats.length)];
        return `${player.PLAYER_NAME} a marqué ${player.PTS} points pour ${player.TEAM_ABBREVIATION}.`;
    } catch (error) {
        console.error("Erreur NBA API (getRandomStat):", error.message);
        const staticStat = staticFallbackStats[Math.floor(Math.random() * staticFallbackStats.length)];
        return `${staticStat.stat} [Static Fallback]`;
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