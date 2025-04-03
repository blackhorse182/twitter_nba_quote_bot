const { TwitterApi } = require('twitter-api-v2');
const schedule = require('node-schedule');
const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const client = new TwitterApi({
    appKey: 'MQnQJz6JfQ6FdbhGjmsgtN5aE', // Remplace par ta vraie API Key
    appSecret: 'MO4J0paVS0kvmPvSh715OjDU5R8cjJuWlOPN6Zz5JDPZqgmb5G',         // Remplace par ton vrai API Secret
    accessToken: '1509015998317404161-0PtKc05VWPikCLXyKtXvIIo5IQ8GUF',    // Ton Access Token
    accessSecret: 'ejdT2uFYLQXFvHM1rkoJXe6U2FX0PHTqWjgqVQhm3EmoL',  // Ton Access Secret
  });

  const hashtags = "#NBA #Basketball #Stats";

// Static fallback data
const staticFallbackGames = [
    "Lakers 110 - Warriors 105 (Final, 2023 Playoffs)",
    "Celtics 120 - Heat 116 (Final, 2023 ECF)",
    "Nuggets 113 - Lakers 111 (Final, 2023 WCF)",
    "Bucks 128 - Suns 99 (Final, 2021 Finals)",
    "Raptors 114 - Warriors 110 (Final, 2019 Finals)",
];

const staticFallbackStats = [
    "LeBron James scored 38 points for Lakers (2023 Playoffs).",
    "Jayson Tatum scored 40 points for Celtics (2023 ECF).",
    "Nikola Jokic scored 32 points for Nuggets (2023 WCF).",
    "Giannis Antetokounmpo scored 50 points for Bucks (2021 Finals).",
    "Kawhi Leonard scored 36 points for Raptors (2019 Finals).",
];

// Get today and yesterday's dates
const getDateStrings = () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    return {
        today: today.toISOString().split('T')[0].replace(/-/g, ''),
        yesterday: yesterday.toISOString().split('T')[0].replace(/-/g, ''),
    };
};

// Fetch game results from NBA.com
async function getRecentGameResult() {
    const { today, yesterday } = getDateStrings();
    try {
        const response = await axios.get('https://www.nba.com/games');
        const $ = cheerio.load(response.data);
        const games = [];

        $('.GameCardMatchup_gcMatchupLink__YOsQA').each((i, element) => {
            const gameBlock = $(element).closest('.GameCard_gc__n6XNv');
            const teams = gameBlock.find('.MatchupCardTeamName_base__1q7Zg').map((j, el) => $(el).text().trim()).get();
            const scores = gameBlock.find('.GameCardScore_score__q_3aN').map((j, el) => $(el).text().trim()).get();
            const status = gameBlock.find('.GameCardStatusText_gcsText__25-CQ').text().trim();

            if (teams.length === 2 && scores.length === 2 && status.includes('Final')) {
                games.push(`${teams[0]} ${scores[0]} - ${teams[1]} ${scores[1]} (Final)`);
            }
        });

        if (games.length === 0) {
            return await getFallbackGameResult(today, yesterday);
        }
        return games[Math.floor(Math.random() * games.length)];
    } catch (error) {
        console.error("Error fetching game result from NBA.com:", error.message);
        return await getFallbackGameResult(today, yesterday);
    }
}

// Fallback game result from ESPN or static
async function getFallbackGameResult(today, yesterday) {
    try {
        const response = await axios.get(`https://www.espn.com/nba/scoreboard/_/date/${today}`);
        const $ = cheerio.load(response.data);
        let games = [];

        $('.ScoreboardScoreCell').each((i, element) => {
            const teams = $(element).find('.ScoreCell_Score--scoreboard').text().split(' ');
            const scores = $(element).find('.ScoreCell_Score').map((j, el) => $(el).text()).get();
            if (scores.length === 2) {
                games.push(`${teams[0]} ${scores[0]} - ${teams[1]} ${scores[1]} (Final)`);
            }
        });

        if (games.length === 0) {
            const yesterdayResponse = await axios.get(`https://www.espn.com/nba/scoreboard/_/date/${yesterday}`);
            const $y = cheerio.load(yesterdayResponse.data);
            $y('.ScoreboardScoreCell').each((i, element) => {
                const teams = $(element).find('.ScoreCell_Score--scoreboard').text().split(' ');
                const scores = $(element).find('.ScoreCell_Score').map((j, el) => $(el).text()).get();
                if (scores.length === 2) {
                    games.push(`${teams[0]} ${scores[0]} - ${teams[1]} ${scores[1]} (Final, Yesterday)`);
                }
            });
        }

        if (games.length === 0) {
            const staticGame = staticFallbackGames[Math.floor(Math.random() * staticFallbackGames.length)];
            return `${staticGame} [Static Fallback]`;
        }
        return games[Math.floor(Math.random() * games.length)];
    } catch (error) {
        console.error("Error fetching fallback game result from ESPN:", error.message);
        const staticGame = staticFallbackGames[Math.floor(Math.random() * staticFallbackGames.length)];
        return `${staticGame} [Static Fallback]`;
    }
}

