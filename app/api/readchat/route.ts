import puppeteer from "puppeteer";
import { Mistral } from '@mistralai/mistralai';
import { NextResponse } from "next/server";

const apiKey = process.env.MISTRAL_API_KEY;
if (!apiKey) {
    throw new Error("❌ MISTRAL_API_KEY is missing in environment variables.");
}

const client = new Mistral({ apiKey });

export async function GET(request: Request) {
    let browser;

    try {
        // Get the name from the URL query parameters
        const { searchParams } = new URL(request.url);
        const contactName = searchParams.get('person');

        if (!contactName) {
            return NextResponse.json({ error: "Contact name is required" }, { status: 400 });
        }

        console.log(`🔍 Looking for chat with: ${contactName}`);

        // Connect to browser
        console.log("🟢 Launching Puppeteer...");
        browser = await puppeteer.connect({
            browserURL: "http://localhost:9222",
            defaultViewport: null,
        });

        const page = await browser.newPage();
        await page.goto("https://web.whatsapp.com");

        // Wait for WhatsApp Web to load
        await page.waitForSelector("div[aria-label='Chat list']", { timeout: 60000 });
        console.log("✅ WhatsApp Web loaded successfully");

        // Search for the contact
        console.log(`🔍 Searching for ${contactName}...`);
        await page.waitForSelector('div[aria-label="Search input textbox"]');
        await page.click('div[aria-label="Search input textbox"]');
        await page.type('div[aria-label="Search input textbox"]', contactName, { delay: 100 });

        // Wait until the contact appears
        await page.waitForFunction(
            name => !!document.querySelector(`span[title="${name}"]`),
            {},
            contactName
        );

        // Click on the contact
        const contactElement = await page.$(`span[title="${contactName}"]`);
        if (!contactElement) throw new Error(`❌ Contact "${contactName}" not found.`);

        await contactElement.click();
        console.log(`✅ Clicked on ${contactName}`);

        const messages = await page.$$('.copyable-text');

        console.log("✅ Extracted Messages:", messages);




        const chatResponse = await client.chat.complete({
            model: 'ft:open-mistral-7b:f72b00e6:20250401:bf0e1d92',
            messages: [{
                role: 'user',
                content: `Summarize this conversation between me and ${contactName}. Focus on key topics, decisions made, and action items:

${messages}`
            }],
        });

        const summary = chatResponse.choices?.[0]?.message?.content || "No summary available.";

        return NextResponse.json({
            contact: contactName,
            messageCount: messages.length,
            summary,
            messages
        });

    } catch (error: unknown) {
        console.error("❌ Error:", error);
        const errorMessage = error instanceof Error ? error.message : "Failed to process request";
        return NextResponse.json({ error: errorMessage }, { status: 500 });

        // if (browser) {
        // Just close the page instead of the entire browser
        // Commented out to avoid unused variable warning
        // const pages = await browser.pages();
        // for (const page of pages) {
        //     const url = page.url();
        //     if (url.includes("web.whatsapp.com")) {
        //         await page.close();
        //     }
        // }
        // }
    }
}
