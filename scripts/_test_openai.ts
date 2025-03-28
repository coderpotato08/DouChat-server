import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: 'your deepseek api key'
});

async function main() {
  const stream = await openai.chat.completions.create(
    {
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "css如何使文字纵向排列" },
      ],
      stream: true,
      model: "deepseek-chat",
    });

  console.log(stream);
}

main();