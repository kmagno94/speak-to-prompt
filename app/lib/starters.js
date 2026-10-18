/* "Not sure where to start?" content. Each category asks a couple of quick
   questions with tap-to-pick answers; every one also takes a typed answer.
   Answer lists are pools: 5 show at a time and the 5 rotate every 3 hours
   (see rotate.js). Categories never rotate, so they're always where you left them.
   "say" is how the answer is written into the starting text. */

export const EXTRA = { q: 'Anything else I should know? Type it, or tap That\'s it.', say: 'Also', choices: ['That\'s it'], end: true };

export const CATEGORIES = [
  { id: 'general', emoji: '✨', label: 'Not sure yet', phrase: 'something, but I\'m not sure where to start', questions: [
    { q: 'What kind of help would be useful?', say: 'What I want', choices: ['Brainstorm ideas', 'Make a plan', 'Make a decision', 'Write something', 'Understand something', 'Fix a problem', 'Compare options', 'Learn a skill', 'Organize my thoughts', 'Get feedback on something'] },
    { q: 'What\'s it about? A few words is plenty.', say: 'What it\'s about', choices: ['Work', 'School', 'Money', 'Health', 'Home', 'A hobby', 'Family', 'Friends', 'A side project', 'Travel'] } ] },
  { id: 'work', emoji: '\u{1F4BC}', label: 'Work and career', phrase: 'work and my career', questions: [
    { q: 'What do you want to get done?', say: 'What I want', choices: ['Ask for a raise', 'Prep for an interview', 'Fix my resume', 'Handle a coworker issue', 'Get organized at work', 'Plan my next move', 'Write a LinkedIn post', 'Negotiate an offer', 'Ask for feedback', 'Run a better meeting'] },
    { q: 'Where are you right now?', say: 'Where I am', choices: ['New job', 'Current job', 'Job hunting', 'Side hustle', 'Changing careers', 'Just got promoted', 'Part time', 'Freelance'] } ] },
  { id: 'school', emoji: '\u{1F393}', label: 'School and studying', phrase: 'school and studying', questions: [
    { q: 'What do you need help with?', say: 'What I want', choices: ['Study for a test', 'Understand a topic', 'Write a paper', 'Make a study plan', 'Stay motivated', 'Take better notes', 'Memorize facts', 'Prep a presentation', 'Catch up after falling behind', 'Pick a class or path'] },
    { q: 'Which class or topic?', say: 'Class or topic', choices: ['Math', 'Science', 'Writing', 'IT and cybersecurity', 'History', 'Data and statistics', 'Languages', 'Business', 'Programming', 'Networking'] } ] },
  { id: 'money', emoji: '\u{1F4B8}', label: 'Money and budgeting', phrase: 'money and budgeting', questions: [
    { q: 'What\'s the goal?', say: 'My goal', choices: ['Build a budget', 'Save for something', 'Pay off debt', 'Cut spending', 'Start investing', 'Build an emergency fund', 'Plan a big purchase', 'Track where money goes', 'Earn extra income', 'Split bills fairly'] },
    { q: 'What makes it hard?', say: 'What makes it hard', choices: ['Impulse buys', 'Takeout', 'Pay that changes', 'Subscriptions', 'Not sure where it goes', 'Too many bills', 'Shopping sales', 'Going out with friends', 'No plan for payday', 'Surprise costs'] } ] },
  { id: 'health', emoji: '\u{1F4AA}', label: 'Health and fitness', phrase: 'my health and fitness', questions: [
    { q: 'What do you want to work on?', say: 'My goal', choices: ['Start working out', 'Eat better', 'Sleep better', 'Build a habit', 'Lower stress', 'Drink more water', 'Stretch more', 'Run my first 5K', 'Cut back on caffeine', 'Walk more'] },
    { q: 'What gets in the way?', say: 'What gets in the way', choices: ['No time', 'No motivation', 'Not sure where to start', 'An injury', 'My work schedule', 'Too tired', 'Get bored fast', 'Cost'] } ] },
  { id: 'home', emoji: '\u{1F3E0}', label: 'Home and life admin', phrase: 'home and life admin', questions: [
    { q: 'What needs handling?', say: 'What I want', choices: ['Clean and declutter', 'Split up chores', 'Get organized', 'A bill or appointment', 'Plan a move', 'Fix something', 'Organize my closet', 'Set up a routine', 'Plan a project', 'Make it cozier'] },
    { q: 'How much time can you give it?', say: 'Time I have', choices: ['10 minutes a day', 'An hour a week', 'A weekend'] } ] },
  { id: 'food', emoji: '\u{1F373}', label: 'Food and cooking', phrase: 'food and cooking', questions: [
    { q: 'What do you want to do?', say: 'What I want', choices: ['Plan meals for the week', 'Cook with what I have', 'Eat well on a budget', 'Meal prep', 'Learn a recipe', 'Healthier snacks', 'Cook faster', 'Pack lunches for work', 'Try a new cuisine', 'Bake something'] },
    { q: 'Anything to work around?', say: 'Limits', choices: ['Quick meals only', 'Cooking for one', 'Feeding a family', 'Vegetarian', 'Allergies', 'Small kitchen', 'No oven', 'High protein'] } ] },
  { id: 'writing', emoji: '✉️', label: 'Writing and messages', phrase: 'writing something', questions: [
    { q: 'What are you writing?', say: 'What I\'m writing', choices: ['Reply to an email', 'A tough message', 'A social post', 'A cover letter', 'Polish my writing', 'A thank you note', 'A speech or toast', 'A complaint', 'A bio about me', 'An apology'] },
    { q: 'Who\'s it for?', say: 'Who it\'s for', choices: ['My boss', 'A friend', 'A customer', 'A teacher', 'Everyone online', 'Family', 'A landlord', 'A hiring manager'] } ] },
  { id: 'plans', emoji: '\u{1F5FA}️', label: 'Plans and trips', phrase: 'planning something', questions: [
    { q: 'What are you planning?', say: 'What I\'m planning', choices: ['A trip', 'An event', 'My week', 'A project', 'A party', 'A move', 'A study schedule', 'A date night', 'My month', 'A goal'] },
    { q: 'When is it?', say: 'When', choices: ['Today', 'This week', 'Next weekend', 'This month', 'In a few months', 'This year'] } ] },
  { id: 'tech', emoji: '\u{1F4F1}', label: 'Tech and devices', phrase: 'tech and my devices', questions: [
    { q: 'What do you need?', say: 'What I want', choices: ['Set up a Shortcut', 'Fix a problem', 'Learn an app', 'Pick something to buy', 'Secure my accounts', 'Back up my stuff', 'Free up storage', 'Automate a chore', 'Set up a new device', 'Speed things up'] },
    { q: 'Which devices?', say: 'Devices', choices: ['iPhone', 'iPad', 'Mac', 'Windows PC', 'Android', 'Apple Watch', 'Smart home'] } ] },
  { id: 'creative', emoji: '\u{1F3A8}', label: 'Creative and ideas', phrase: 'a creative idea', questions: [
    { q: 'What are you working on?', say: 'What I want', choices: ['Name something', 'Content ideas', 'Start a project', 'Get unstuck', 'A gift idea', 'Write a story', 'A logo idea', 'Plan a video', 'A playlist theme', 'Start a hobby'] },
    { q: 'Who\'s it for?', say: 'Who it\'s for', choices: ['Me', 'My business', 'A friend', 'School', 'Social media', 'My family'] } ] },
  /* DEVELOPMENT ONLY: prompts for improving Speak to Prompt itself, with the app's
     background built in. Remove before shipping, along with "Your core". */
  { id: 'app', emoji: '\u{1F6E0}\uFE0F', label: 'Improve this app', phrase: 'improving my Speak to Prompt web app', dev: true,
    context: [
      'About the app: Speak to Prompt turns messy typed or spoken thoughts into one ready-to-paste AI prompt. It is a Svelte 5 + Vite site on GitHub Pages (repo kmagno94/speak-to-prompt) that uses my own free Gemini key and saves nothing.',
      'How changes ship: the smoke tests in tests/smoke.mjs must pass, then GitHub Actions publishes it. Every change gets a Building Log row in Notion. No em dashes in anything user-facing.'
    ],
    ask: 'What I want back: the change and why it helps, the exact steps to build it, and how we will know it worked.',
    questions: [
      { q: 'What do you want to change?', say: 'Change', choices: ['Add a feature', 'Fix something broken', 'Change how it looks', 'Make it faster', 'Change the wording', 'Remove something'] },
      { q: 'Which part of the app?', say: 'Part of the app', choices: ['Idea strip', 'Not sure where to start', 'Follow-up questions', 'Your prompt and copy buttons', 'Quick and Normal modes', 'Talk it out and the shortcut', 'Your core', 'Run stats', 'The whole page'] }
    ] }
];

/* Fine-tune sliders on the starting point. 3 is the middle and adds nothing;
   each step either way adds a plain instruction to the starting text. */
export const SLIDERS = [
  { key: 'detail', label: 'Detail', low: 'Quick', high: 'In depth', say: 'Detail',
    steps: ['keep it very short', 'keep it fairly short', '', 'go into detail', 'go deep and cover everything'] },
  { key: 'tone', label: 'Tone', low: 'Casual', high: 'Formal', say: 'Tone',
    steps: ['very casual, like a friend', 'relaxed and friendly', '', 'polished', 'formal and professional'] },
  { key: 'level', label: 'My level', low: 'New to this', high: 'Know it well', say: 'My level',
    steps: ["I'm brand new to this, explain everything", "I'm fairly new, keep jargon light", '', 'I know the basics, skip the intro', 'I know this well, get technical'] },
  { key: 'creative', label: 'Ideas', low: 'Practical', high: 'Bold', say: 'Ideas',
    steps: ['stick to proven, practical options', 'mostly practical', '', 'include some creative ideas', 'go bold with unusual ideas'] }
];
