import Groq from 'groq-sdk';

export const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function callGroqAgent(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured on the server');
  }

  const chat = await groq.chat.completions.create({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    model: process.env.GROQ_MODEL ?? 'llama3-8b-8192',
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });

  return chat.choices[0].message.content ?? '{}';
}
export default groq;
