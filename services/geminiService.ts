import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const getGameFeedback = async (score: number): Promise<string> => {
  try {
    if (!apiKey) {
      return "API Key missing. I can't judge you properly.";
    }

    const modelId = 'gemini-2.5-flash';
    
    const prompt = `
      I just finished a game of Flappy Bird. My score was ${score}.
      
      If the score is 0-5: Roast me hard. Be sarcastic.
      If the score is 6-20: Give me a backhanded compliment.
      If the score is 21+: Praise me, but warn me about addiction.
      
      Keep it under 20 words. Be funny.
    `;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
    });

    return response.text || "No comment.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "I'm speechless (API Error).";
  }
};