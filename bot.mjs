import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchNowPlaying, cleanArtistName, createText, getReplyMarkup } from './src/utils.mjs';
import { getSpotifyDetails } from './src/spotify.mjs';
import { getYouTubeMusicDetails } from './src/youtube.mjs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const lastfmUser = process.env.LASTFM_USER;
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const channelId = process.env.TELEGRAM_CHANNEL_ID;
const lastMessageIdFile = path.resolve(__dirname, 'lastMessageId.txt');

let lastPostedMessageId = null;
let lastListenedTime = null;

function readLastPostedMessageId() {
    try {
        if (fs.existsSync(lastMessageIdFile)) {
            const data = fs.readFileSync(lastMessageIdFile, 'utf-8');
            lastPostedMessageId = data ? parseInt(data, 10) : null;
        }
    } catch (error) {
        console.error('Error reading last posted message ID:', error);
    }
}

function writeLastPostedMessageId(messageId) {
    try {
        fs.writeFileSync(lastMessageIdFile, messageId.toString());
    } catch (error) {
        console.error('Error writing last posted message ID:', error);
    }
}

async function postNowPlaying(track) {
    const { artist, name } = track;
    const artistName = cleanArtistName(artist['#text']);
    const trackName = name;

    let details = await getSpotifyDetails(artistName, trackName) || await getYouTubeMusicDetails(artistName, trackName);

    if (!details) {
        console.error('Could not fetch details from Spotify or YouTube Music');
        return;
    }

    const { spotifyLink, youtubeMusicLink, albumCover, albumName, releaseDate, id, artistLink } = details;

    const text = createText({ trackName, artistName, albumName, releaseDate });

    try {
        if (lastPostedMessageId) {
            await bot.telegram.editMessageMedia(
                channelId,
                lastPostedMessageId,
                null,
                {
                    type: 'photo',
                    media: albumCover,
                    caption: `${text}\n<b>𝙇𝙖𝙨𝙩 𝙇𝙞𝙨𝙩𝙚𝙣𝙚𝙙:</b> ${lastListenedTime}\n<b>𝙇𝙖𝙨𝙩.𝙁𝙈 𝙋𝙧𝙤𝙛𝙞𝙡𝙚:</b> <a href="https://www.last.fm/user/${encodeURIComponent(lastfmUser)}">${lastfmUser}</a>`,
                    parse_mode: 'HTML'
                },
                getReplyMarkup({ id, artistName })
            );
        } else {
            const message = await bot.telegram.sendPhoto(channelId, albumCover, {
                caption: `${text}\n\n<b>𝙇𝙖𝙨𝙩 𝙇𝙞𝙨𝙩𝙚𝙣𝙚𝙙:</b> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\n<b>𝙇𝙖𝙨𝙩.𝙁𝙈 𝙋𝙧𝙤𝙛𝙞𝙡𝙚:</b> <a href="https://www.last.fm/user/${encodeURIComponent(lastfmUser)}">${lastfmUser}</a>`,
                parse_mode: 'HTML'
            }, getReplyMarkup({ id, artistName }));

            lastPostedMessageId = message.message_id;
            writeLastPostedMessageId(lastPostedMessageId);
        }

        // Update last listened time
        lastListenedTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    } catch (error) {
        console.error('Error posting or updating to Telegram:', error);
    }
}

async function checkAndPostNowPlaying() {
    try {
        const nowPlayingTrack = await fetchNowPlaying();

        if (nowPlayingTrack) {
            await postNowPlaying(nowPlayingTrack);
        }
    } catch (error) {
        console.error('Error fetching or posting now playing:', error);
    }
}

async function initialize() {
    readLastPostedMessageId();
    if (!lastPostedMessageId) {
        console.log("No previous message ID found. A new message will be posted.");
    }
    setInterval(checkAndPostNowPlaying, 5000);
}

initialize();
bot.launch();
