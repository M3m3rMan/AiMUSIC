export async function generateFollowUpQuestions(response, lastUserMessage) {
  try {
    const prompt = `As a music production assistant, generate 3-5 relevant follow-up questions based on:
    
    Last User Input: "${lastUserMessage}"
    Your Response: "${response}"
    
    Rules:
    1. Questions should naturally continue the conversation
    2. Make them specific to music production
    3. Include technical terms when appropriate
    4. Return ONLY a JSON array
    
    Example: ["How would this technique work with trap beats?", "What plugins would you recommend for this?"]`;
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      response_format: { type: "json_object" }
    });
    
    const content = JSON.parse(completion.choices[0].message.content);
    return content.questions || getDefaultFollowUps();
    
  } catch (err) {
    console.error("Follow-up generation error:", err);
    return getDefaultFollowUps();
  }
}

function getDefaultFollowUps() {
  return [
    "Could you explain this in simpler terms?",
    "How would this apply to [my genre]?",
    "What's the first step to implement this?",
  ];
}