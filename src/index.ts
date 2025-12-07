import { connect } from "puppeteer-real-browser";
import { parse } from 'ts-command-line-args';
import { DownloadEpisodeFromShinden } from "./DownloadEpisodeFromShinden";
import { TestIfNewEpisodeExist } from "./TestIfNewEpisodeExist";

interface ICopyFilesArguments {
    sourceUrl: string;
    targetPath: string;
    help?: boolean;
}

export const args = parse<ICopyFilesArguments>(
    {
        sourceUrl: String,
        targetPath: String,
        help: { type: Boolean, optional: true, alias: 'h', description: 'Prints this usage guide' },
    },
    {
        helpArg: 'help',
        headerContentSections: [{ header: 'Config', content: 'How to use shinden video downloader' }],
        footerContentSections: [{ header: 'Footer', content: `Copyright: Opensource.` }],
    },
);


require('dotenv').config()

export const favoritesPlayers = [
    "Vk",
    "Streamup",
    "Lycoriscafe"
]

export function delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }


async function Main(sourceUrl:string, targetPath:string) {
    const { browser, page } = await connect({
        headless: false,

        args: [],

        customConfig: {},

        turnstile: true,

        connectOption: {},

        disableXvfb: false,
        ignoreAllFlags: false,
    });

    await browser.setCookie({
        name: "cb-rodo",
        value: "accepted",
        domain: ".shinden.pl",
        path: "/",
        expires: Date.now() + 1000 * 60,
        size: 15,
        httpOnly: false,
        secure: false,
        session: false,
    });

    const _testIfNewEpisodeExist = new TestIfNewEpisodeExist(sourceUrl, targetPath, browser, page);
    const _episodeFound = await _testIfNewEpisodeExist.Init();
    if(_episodeFound) {
        const _downloadEpisodeFromShinden = new DownloadEpisodeFromShinden(browser, page, targetPath, process.env.auth!)
        await _downloadEpisodeFromShinden.Download(sourceUrl);
    } else {
        console.log("no new episode found!")
    }

    await browser.close()
}

Main(args.sourceUrl, args.targetPath);

// const flags = ["Polski", "Maszynowy Polski", "Angielski"]
// console.log(flags.includes("Polski"))