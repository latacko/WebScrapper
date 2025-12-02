import { connect } from "puppeteer-real-browser";
import { InterceptHls, InterceptTypeE } from "./InterceptHls";
import { HLSDownloader } from "./HLSDownloader";
import { MPDDownloader } from "./MPDDownloader";
import { parse } from 'ts-command-line-args';

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

const favoritesPlayers = [
    "Vk",
    "Streamup",
    "Lycoriscafe"
]


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

    async function GetPlayer(url: string) {
        const uri = new URL(url);
        await page.setExtraHTTPHeaders({
            "origin": uri.host
        })
        await page.goto(url);
        console.log("goto: " + url)

        await page.click(".login_form_open")
        await page.type('#login_form input[name="username"]', process.env.login as string);
        await page.type('#login_form input[name="password"]', process.env.pass as string);
        // click and wait for navigation
        await page.screenshot({
            path: "test.png"
        })
        await delay(2 * 1000)
        await Promise.all([
            page.click('#login_form button[name="login"]'),
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
        ]);

        const foundUsernameForm = await page.$(`form[action="/main/login"] input[name="username"]`);
        if (foundUsernameForm) {
            await page.type('form[action="/main/login"] input[name="username"]', process.env.login as string);
            await page.type('form[action="/main/login"] input[name="password"]', process.env.pass as string);
            await delay(2 * 1000)
            await Promise.all([
                page.click('form[action="/main/login"] button'),
                page.waitForNavigation({ waitUntil: 'networkidle0' }),
            ]);
        }

        await page.screenshot({
            path: "test1_1.png"
        })
        await delay(2 * 1000)

        await page.screenshot({
            path: "test4.png"
        })


        const rows = await page.$$(
            'section.box.episode-player-list tbody tr'
        );

        const results = [];

        const seriesTitle = await page.$eval('.page-title', el =>
            el.textContent.trim()
        );

        const episodeNumber = await page.$eval('.episode-head small', el =>
            el.textContent.trim()
        );

        const episodeName = await page.$eval('.episode-head', el =>
            el.textContent.trim()
        );

        for (const row of rows) {
            const name = await row.$eval('.ep-pl-name', el =>
                el.textContent.trim()
            );

            // Get the second language label (mobile-hidden)
            const lang = await row.$eval('.ep-pl-slang .mobile-hidden', el =>
                el.textContent.trim()
            );

            const res = await row.$eval('.ep-pl-res', el =>
                el.textContent.trim()
            );

            // Get data-episode JSON from the "Pokaż" button
            const dataEpisodeStr = await row.$eval(
                '.ep-buttons a[data-episode]',
                el => el.getAttribute('data-episode')!
            );

            const playerData = await row.$eval(
                '.ep-buttons a[data-episode]',
                el => el.id!
            );

            const dataEpisode = JSON.parse(dataEpisodeStr);

            results.push({
                name,
                lang,
                res,
                playerData,
                episode: dataEpisode
            });
        }

        console.log(results);
        await page.screenshot({
            path: "test5.png"
        })

        let resolveIntercept!: (value: string) => void;
        let interceptPromise = new Promise<string>(resolve => {
            resolveIntercept = resolve;
        });
        function resetInterceptPromise() {
            interceptPromise = new Promise<string>((resolve) => {
                resolveIntercept = resolve;
            });
        }
        page.on("response", async (res: any) => {
            const url = res.url();
            const ct = res.headers()["content-type"];
            const status = res.status(); // <-- get HTTP status code

            if (!ct) return;

            if (url.includes("player_show")) {
                console.log("🔥 Intercepted player_show");

                if (status === 403) {
                    console.log("❌ Response returned 403 Forbidden");
                    resolveIntercept("403");
                    return;
                }

                try {
                    const responsebody = await res.text();
                    console.log(responsebody);
                    resolveIntercept(responsebody);
                } catch (error) {
                    console.log(error);
                }

            }
        });
        for (const result of results) {
            const name = result.name;
            const lang = result.lang;
            const res = result.res;
            if (lang != "Polski" || res != "1080p" || !favoritesPlayers.includes(name)) {
                console.log("Skipping: " + name + " " + res + " " + lang)
                continue;
            }
            GetDownloader(result);

            const info = await Promise.race([
                interceptPromise,
                new Promise<null>(resolve => setTimeout(() => resolve(null), 20000))
            ]) as string | null;

            if (info == null) {
                console.log("no player loaded")
                continue;
            }

            if (info == "403") {
                console.log("error: 403")
                resetInterceptPromise();
                continue;
            }
            const match = info.match(/<iframe[^>]+src="([^"]+)"/);
            const src = match ? match[1] : null;

            console.log("src " + src);
            return [src, seriesTitle, episodeNumber, episodeName];
        }
        return null;
    }

    async function GetDownloader(result: any) {
        const name = result.name;
        const playerData = result.playerData;
        const episode = result.episode;

        console.log("trying: " + name)

        const response = await page.evaluate(async (episode: string) => {
            console.log(episode)
            const res = await fetch('https://api4.shinden.pl/xhr/' + episode + '/player_load?auth='+process.env.auth, {
                method: 'GET',
                headers: {
                    'Accept': '*/*',
                    // add other headers if needed
                },
            });
            const data = await res.text(); // or res.text() for plain text
            console.log(data);
            return data;
        }, episode.online_id);

        console.log(response);
        await delay(Number(response) * 1000)
        // const cookies = await browser.cookies();
        // console.log(cookies)
        // const response2 = await page.evaluate(async (cookies: string, episode:string) => {
        //     const res = await fetch('https://api4.shinden.pl/xhr/'+episode+'/player_show?auth=UGF0YWNrbzoyNTAyOTksNSwyMDI1MTIwMjE2LDMsMzMzNjE5NTQ1MA%3D%3D&width=786&height=-1', {
        //         method: 'GET',
        //         headers: {
        //             'Accept': '*/*',
        //             'cookie': cookies
        //             // add other headers if needed
        //         },
        //     });
        //     const data = await res.text(); // or res.text() for plain text
        //     return data;
        // }, episode.online_id, cookies);
        // console.log(response2);
        console.log("click1")
        await page.click("#" + playerData)
        console.log("click2")
        await page.click("#" + playerData)
        console.log("click3")
    }

    function delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    const result = await GetPlayer(sourceUrl);
    console.log("Final src: " + result)
    if (result == null) {
        console.log("No player was loaded");
        return;
    }
    const [src, seriesTitle, episodeNumber, episodeName] = result

    // const { info, cookies } = await InterceptHls.interceptWithTimeout(browser, "https://vk.com/video_ext.php?oid=-229931180&id=456239194&hash=2072c183a6987fda&hd=2")
    const { info, cookies } = await InterceptHls.interceptWithTimeout(browser, src!)

    if (info == null) {
        console.log("Nothing was found");
        return;
    }
    console.log("Found: " + info);
    const title = (seriesTitle + " " + episodeNumber).replace(/[<>:"/\\|?*]/g, "_");
    if (info.interceptType == InterceptTypeE.HLS) {
        // await TestDownloadWithCookies(new Uri("https://rumble.com/hls-vod/6xtsag/playlist.m3u8?u=0&b=0"), cookies);
        const _downloader = new HLSDownloader(info.url, targetPath+title);
        await _downloader.downloadM3u8("");
    }
    else if (info.interceptType == InterceptTypeE.MPD) {
        const _downloader = new MPDDownloader(info.url, targetPath+title);
        await _downloader.downloadMPD();
    }

    await browser.close()
}

Main(args.sourceUrl, args.targetPath);