// Fetch a random stat from NBA.com
async function getRandomStat() {
    const { today, yesterday } = getDateStrings();
    try {
        const response = await axios.get('https://www.nba.com/games');
        const $ = cheerio.load(response.data);
        const stats = [];

        $('.GameCard_gc__n6XNv').each((i, element) => {
            const team = $(element).find('.MatchupCardTeamName_base__1q7Zg').first().text().trim();
            const leaderText = $(element).find('.GameCardLeaderStat_statValue__kj4Go').first().text().trim();
            const status = $(element).find('.GameCardStatusText_gcsText__25-CQ').text().trim();

            if (leaderText && status.includes('Final')) {
                stats.push(`A player scored ${leaderText} points for ${team}.`);
            }
        });

        if (stats.length === 0) {
            return await getFallbackStat(today, yesterday);
        }
        return stats[Math.floor(Math.random() * stats.length)];
    } catch (error) {
        console.error("Error fetching stat from NBA.com:", error.message);
        return await getFallbackStat(today, yesterday);
    }
}

// Fallback stat from ESPN or static
async function getFallbackStat(today, yesterday) {
    try {
        const response = await axios.get(`https://www.espn.com/nba/scoreboard/_/date/${today}`);
        const $ = cheerio.load(response.data);
        let stats = [];

        $('.ScoreboardScoreCell__Leaders').each((i, element) => {
            const player = $(element).find('.Athlete__PlayerName').text();
            const points = $(element).find('.Stat__Value').text();
            const team = $(element).closest('.ScoreboardScoreCell').find('.ScoreCell_Score--scoreboard').text().split(' ')[0];
            if (player && points) {
                stats.push(`${player} scored ${points} points for ${team}.`);
            }
        });

        if (stats.length === 0) {
            const yesterdayResponse = await axios.get(`https://www.espn.com/nba/scoreboard/_/date/${yesterday}`);
            const $y = cheerio.load(yesterdayResponse.data);
            $y('.ScoreboardScoreCell__Leaders').each((i, element) => {
                const player = $(element).find('.Athlete__PlayerName').text();
                const points = $(element).find('.Stat__Value').text();
                const team = $(element).closest('.ScoreboardScoreCell').find('.ScoreCell_Score--scoreboard').text().split(' ')[0];
                if (player && points) {
                    stats.push(`${player} scored ${points} points for ${team} (Yesterday).`);
                }
            });
        }

        if (stats.length === 0) {
            const staticStat = staticFallbackStats[Math.floor(Math.random() * staticFallbackStats.length)];
            return `${staticStat} [Static Fallback]`;
        }
        return stats[Math.floor(Math.random() * stats.length)];
    } catch (error) {
        console.error("Error fetching fallback stat from ESPN:", error.message);
        const staticStat = staticFallbackStats[Math.floor(Math.random() * staticFallbackStats.length)];
        return `${staticStat} [Static Fallback]`;
    }
}

// Randomly select content type
async function getRandomNBAPost() {
    const isGameResult = Math.random() < 0.5;
    return isGameResult ? await getRecentGameResult() : await getRandomStat();
}

// Post to Twitter
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
        console.error("Error posting tweet:", error.message);
    }
}

// Schedule posts every 6 hours
schedule.scheduleJob('0 */12 * * *', () => {
    postNBATweet();
});

// Initial post on startup
postNBATweet();

// Start Express server
app.get('/', (req, res) => {
    res.send('NBA Twitter Bot is running!');
});

app.listen(PORT, () => {
    console.log(`NBA Bot started! Posting every 6 hours. Server running on port ${PORT}`);
});