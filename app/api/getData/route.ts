import { NextApiRequest, NextApiResponse } from "next";
import { pipe } from "@screenpipe/js";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const results = await pipe.queryScreenpipe({
            startTime: fiveMinutesAgo,
            limit: 10,
            contentType: "all", // or "ocr", "audio"
        });

        if (!results) {
            return res.status(404).json({ message: "No results found or an error occurred" });
        }

        const formattedResults = results.data.map((item: any) => {
            if (item.type === "OCR") {
                return { type: "OCR", content: item.content };
            } else if (item.type === "Audio") {
                return { type: "Audio", content: item.content };
            }
            return null;
        }).filter(Boolean);

        res.status(200).json({
            total: results.pagination.total,
            items: formattedResults,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
}