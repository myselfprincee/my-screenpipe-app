import { pipe } from "@screenpipe/js";
import { NextResponse } from "next/server";
import { ollama } from 'ollama-ai-provider';
import { generateText } from 'ai';

export async function GET() {
    try {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        let allResults = [];

        // Try to fetch WhatsApp Web data
        try {
            const webResults = await pipe.queryScreenpipe({
                startTime: oneDayAgo,
                contentType: "ocr",
                appName: "chrome",
                // browserUrl : "https://web.whatsapp.com",
                limit: 1,
            });

            if (webResults && webResults.data) {
                allResults.push(...webResults.data);
            }
        } catch (webError) {
            console.warn("Could not fetch WhatsApp Web data:", webError);
        }

        // Try to fetch standalone WhatsApp app data
        try {
            const appResults = await pipe.queryScreenpipe({
                startTime: oneDayAgo,
                contentType: "ocr",
                appName: "WhatsApp",
                limit: 50,
            });

            if (appResults && appResults.data) {
                allResults.push(...appResults.data);
            }
        } catch (appError) {
            console.warn("Could not fetch WhatsApp app data:", appError);
        }

        console.log("these are the results", allResults);

        if (allResults.length === 0) {
            return NextResponse.json({ message: "No WhatsApp OCR data found." }, { status: 404 });
        }

        // Process each OCR result individually
        const analyzeResults = await Promise.all(allResults.map(async (ocrResult) => {
            try {
                const { text } = await generateText({
                    model: ollama('mistral'),
                    system: "You are a helpful assistant that analyzes WhatsApp messages.",
                    prompt: `Is the following WhatsApp message spam or promotional? Analyze and respond with the person name or contact details whichever is available to you.
                    Get Frame X web.whatsapp.com B deepseek- X -o Chats Example Groups mistral x Sunday M Mistral Al x Fine-tune x 9 New Tab WhatsApp x Status O O AMRITA Search Unread Favourites My Airtel (You) V/ For more help (including examples) see https://learn.micros... +91 82915 84319 Okay +91 63863 41432 V/ Don't know bro PhonePe +91 88249 52592 Reacted to: "you're welcome bro" BCA Students Group V/ You: mee too Saturday Saturday Saturday Saturday Saturday 0.0 Download WhatsApp for Windows Make calls, share your screen and get a faster experience when you download the Windows app. Download a Your personal messages are end-to-end encrypted

                    here PhonePe is promotional so return phonepe. right return nothing else.
                    
                    \n\n${JSON.stringify(ocrResult)}`,
                    maxRetries: 2
                });
                console.log(`Analysis for message: ${JSON.stringify(ocrResult).substring(0, 50)}... - Result: ${text}`);

                return {
                    original: ocrResult,
                    analysis: text.trim()
                };
            } catch (error) {
                console.error("Error analyzing message:", error);
                return {
                    original: ocrResult,
                    analysis: "ERROR_ANALYZING",
                    error: error instanceof Error ? error.message : "Unknown error"
                };
            }
        }));
        console.log(allResults)
        return NextResponse.json({ data: analyzeResults }, { status: 200 });
    } catch (error: unknown) {
        console.error("Error fetching OCR data:", error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ message: "Internal server error", error: errorMessage }, { status: 500 });
    }
}
