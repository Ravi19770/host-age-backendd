const client = require("../config/openai");
const systemPrompt = require("../utils.js/systempromtp");


console.log("OpenAI Key Loaded:", !!process.env.OPENAI_API_KEY);


class AIService {

    async chat(message) {

        const completion = await client.chat.completions.create({

            model: process.env.OPENAI_MODEL,

            messages: [

                {
                    role: "system",
                    content: systemPrompt,
                },

                {
                    role: "user",
                    content: message,
                },

            ],

        });

        return completion.choices[0].message.content;

    }

}

module.exports = new AIService();