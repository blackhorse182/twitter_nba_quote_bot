const { TwitterApi } = require('twitter-api-v2');
const schedule = require('node-schedule'); // Ensure @types/node-schedule is installed for TypeScript
const express = require('express'); // Ensure @types/express is installed for TypeScript
const axios = require('axios');
require('dotenv').config({ path: './keys.env' });

const app = express();
const PORT = process.env.PORT || 3000;

const client = new TwitterApi({
    appKey: process.env.TWITTER_APP_KEY,
    appSecret: process.env.TWITTER_APP_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

const hashtags = "#NBA #Basketball #Stats";

const staticFallbackGames = [
    { game: "Bulls 87 - Jazz 86 (Final, 1998 Finals) - Jordan's 'Last Shot'", video: "[invalid url, do not cite]" },
    { game: "Cavs 93 - Warriors 89 (Final, 2016 Finals) - LeBron's Block & Kyrie's 3", video: "[invalid url, do not cite]" },
    { game: "Lakers 100 - Celtics 96 (Final, 2010 Finals) - Kobe's 5th ring", video: "[invalid url, do not cite]" },
    { game: "Spurs 81 - Pistons 74 (Final, 2005 Finals) - Duncan's dominance", video: "[invalid url, do not cite]" },
    { game: "Heat 103 - Spurs 100 (OT, 2013 Finals) - Ray Allen's clutch 3", video: "[invalid url, do not cite]" }
];

const staticFallbackStats = [
    { stat: "Michael Jordan scored 45 points for Bulls (1998 Finals - 'Last Shot').", video: "[invalid url, do not cite]" },
    { stat: "LeBron James recorded a triple-double (27-11-11) for Cavs (2016 Finals).", video: "[invalid url, do not cite]" },
    { stat: "Kobe Bryant scored 23 points and grabbed 15 rebounds for Lakers (2010 Finals).", video: "[invalid url, do not cite]" },
    { stat: "Tim Duncan scored 25 points and 11 rebounds for Spurs (2005 Finals).", video: "[invalid url, do not cite]" },
    { stat: "Ray Allen hit a game-tying 3-pointer with 5.2 seconds left for Heat (2013 Finals).", video: "[invalid url, do not cite]" }
];

const getDateStrings = () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    return {
        today: today.toISOString().split('T')[0].replace(/-/g, ''),
        yesterday: yesterday.toISOString().split('T')[0].replace(/-/g, ''),
    };
};

async function getRecentGameResult() {
    const { today, yesterday } = getDateStrings();
    const urlToday = `[invalid url, do not cite]`;
    try {
        const { data } = await axios.get(urlToday);
        const events = data.events;
        if (!events || events.length === 0) {
            const urlYesterday = `[invalid url, do not cite]`;
            const yesterdayData = await axios.get(urlYesterday);
            const yesterdayEvents = yesterdayData.data.events;
            if (!yesterdayEvents || yesterdayEvents.length === 0) {
                return getStaticFallbackGame();
            }
            const event = yesterdayEvents[Math.floor(Math.random() * yesterdayEvents.length)];
            const homeTeam = event.competitions[0].competitors.find(c => c.homeAway === 'home');
            const awayTeam = event.competitions[0].competitors.find(c => c.homeAway === 'away');
            return `${homeTeam.team.abbreviation} ${homeTeam.score} - ${awayTeam.team.abbreviation} ${awayTeam.score} (Final, Yesterday)`;
        }
        const event = events[Math.floor(Math.random() * events.length)];
        const homeTeam = event.competitions[0].competitors.find(c => c.homeAway === 'home');
        const awayTeam = event.competitions[0].competitors.find(c => c.homeAway === 'away');
        return `${homeTeam.team.abbreviation} ${homeTeam.score} - ${awayTeam.team.abbreviation} ${awayTeam.score} (Final)`;
    } catch (error) {
        console.error("Error fetching from ESPN API:", error.message);
        return getStaticFallbackGame();
    }
}

function getStaticFallbackGame() {
    const staticGame = staticFallbackGames[Math.floor(Math.random() * staticFallbackGames.length)];
    return staticGame.game;
}

async function getRandomStat() {
    const { today } = getDateStrings();
    const urlToday = `[invalid url, do not cite]`;
    try {
        const { data } = await axios.get(urlToday);
        const events = data.events;
        if (!events || events.length === 0) {
            return getStaticFallbackStat();
        }
        const event = events[Math.floor(Math.random() * events.length)];
        const competitions = event.competitions[0];
        const players = competitions.leaders[0].leaders;
        if (!players || players.length === 0) {
            return getStaticFallbackStat();
        }
        const player = players[Math.floor(Math.random() * players.length)];
        return `${player.athlete.displayName} scored ${player.stats[0].value} points for ${player.team.abbreviation}.`;
    } catch (error) {
        console.error("Error fetching stats from ESPN API:", error.message);
        return getStaticFallbackStat();
    }
}

function getStaticFallbackStat() {
    const staticStat = staticFallbackStats[Math.floor(Math.random() * staticFallbackStats.length)];
    return staticStat.stat;
}

async function getRandomNBAPost() {
    const isGameResult = Math.random() < 0.5;
    return isGameResult ? await getRecentGameResult() : await getRandomStat();
}

async function postNBATweet() {
    try {
        const content = await getRandomNBAPost();
        if (typeof content !== 'string') {
            throw new Error("Invalid content, expected a string: " + content);
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
        console.error("Error in postNBATweet:", error.message);
    }
}

schedule.scheduleJob('0 */6 * * *', async () => {
    await postNBATweet();
});

getRandomNBAPost().then(result => console.log("Result of getRandomNBAPost:", result));

postNBATweet().then(() => console.log("Initial post sent"));

app.get('/', (req, res) => {
    res.send('NBA Twitter Bot is running!');
});

app.listen(PORT, () => {
    console.log(`NBA Bot started! Posting every 6 hours. Server running on port ${PORT}`);
});