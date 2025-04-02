import puppeteer from "puppeteer";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        console.log(body);
        let names = [];

        if (body.name) {
            names = [body.name];
        } else if (body.names && Array.isArray(body.names)) {
            names = body.names;
        } else if (Array.isArray(body)) {
            names = body;
        } else {
            return NextResponse.json({ message: "Invalid request format. Expected 'name' or 'names' array" }, { status: 400 });
        }

        console.log("Processing names:", names);

        const browser = await puppeteer.connect({
            browserURL: "http://localhost:9222",
            defaultViewport: null,
        });

        const page = await browser.newPage();
        await page.goto("https://web.whatsapp.com");

        const results = [];

        for (const name of names) {
            try {
                console.log(`Processing: ${name}`);

                await page.reload();
                await page.waitForSelector(`*::-p-text(${name})`, { timeout: 50000 });

                const element = await page.$(`*::-p-text(${name})`);
                if (element) {
                    console.log(`Element found for ${name}!`);
                    await element.click();

                    await page.waitForSelector('.x1n2onr6 .x17adc0v', { timeout: 50000 });
                    const tripleDots = await page.$$('.x1n2onr6 .x17adc0v');

                    if (tripleDots.length > 0) {
                        await tripleDots[tripleDots.length - 1].click();

                        await page.waitForSelector('div[aria-label="Delete chat"]', { timeout: 30000 });
                        await page.click('div[aria-label="Delete chat"]');

                        await page.waitForSelector('div[aria-label="Delete this chat?"]', { timeout: 30000 });

                        await page.evaluate(() => {
                            const buttons = Array.from(document.querySelectorAll('button'));
                            const deleteButton = buttons.find(button => button.textContent.includes('Delete chat'));
                            if (deleteButton) deleteButton.click();
                        });

                        results.push({ name, status: "success", message: "Chat deleted successfully" });
                        console.log(`Deleted chat successfully for ${name}`);
                    } else {
                        results.push({ name, status: "error", message: "Triple dots menu not found" });
                        console.log(`Triple dots menu elements not found for ${name}`);
                    }
                } else {
                    results.push({ name, status: "error", message: "Chat not found" });
                    console.log(`Element not found for ${name}.`);
                }
            } catch (error) {
                results.push({ name, status: "error", message: error.message });
                console.error(`Error processing ${name}:`, error);
            }
        }

        return NextResponse.json({
            message: "Batch processing completed",
            results
        }, { status: 200 });

    } catch (error) {
        console.error("Error in batch processing:", error);
        return NextResponse.json({
            message: "Error processing request",
            error: error.message
        }, { status: 500 });
    }
}
