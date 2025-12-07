import fs from 'fs';
import { delay } from '.';

export class TestIfNewEpisodeExist {
    mainUrl: string
    downloadPath: string
    browser: any
    page: any
    episodeToFound: number = 0
    constructor(mainUrl: string, downloadPath: string, browser: any, page: any) {
        this.mainUrl = mainUrl;
        this.downloadPath = downloadPath;
        this.browser = browser;
        this.page = page;
    }

    GetDownloadedEpisodes(): Promise<number> {
        return new Promise((resolve, reject) => {
            fs.readdir(this.downloadPath, (err, files) => {
                if (err) reject(err);
                else resolve(files.length);
            });
        });
    }

    async GetAvaibleEpisodes() {
        const episodes = await this.page.$$eval(
            'tbody.list-episode-checkboxes > tr',
            (rows: any) => {
                return rows.map((row: any) => {
                    const episodeNo = row.getAttribute('data-episode-no');

                    const flags = Array.from(
                        row.querySelectorAll('td span.flag-icon')
                    ).map((span: any) => span.getAttribute('title'));

                    const aEl = row.querySelector('a.button.active.detail');
                    const href = aEl ? aEl.getAttribute('href') : null;

                    return { episodeNo, flags, href };
                });
            }
        );

        // Aby zachować referencję <a>, potrzebujemy osobnego kroku:
        const episodeRows = await this.page.$$('tbody.list-episode-checkboxes > tr');

        for (let i = 0; i < episodeRows.length; i++) {
            const aHandle = await episodeRows[i].$('a.button.active.detail');
            episodes[i].aHandle = aHandle; // DODAJEMY ELEMENT HANDLE
        }

        console.log(episodes);
        return episodes
    }

    async FoundIfEpisodeExist() {
        const episodes = await this.GetAvaibleEpisodes();
        for (let index = 0; index < episodes.length; index++) {
            const episode = episodes[index];
            console.log("Episode number: " + episode.episodeNo)
            if (Number(episode.episodeNo) != this.episodeToFound) continue;
            console.log("Flags: " + episode.flags.join(" "))
            console.log(episode.flags.includes("Polski"))
            if (!episode.flags.includes("Polski"))
                return [false, null];
            console.log("i found " + episode.href);
            return [true, episode.aHandle]
        }
        return [false, null]
    }

    async Login() {
        await this.page.click(".login_form_open")
        await this.page.type('#login_form input[name="username"]', process.env.login as string);
        await this.page.type('#login_form input[name="password"]', process.env.pass as string);
        // click and wait for navigation
        await this.page.screenshot({
            path: "test.png"
        })
        await delay(2 * 1000)
        await Promise.all([
            this.page.click('#login_form button[name="login"]'),
            this.page.waitForNavigation({ waitUntil: 'networkidle0' }),
        ]);

        const foundUsernameForm = await this.page.$(`form[action="/main/login"] input[name="username"]`);
        if (foundUsernameForm) {
            await this.page.type('form[action="/main/login"] input[name="username"]', process.env.login as string);
            await this.page.type('form[action="/main/login"] input[name="password"]', process.env.pass as string);
            await delay(2 * 1000)
            await Promise.all([
                this.page.click('form[action="/main/login"] button'),
                this.page.waitForNavigation({ waitUntil: 'networkidle0' }),
            ]);
        }
    }

    async CloseAd() {
        await this.page.evaluate(() => {
            // Remove all iframes
            document.querySelectorAll('iframe').forEach(iframe => {
                console.log("removing iframe: " + iframe);
                iframe.remove()
            }
        );
        });
    }

    async Init() {
        await this.page.goto(this.mainUrl);
        await this.page.waitForSelector('.login_form_open')
        await delay(2000)
        await this.CloseAd();
        await this.page.evaluate(() => {
            console.log(document.querySelectorAll('button'))
            const btn = Array.from(document.querySelectorAll('button'))
                .find(b => b.innerText.includes('Zaakceptuj wszystko'));
            console.log(btn)
            if (btn) btn.click();
        });



        await this.CloseAd();

        await this.Login()
        this.episodeToFound = await this.GetDownloadedEpisodes();
        this.episodeToFound++;
        console.log("Episode to found: " + this.episodeToFound)

        const [_episodeExist, handle] = await this.FoundIfEpisodeExist();
        console.log(_episodeExist)
        if (!_episodeExist) return false;

        await handle.click()

        return true
    }
}