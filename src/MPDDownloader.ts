import { createWriteStream, unlink } from "fs";
import { parseStringPromise } from "xml2js";
import { spawn } from "child_process";
import path, { basename } from "path";

import { pipeline } from "stream";
import { promisify } from "util";

interface AudioData {
    bandwidth: number;
    url: string;
}

const preferredQualities = ["full", "hd", "sd"];

export class MPDDownloader {
    mpdUrl: string;
    baseUrl: string;
    host: string;
    outputPath: string;

    constructor(url: string, output: string) {
        this.mpdUrl = url;
        const urlObj = new URL(url);
        this.host = urlObj.host;
        this.baseUrl = urlObj.origin + urlObj.pathname;
        this.baseUrl = this.baseUrl.substring(0, this.baseUrl.lastIndexOf("/") + 1);
        this.outputPath = output;

        console.log("MPD URL:", this.mpdUrl);
        console.log("Base URL:", this.baseUrl);
    }

    async downloadMPD() {
        try {
            const res = await fetch(this.mpdUrl, {
                headers: {
                    Host: this.host,
                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 OPR/124.0.0.0"
                }
            });
            const xml = await res.text();
            await this.parseXml(xml);
        } catch (err) {
            console.error("Failed to download MPD:", err);
        }

        // this.parseXml(`<?xml version="1.0" encoding="UTF-8" standalone="no"?><MPD xmlns="urn:mpeg:DASH:schema:MPD:2011" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" mediaPresentationDuration="PT1430.102S" minBufferTime="PT12S" profiles="urn:webm:dash:profile:webm-on-demand:2012" type="static" xsi:schemaLocation="urn:mpeg:DASH:schema:MPD:2011"><Period duration="PT1430.102S" id="0" start="PT0S"><AdaptationSet bitstreamSwitching="true" codecs="vp9" id="0" mimeType="video/webm" subsegmentAlignment="true" subsegmentStartsWithSAP="1"><Representation bandwidth="140174" frameRate="24" height="144" id="0" quality="mobile" width="256"><BaseURL>?expires=1765160691632&amp;srcIp=159.26.110.2&amp;pr=40&amp;srcAg=CHROME&amp;ms=95.142.206.171&amp;type=4&amp;sig=lk0DaIYPxds&amp;ct=21&amp;urls=185.226.52.211%3B185.226.55.183&amp;clientType=13&amp;zs=43&amp;id=9229324192465</BaseURL><SegmentBase indexRange="434-5205" indexRangeExact="true"><Initialization range="0-433"/></SegmentBase></Representation><Representation bandwidth="303622" frameRate="24" height="240" id="1" quality="lowest" width="426"><BaseURL>?expires=1765160691632&amp;srcIp=159.26.110.2&amp;pr=40&amp;srcAg=CHROME&amp;ms=95.142.206.171&amp;type=0&amp;sig=oz2Y1ujhNZs&amp;ct=21&amp;urls=185.226.52.211%3B185.226.55.183&amp;clientType=13&amp;zs=43&amp;id=9229324192465</BaseURL><SegmentBase indexRange="434-5237" indexRangeExact="true"><Initialization range="0-433"/></SegmentBase></Representation><Representation bandwidth="615856" frameRate="24" height="360" id="2" quality="low" width="640"><BaseURL>?expires=1765160691632&amp;srcIp=159.26.110.2&amp;pr=40&amp;srcAg=CHROME&amp;ms=95.142.206.171&amp;type=1&amp;sig=Xt4lfAqtMsQ&amp;ct=21&amp;urls=185.226.52.211%3B185.226.55.183&amp;clientType=13&amp;zs=43&amp;id=9229324192465</BaseURL><SegmentBase indexRange="435-5343" indexRangeExact="true"><Initialization range="0-434"/></SegmentBase></Representation><Representation bandwidth="1087172" frameRate="24" height="480" id="3" quality="sd" width="852"><BaseURL>?expires=1765160691632&amp;srcIp=159.26.110.2&amp;pr=40&amp;srcAg=CHROME&amp;ms=95.142.206.171&amp;type=2&amp;sig=APhUSCA4hRE&amp;ct=21&amp;urls=185.226.52.211%3B185.226.55.183&amp;clientType=13&amp;zs=43&amp;id=9229324192465</BaseURL><SegmentBase indexRange="435-5383" indexRangeExact="true"><Initialization range="0-434"/></SegmentBase></Representation><Representation bandwidth="2204191" frameRate="24" height="720" id="4" quality="hd" width="1280"><BaseURL>?expires=1765160691632&amp;srcIp=159.26.110.2&amp;pr=40&amp;srcAg=CHROME&amp;ms=95.142.206.171&amp;type=3&amp;sig=2a3UWdwXV2Q&amp;ct=21&amp;urls=185.226.52.211%3B185.226.55.183&amp;clientType=13&amp;zs=43&amp;id=9229324192465</BaseURL><SegmentBase indexRange="435-5427" indexRangeExact="true"><Initialization range="0-434"/></SegmentBase></Representation><Representation bandwidth="3871678" frameRate="24" height="1080" id="5" quality="full" width="1920"><BaseURL>?expires=1765160691632&amp;srcIp=159.26.110.2&amp;pr=40&amp;srcAg=CHROME&amp;ms=95.142.206.171&amp;type=5&amp;sig=BuzsIT9Qy7Q&amp;ct=21&amp;urls=185.226.52.211%3B185.226.55.183&amp;clientType=13&amp;zs=43&amp;id=9229324192465</BaseURL><SegmentBase indexRange="435-5435" indexRangeExact="true"><Initialization range="0-434"/></SegmentBase></Representation></AdaptationSet><AdaptationSet audioSamplingRate="48000" bitstreamSwitching="true" codecs="opus" id="1" mimeType="audio/webm" subsegmentAlignment="true" subsegmentStartsWithSAP="1"><AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="2"/><Representation bandwidth="34161" id="6"><BaseURL>?expires=1765160691632&amp;srcIp=159.26.110.2&amp;pr=40&amp;srcAg=CHROME&amp;ms=95.142.206.171&amp;type=4&amp;sig=lk0DaIYPxds&amp;ct=22&amp;urls=185.226.52.211%3B185.226.55.183&amp;clientType=13&amp;zs=43&amp;id=9229324192465</BaseURL><SegmentBase indexRange="457-14741" indexRangeExact="true"><Initialization range="0-456"/></SegmentBase></Representation><Representation bandwidth="130669" id="7"><BaseURL>?expires=1765160691632&amp;srcIp=159.26.110.2&amp;pr=40&amp;srcAg=CHROME&amp;ms=95.142.206.171&amp;type=0&amp;sig=oz2Y1ujhNZs&amp;ct=22&amp;urls=185.226.52.211%3B185.226.55.183&amp;clientType=13&amp;zs=43&amp;id=9229324192465</BaseURL><SegmentBase indexRange="457-14948" indexRangeExact="true"><Initialization range="0-456"/></SegmentBase></Representation><Representation bandwidth="195255" id="8"><BaseURL>?expires=1765160691632&amp;srcIp=159.26.110.2&amp;pr=40&amp;srcAg=CHROME&amp;ms=95.142.206.171&amp;type=1&amp;sig=Xt4lfAqtMsQ&amp;ct=22&amp;urls=185.226.52.211%3B185.226.55.183&amp;clientType=13&amp;zs=43&amp;id=9229324192465</BaseURL><SegmentBase indexRange="457-15115" indexRangeExact="true"><Initialization range="0-456"/></SegmentBase></Representation></AdaptationSet></Period></MPD>`)
    }

