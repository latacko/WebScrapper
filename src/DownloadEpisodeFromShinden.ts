import { delay, favoritesPlayers } from ".";
import { HLSDownloader } from "./HLSDownloader";
import { InterceptHls, InterceptTypeE } from "./InterceptHls";
import { MPDDownloader } from "./MPDDownloader";

export class DownloadEpisodeFromShinden {
    browser: any
    page: any
    targetPath: any
    auth:string
    constructor(browser: any, page: any, targetPath:string, auth:string) {
        this.browser = browser;
        this.page = page;
        this.targetPath = targetPath;
        this.auth = auth;
    }

    async GetPlayer(url: string) {
        const uri = new URL(url);
        await this.page.setExtraHTTPHeaders({
            "origin": uri.host
        })
        // await this.page.goto(url);
        // console.log("goto: " + url)

        

        await this.page.screenshot({
            path: "test1_1.png"
        })
        await delay(2 * 1000)

        await this.page.screenshot({
            path: "test4.png"
        })


        const rows = await this.page.$$(
            'section.box.episode-player-list tbody tr'
        );

        const results = [];

        const seriesTitle = await this.page.$eval('.page-title', (el: any) =>
            el.textContent.trim()
        );

        const episodeNumber = await this.page.$eval('.episode-head small', (el: any) =>
            el.textContent.trim()
        );

        const episodeName = await this.page.$eval('.episode-head', (el: any) =>
            el.textContent.trim()
        );

        for (const row of rows) {
            const name = await row.$eval('.ep-pl-name', (el: any) =>
                el.textContent.trim()
            );

            // Get the second language label (mobile-hidden)
            const lang = await row.$eval('.ep-pl-slang .mobile-hidden', (el: any) =>
                el.textContent.trim()
            );

            const res = await row.$eval('.ep-pl-res', (el: any) =>
                el.textContent.trim()
            );

            // Get data-episode JSON from the "Pokaż" button
            const dataEpisodeStr = await row.$eval(
                '.ep-buttons a[data-episode]',
                (el: any) => el.getAttribute('data-episode')!
            );

            const playerData = await row.$eval(
                '.ep-buttons a[data-episode]',
                (el: any) => el.id!
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
        await this.page.screenshot({
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
        this.page.on("response", async (res: any) => {
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
            if (lang != "Polski" || !res.includes("1080p") || !favoritesPlayers.includes(name)) {
                console.log("Skipping: " + name + " " + res + " " + lang)
                continue;
            }
            this.GetDownloader(result);

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

    async GetDownloader(result: any) {
        const name = result.name;
        const playerData = result.playerData;
        const episode = result.episode;

        console.log("trying: " + name)
        // const response = await this.page.evaluate(async (episode: string, auth: string) => {
        //     console.log(episode)
        //     console.log('https://api4.shinden.pl/xhr/' + episode + '/player_load?auth=' + auth)
        //     const res = await fetch('https://api4.shinden.pl/xhr/' + episode + '/player_load?auth=' + auth, {
        //         method: 'GET',
        //         headers: {
        //             'Accept': '*/*',
        //             "origin": "https://shinden.pl"
        //             // add other headers if needed
        //         },
        //     });
        //     const data = await res.text(); // or res.text() for plain text
        //     console.log(data);
        //     return data;
        // }, episode.online_id, this.auth);

        // console.log(response);
        // await delay(Number(response) * 1000)
        // const cookies = await browser.cookies();
        // console.log(cookies)
        // const response2 = await this.page.evaluate(async (cookies: string, episode:string) => {
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
        await this.page.click("#" + playerData)
        console.log("click2")
        await this.page.click("#" + playerData)
        console.log("click3")
    }


    public async Download(url: string) {
        // const result = await this.GetPlayer();
        const result = await this.GetPlayer(url);

        console.log("Final src: " + result)
        if (result == null) {
            console.log("No player was loaded");
            return;
        }
        const [src, seriesTitle, episodeNumber, episodeName] = result

        // const { info, cookies } = await InterceptHls.interceptWithTimeout(browser, "https://vk.com/video_ext.php?oid=-229931180&id=456239194&hash=2072c183a6987fda&hd=2")
        const { info, cookies } = await InterceptHls.interceptWithTimeout(this.browser, src!)

        if (info == null) {
            console.log("Nothing was found");
            return;
        }
        console.log("Found: " + info);
        const title = (seriesTitle + " " + episodeNumber).replace(/[<>:"/\\|?*]/g, "_");
        if (info.interceptType == InterceptTypeE.HLS) {
            // await TestDownloadWithCookies(new Uri("https://rumble.com/hls-vod/6xtsag/playlist.m3u8?u=0&b=0"), cookies);
            const _downloader = new HLSDownloader(info.url, this.targetPath + title);
            await _downloader.downloadM3u8("");
        }
        else if (info.interceptType == InterceptTypeE.MPD) {
            const _downloader = new MPDDownloader(info.url, this.targetPath + title);
            await _downloader.downloadMPD();
        }
    }
}