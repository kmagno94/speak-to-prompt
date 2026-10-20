/* Practice notes for First time? Start here. Each is the kind of messy thing a
   real person would type or say, with the question the app might ask and the
   kind of prompt it turns into, so the walkthrough tells one story start to
   finish. tags: why messy is fine, pointed out on the note. */
export const EXAMPLES = [
  {
    note: "ok so my mom's birthday is saturday, like 6 people, she hates spicy food, budget maybe $80, help me plan dinner at home lol",
    tags: ['No punctuation needed', 'A budget, said in passing', '"lol" is fine'],
    q: 'What kind of dinner?', chips: ['Cozy and simple', 'Fancy', 'Not sure'],
    prompt: 'You are a friendly home cooking planner. Plan a birthday dinner at home this Saturday for my mom and 6 guests. Nothing spicy. Keep the total around $80. Give me a menu, a shopping list with rough prices, and a simple cooking timeline.'
  },
  {
    note: "i have a job interview thursday for a cashier spot at target and i've never really done one before. what do i say when they ask tell me about yourself, i get nervous and ramble",
    tags: ['Lowercase is fine', 'Just say what worries you', 'No need to be polished'],
    q: 'How do you want to practice?', chips: ['Sample answers', 'Mock interview', 'Both'],
    prompt: 'Act as a friendly interview coach. I have my first job interview on Thursday for a cashier role at Target, and I ramble when I am nervous. Help me write a short, natural answer to "Tell me about yourself," then run a quick mock interview with 5 common questions and feedback after each.'
  },
  {
    note: "my landlord hasnt fixed the heat in like 2 weeks and its getting cold. i want to text him but not sound rude, hes a nice guy just slow",
    tags: ['Typos are fine', 'Feelings count as details', 'Half a thought is enough'],
    q: 'How firm should it sound?', chips: ['Friendly nudge', 'Polite but firm', 'Not sure'],
    prompt: 'Help me write a short, polite text to my landlord. The heat has not worked for about 2 weeks and it is getting cold. He is a nice person but slow to respond. Keep it friendly but clear that I need it fixed soon, and ask when someone can come. Give me 2 versions.'
  },
  {
    note: "trying to save like $500 by december for christmas gifts, i make about $400 a week but i always end up spending on takeout. help me make a plan thats not super strict",
    tags: ['Numbers in passing', 'Be honest about habits', 'Say what you DON\'T want'],
    q: 'How many paychecks until December?', chips: ['About 6', 'About 8', 'Not sure'],
    prompt: 'Act as a realistic budgeting coach. I want to save $500 by December for holiday gifts. I earn about $400 a week and tend to overspend on takeout. Make a simple weekly savings plan that is not too strict, with easy swaps for takeout and a way to track progress.'
  },
  {
    note: "my dog keeps pulling on the leash and walks are miserable now. shes a 2 year old lab mix, super friendly, i only have like 15 min a day to practice",
    tags: ['Say who it\'s for', 'Time limits help', 'Talk like you talk'],
    q: 'What does she pull toward most?', chips: ['Other dogs', 'Smells', 'Everything'],
    prompt: 'Act as a positive-reinforcement dog trainer. My friendly 2-year-old Lab mix pulls on the leash and makes walks stressful. I have about 15 minutes a day to practice. Give me a simple 2-week loose-leash plan with daily exercises, what gear helps, and what to do when she pulls.'
  },
  {
    note: "need to email my professor for an extension, paper is due friday and i was sick most of this week. dont want it to sound like an excuse",
    tags: ['Short is fine', 'Say the worry', 'No greeting needed'],
    q: 'How much extra time do you need?', chips: ['2 days', '1 week', 'Not sure'],
    prompt: 'Help me write a short, respectful email to my professor asking for an extension on a paper due Friday. I was sick for most of this week. Keep it honest and professional without sounding like an excuse, and suggest a new due date.'
  },
  {
    note: "i want to start running but i always get bored and quit after like a week. i can do mornings before work, maybe 3 days a week",
    tags: ['Admit what goes wrong', '"maybe" is fine', 'Rough schedules count'],
    q: 'Where are you starting from?', chips: ['Never run', 'Ran before', 'Can run 1 mile'],
    prompt: 'Act as an encouraging beginner running coach. I want to start running but usually get bored and quit after a week. I can run 3 mornings a week before work. Give me a fun 6-week beginner plan with ways to stay motivated and keep it from getting boring.'
  },
  {
    note: "planning a weekend trip to philly with 3 friends, budget maybe $150 each, we like food and cheap fun stuff, leaving saturday morning back sunday night",
    tags: ['Lists can be messy', 'Budgets can be rough', 'Dates in plain words'],
    q: 'Where are you staying?', chips: ['Already booked', 'Need a cheap spot', 'Day trips only'],
    prompt: 'Act as a budget travel planner. Plan a weekend in Philadelphia for 4 friends, Saturday morning to Sunday night, about $150 per person. We love food and cheap fun things to do. Give me an hour-by-hour plan, where to eat, and a rough cost breakdown.'
  }
];

export function pick(not) {
  const pool = EXAMPLES.filter((e) => e !== not);
  return pool[Math.floor(Math.random() * pool.length)];
}