    private async parseXml(xml: string) {
        const mpd = await parseStringPromise(xml);
        const adaptationSets = mpd.MPD?.Period?.[0]?.AdaptationSet || [];

        let videoTask: Promise<void> | null = null;
        let audioTask: Promise<void> | null = null;

        for (const adaptationSet of adaptationSets) {
            const mimeType = adaptationSet.$?.mimeType || "unknown";
            console.log(`\n=== AdaptationSet (${mimeType}) ===`);

            const hasAudioConfig = !!adaptationSet.AudioChannelConfiguration?.length;

            const representations = adaptationSet.Representation || [];
            const foundQualities: Record<string, string> = {};
            const foundAudios: AudioData[] = [];

            for (const rep of representations) {
                const id = rep.$?.id;
                const bandwidth = parseInt(rep.$?.bandwidth || "0");
                const mimeType = (rep.$?.mimeType || "") as string;
                const width = rep.$?.width;
                const height = rep.$?.height;
                const quality = rep.$?.quality;
                const baseUrlNode = rep.BaseURL?.[0]?.trim() || "";

                const fullInitUrl = this.baseUrl + baseUrlNode;

                console.log(`\nRepresentation ${id}:`);
                console.log(`  Quality: ${quality}`);
                console.log(`  Resolution: ${width}x${height}`);
                console.log(`  Bandwidth: ${bandwidth}`);
                console.log(`  mimeType: ${mimeType}`);
                console.log(`  Full URL: ${fullInitUrl}`);

                if (quality && preferredQualities.includes(quality)) {
                    foundQualities[quality] = fullInitUrl;
                }

                if (hasAudioConfig && bandwidth > 0) {
                    foundAudios.push({ bandwidth, url: fullInitUrl });
                }
            }

            // Download video
            for (const q of preferredQualities) {
                if (foundQualities[q]) {
                    videoTask = this.download(foundQualities[q], ".mp4");
                    break;
                }
            }

            // Download audio
            if (foundAudios.length > 0) {
                foundAudios.sort((a, b) => b.bandwidth - a.bandwidth);
                audioTask = this.download(foundAudios[0].url, ".m4a");
            }
        }

        if (videoTask && audioTask) {
            await Promise.all([videoTask, audioTask]);
            this.mergeVideoAudio(
                this.outputPath + ".mp4",
                this.outputPath + ".m4a",
                this.outputPath + "_final.mp4"
            );
        } else {
            console.log("Nothing found to download.");
        }
    }

