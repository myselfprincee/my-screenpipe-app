import { NextResponse } from 'next/server';
import { setupBrowser, getActiveBrowser } from '@/lib/brower-setup';
import { RouteLogger } from '@/lib/route-logger';

const logger = new RouteLogger('chrome-check-login');

export async function POST(request: Request) {
    try {
        await request.json(); // keep reading the request to avoid hanging
        logger.log('checking linkedin login status');

        logger.log('setting up browser...');
        await setupBrowser();
        const { page } = getActiveBrowser();

        if (!page) {
            logger.log('no active browser session found');
            throw new Error('no active browser session');
        }

        logger.log('evaluating login state...');
        // Check for elements that indicate logged-in state
        const isLoggedIn = await page.evaluate(() => {
            // Check for feed-specific elements that only appear when logged in
            const feedElements = document.querySelectorAll('._aigw .x9f619 .x1n2onr6 .x5yr21d .x17dzmu4 .x1i1dayz .x2ipvbc .x1w8yi2h .x78zum5 .xdt5ytf .xa1v5g2 .x1plvlek .xryxfnj .xd32934 .x1m6msm')
            const navElements = document.querySelectorAll('.x78zum5 .x1okw0bk .x6s0dn4 .xh8yej3 .x14wi4xw .xexx8yu .x4uap5 .x18d9i69 .xkhd6sd')

            // Return true if we find elements specific to logged-in state
            return !!(feedElements || navElements)
        });

        logger.log(`login status: ${isLoggedIn ? 'logged in' : 'logged out'}`);

        return NextResponse.json({
            success: true,
            isLoggedIn: Boolean(isLoggedIn),
            logs: logger.getLogs()
        });

    } catch (error) {
        logger.error(`failed to check login status: ${error}`);
        return NextResponse.json(
            { success: false, error: String(error), logs: logger.getLogs() },
            { status: 500 }
        );
    }
}
