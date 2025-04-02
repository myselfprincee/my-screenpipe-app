import puppeteer from "puppeteer";
import { Mistral } from '@mistralai/mistralai';
import { NextResponse } from "next/server";

//we can also use locally fine tunes models for better results but my computer wasn't really working great so i chose to let it not get overwhelmed by models heavyness, so i used my own mistral's fine tuned model.


const apiKey = process.env.MISTRAL_API_KEY;
const client = new Mistral({ apiKey: apiKey });

export async function GET() {
    try {
        console.log("🟢 Launching Puppeteer...");

        // Open WhatsApp Web
        const browser = await puppeteer.connect({
            browserURL: "http://localhost:9222", // Debugging port of ScreenPipe Chrome
            defaultViewport: null,
        });

        const page = await browser.newPage();
        await page.goto("https://web.whatsapp.com");
        const debugConsole = async (message: string) => {
            console.log(message);
        };

        await debugConsole("🔍 Opening WhatsApp Web...");

        const isWhatsAppLoaded = async () => {
            return await page.evaluate(() => {
                return document.querySelector("div[aria-label='Chat list']") !== null;
            });
        };

        const alreadyLoaded = await isWhatsAppLoaded();
        if (alreadyLoaded) {
            console.log("✅ WhatsApp Web was already loaded");
        }
        await page.waitForSelector("div[aria-label='Chat list']", { timeout: 60000 });
        console.log("✅ WhatsApp Web loaded successfully");

        interface Contact {
            name: string;
            msg: string;
            time: string;
        }
        let allExtractedContacts: Contact[] = [];
        let hasMoreToScroll = true;

        const extractVisibleChats = async () => {
            return await page.evaluate(() => {
                const contacts = [];
                const chatItems = Array.from(document.querySelectorAll('[aria-label="Chat list"] > div'));

                for (const item of chatItems) {
                    const nameElement = item.querySelector('._ak8q');
                    const messageElement = item.querySelector('._ak8j');
                    const timeElement = item.querySelector('._ak8i');

                    if (nameElement) {
                        const msg = messageElement ? messageElement.textContent?.trim() || '' : '';
                        const filteredMsg = msg.replace(/status-[a-z]+/g, '').trim();

                        contacts.push({
                            name: nameElement.textContent?.trim() || '',
                            msg: filteredMsg,
                            time: timeElement ? timeElement.textContent?.trim() || '' : '',
                        });
                    }
                }
                return contacts;
            });
        };

        const scrollChatList = async () => {
            return await page.evaluate(() => {
                const scroller = document.querySelector("#pane-side");
                if (!scroller) return { hasMore: false, didScroll: false, scrollStats: {} };

                const previousScrollTop = scroller.scrollTop;
                const previousScrollHeight = scroller.scrollHeight;

                const remainingScroll = scroller.scrollHeight - (scroller.scrollTop + scroller.clientHeight);

                if (remainingScroll > 0 && remainingScroll < scroller.clientHeight) {
                    scroller.scrollTop = scroller.scrollHeight - scroller.clientHeight;
                } else {
                    scroller.scrollTop += scroller.clientHeight * 0.75;
                }

                return {
                    hasMore: scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight,
                    didScroll: previousScrollTop !== scroller.scrollTop,
                    scrollStats: {
                        scrollTop: scroller.scrollTop,
                        scrollHeight: scroller.scrollHeight,
                        clientHeight: scroller.clientHeight,
                        remainingScroll: remainingScroll
                    }
                };
            });
        };

        while (hasMoreToScroll) {
            const visibleContacts = await extractVisibleChats();
            console.log(`📝 Found ${visibleContacts.length} visible chats`);

            for (const contact of visibleContacts) {
                if (!allExtractedContacts.some(c => c.name === contact.name)) {
                    allExtractedContacts.push(contact);
                }
            }

            const scrollResult = await scrollChatList();
            console.log(`🔄 Scroll status:`, scrollResult.scrollStats);

            if (!scrollResult.didScroll || !scrollResult.hasMore) {
                console.log("🏁 Reached end of chat list or can't scroll further");
                hasMoreToScroll = false;
            } else {
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
        }

        console.log(`✅ Total extracted contacts: ${allExtractedContacts.length}`);
        console.log(allExtractedContacts)

        const chatResponse = await client.chat.complete({
            model: 'ft:open-mistral-7b:f72b00e6:20250401:bf0e1d92',
            messages: [{
                role: 'user', content: `You are a helpful assistant trained to classify messages as genuine, promotional, spam, or unknown. you have to only return name : what you classified,  answer from one of the options after analyzing it. it is a strict order that you have to follow. 

if user giving you multiple messages at once just return the answers in this format Amit : genuine, 
Flipkart : promotional,
Jio: promotional,
+91 97634556662: spam

and you have to replace the name and classification. here is your data : ${JSON.stringify(allExtractedContacts)} when the message content is in hinglish there is a higher chance that message would be genuine. or something like image or photo written on it.`
            }],
        });

        console.log(chatResponse.choices[0].message.content);
        const llmDataArrConversion = chatResponse.choices[0].message.content
            .split(/[,\n]/)
            .map(item => item.trim())
            .filter(item => item.length > 0);
        console.log(llmDataArrConversion);

        console.log("✅ Completed spam analysis");

        const classificationResults = llmDataArrConversion.map(item => {
            const parts = item.split(':');
            if (parts.length >= 2) {
                const name = parts[0].trim();
                const category = parts[1].trim();
                const contactData = allExtractedContacts.find(c => c.name === name);
                return {
                    name,
                    category,
                    message: contactData?.msg || '',
                    time: contactData?.time || ''
                };
            }
            return null;
        }).filter(Boolean);

        return NextResponse.json({
            classifications: classificationResults,
            originalData: allExtractedContacts
        });

    } catch (error) {
        console.error("❌ Puppeteer Scraping Error:", error);
        return NextResponse.json({ error: "Failed to scrape messages" }, { status: 500 });
    }
}