    private async download(url: string, ext: string) {
        console.log("Downloading", ext, url);

        const streamPipeline = promisify(pipeline);

        const res = await fetch(url, {
            headers: {
                Host: this.host,
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 OPR/124.0.0.0"
            }
        });

        if (!res.ok) throw new Error(`Failed to download ${url}: ${res.statusText}`);

        const filePath = this.outputPath + ext;
        let downloaded = 0;
        const total = Number(res.headers.get("content-length")) || 0;

        // Convert WHATWG ReadableStream to Node.js Readable
        const nodeStream = require('stream').Readable.from(res.body as any);

        await streamPipeline(nodeStream, createWriteStream(filePath));

        console.log("Download complete:", filePath);
    }

    private mergeVideoAudio(videoPath: string, audioPath: string, outputPath: string) {
        console.log("Merging video and audio:", videoPath, audioPath, "->", outputPath);

        const ffmpeg = spawn("ffmpeg", [
            "-i", videoPath,           // video input
            "-i", audioPath,           // audio input (if separate)
            "-c:v", "libx264",         // encode video with x264
            "-preset", "fast",         // encoding speed/quality tradeoff
            "-vf", "format=yuv420p",   // ensure YUV420p pixel format
            "-c:a", "aac",             // encode audio with AAC
            "-movflags", "+faststart", // optimize for web playback
            "-y",                      // overwrite output if exists
            outputPath                 // output file
        ]);

        ffmpeg.stderr.on("data", data => process.stdout.write(data.toString()));
        ffmpeg.on("close", code => {
            console.log("FFmpeg finished with code", code)

            unlink(videoPath, (err) => {
                if (err) {
                    console.error('Error deleting file  '+ basename(videoPath) +':', err);
                    return;
                }
                console.log('File ' + basename(videoPath) + ' deleted successfully!');
            });

            unlink(audioPath, (err) => {
                if (err) {
                    console.error('Error deleting file  '+ basename(audioPath) +':', err);
                    return;
                }
                console.log('File ' + basename(audioPath) + ' deleted successfully!');
            });
        });
    }
}
