export enum InterceptTypeE {
    HLS = "HLS",
    MPD = "MPD",
    MP4 = "MP4"
}

export interface InterceptInfo {
    interceptType: InterceptTypeE;
    url: string;
}

export class InterceptHls {
    static async interceptWithTimeout(
        browser: any,  // use `any` because real-browser does not export types
        pageUrl: string,
        timeoutMs: number = 5000
    ): Promise<{ info: InterceptInfo | null, cookies: any[] }> {
        const page = await browser.newPage()
        // enable request interception using CDP
        const client = await page.target().createCDPSession();
        await client.send("Network.enable");
        await client.send("Network.setRequestInterception", {
            patterns: [{ urlPattern: "*" }]
        });

        let resolveIntercept!: (value: InterceptInfo) => void;
        const interceptPromise = new Promise<InterceptInfo>(resolve => {
            resolveIntercept = resolve;
        });

        client.on("Network.requestIntercepted", async (event: any) => {
            const url = event.request.url;

            if (url.includes(".m3u8")) {
                console.log("Intercepted HLS:", url);

                resolveIntercept({
                    interceptType: InterceptTypeE.HLS,
                    url
                });

                const headers = {
                    ...event.request.headers,
                    Host: new URL(url).host,
                };

                await client.send("Network.continueInterceptedRequest", {
                    interceptionId: event.interceptionId,
                    headers
                });

                return;
            }

            await client.send("Network.continueInterceptedRequest", {
                interceptionId: event.interceptionId
            });
        });

        page.on("response", async (res: any) => {
            const url = res.url();
            const ct = res.headers()["content-type"];

            if (!ct) return;

            console.log(`${ct} - ${url}`);

            if (ct.includes("dash+xml") || url.endsWith(".mpd")) {
                console.log("🔥 Intercepted MPD");

                try { console.log(await res.text()); } catch { }

                resolveIntercept({
                    interceptType: InterceptTypeE.MPD,
                    url
                });
            }
        });

        try {
            console.warn("try to load " + pageUrl);
            await page.goto(pageUrl, { waitUntil: "networkidle0", timeout: 60000 });
        } catch {
            console.warn("Page did not load fully");
        }

        await page.screenshot({ path: "screen1.png" });
        await this.delay(2000);
        await page.screenshot({ path: "screen2.png" });

        try {
            await page.click("video");
        } catch { }

        const info = await Promise.race([
            interceptPromise,
            new Promise<null>(resolve => setTimeout(() => resolve(null), timeoutMs))
        ]) as InterceptInfo | null;

        const cookies = await page.cookies();
        await page.close();

        return { info, cookies };
    }

    static delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
