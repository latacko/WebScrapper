import fs, { unlink } from "fs";
import fsPromises from "fs/promises";
import path, { basename } from "path";
import { exec, spawn } from "child_process";

export class HLSDownloader {
    private m3u8Url: string;
    private baseUrl: string;
    private host: string;
    private token: string | null;
    private outputPath: string;

    constructor(url: string, output: string) {
        this.m3u8Url = url;

        const uri = new URL(url);
        this.host = uri.hostname;

        // base URL = folder where .m3u8 resides
        this.baseUrl = `https://${uri.hostname}${uri.pathname}`;
        this.baseUrl = this.baseUrl.substring(0, this.baseUrl.lastIndexOf("/") + 1);

        this.token = uri.searchParams.get("token");
        this.outputPath = output;

        console.log(this.baseUrl);
        console.log(this.token);
    }

    /** Recursively download m3u8 → playlist → segments → final .ts */
    async downloadM3u8(file: string = ""): Promise<void> {
        const target = file.length === 0 ? this.m3u8Url : this.baseUrl + file;

        console.log("trying to download: " + target);

        try {
            const res = await fetch(target, {
                headers: {
                    "Host": this.host,
                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
                    "Cookie": "__cf_bm=lXTglJBvRe2E1VbpCUykPIOVBXP.220WFajkVFhrpXA-1764618945-1.0.1.1-YEuzF3DQrQcwCL7N9lRe3a6_.KOTFsekDoGkjEyrRijzWcmnHgtQL10eZ1f7okx5VdxNKInWp2PNSiKcWMKENiV.Ym6ndAyvYghLb4Jqksg"
                }
            });

            const text = await res.text();

            if (text.includes(".m3u8")) {
                const lines = text.split(/\r?\n/);

                for (const line of lines) {
                    if (line.includes(".m3u8")) {
                        return await this.downloadM3u8(line.trim());
                    }
                }
            } else if (text.includes(".ts")) {
                await this.downloadPlaylist(text);
            } else {
                throw new Error("No .m3u8 or .ts found");
            }
        } catch (err: any) {
            console.error("Failed to download .m3u8:", err.message);
        }
    }

    /** Parse playlist and start segment downloading */
    private async downloadPlaylist(content: string): Promise<void> {
        console.log("Downloaded final playlist:");
        console.log(content);

        const segments: string[] = [];
        const lines = content.split(/\r?\n/);

        for (const line of lines) {
            if (line.includes(".ts")) {
                segments.push(this.baseUrl + line.trim());
            }
        }

        await this.downloadVideo(segments);
    }

    /** Download all TS segments into a single output file */
    private async downloadVideo(segments: string[]): Promise<void> {
        const outFile = this.outputPath + ".ts";
        const output = fs.createWriteStream(outFile);

        for (let i = 0; i < segments.length; i++) {
            const url = segments[i];
            console.log(`Downloading ${i + 1}/${segments.length}: ${url}`);

            try {
                const res = await fetch(url);
                const buffer = Buffer.from(await res.arrayBuffer());
                output.write(buffer);
            } catch (err: any) {
                console.error(`Failed to download ${url}:`, err.message);
            }
        }

        output.close();

        await this.convertToMp4(outFile);
    }

    /** Convert final TS file to MP4 using FFmpeg */
    async convertToMp4(tsPath: string): Promise<void> {
        console.log("Converting:", tsPath);

        const output = this.outputPath + ".mp4";

        await new Promise<void>((resolve, reject) => {
            const ffmpeg = spawn("ffmpeg", [
                "-i", tsPath,
                "-c:v", "libx264",
                "-vf", "format=yuv420p",
                "-c:a", "aac",
                "-movflags", "+faststart",
                "-y",
                output
            ]);

            // FFmpeg logs progress to stderr
            ffmpeg.stderr.on("data", data => {
                process.stdout.write(data.toString());
            });

            ffmpeg.on("error", (err) => {
                console.error("FFmpeg spawn error:", err);
                reject(err);
            });

            ffmpeg.on("close", (code) => {
                if (code === 0) {
                    console.log("Conversion completed:", output);
                    resolve();
                } else {
                    reject(new Error(`FFmpeg exited with code ${code}`));
                }

                unlink(tsPath, (err) => {
                    if (err) {
                        console.error('Error deleting file  ' + basename(tsPath) + ':', err);
                        return;
                    }
                    console.log('File ' + basename(tsPath) + ' deleted successfully!');
                });
            });
        });
    }
}
