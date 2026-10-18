/* "Not sure where to start?" content. Each category asks a couple of quick
   questions with tap-to-pick answers; every one also takes a typed answer.
   "say" is how the answer is written into the starting text. */
const WIN = {
  q: 'What would make the answer great?', say: 'What would make the answer great',
  choices: ['Quick and simple', 'Step by step', 'Lots of options', 'Budget friendly', 'Explained like I\'m new']
};

export const EXTRA = { q: 'Anything else I should know? Type it, or tap That\'s it.', say: 'Also', choices: ['That\'s it'], end: true };

export const CATEGORIES = [
  { id: 'general', emoji: '✨', label: 'Not sure yet', phrase: 'something, but I\'m not sure where to start', questions: [
    { q: 'What kind of help would be useful?', say: 'What I want', choices: ['Brainstorm ideas', 'Make a plan', 'Make a decision', 'Write something', 'Understand something', 'Fix a problem'] },
    { q: 'What\'s it about? A few words is plenty.', say: 'What it\'s about', choices: ['Work', 'School', 'Money', 'Health', 'Home', 'A hobby'] },
    WIN ] },
  { id: 'work', emoji: '\u{1F4BC}', label: 'Work and career', phrase: 'work and my career', questions: [
    { q: 'What do you want to get done?', say: 'What I want', choices: ['Ask for a raise', 'Prep for an interview', 'Fix my resume', 'Handle a coworker issue', 'Get organized at work', 'Plan my next move'] },
    { q: 'Where are you right now?', say: 'Where I am', choices: ['New job', 'Current job', 'Job hunting', 'Side hustle'] },
    WIN ] },
  { id: 'school', emoji: '\u{1F393}', label: 'School and studying', phrase: 'school and studying', questions: [
    { q: 'What do you need help with?', say: 'What I want', choices: ['Study for a test', 'Understand a topic', 'Write a paper', 'Make a study plan', 'Stay motivated'] },
    { q: 'Which class or topic?', say: 'Class or topic', choices: ['Math', 'Science', 'Writing', 'IT and cybersecurity', 'History'] },
    WIN ] },
  { id: 'money', emoji: '\u{1F4B8}', label: 'Money and budgeting', phrase: 'money and budgeting', questions: [
    { q: 'What\'s the goal?', say: 'My goal', choices: ['Build a budget', 'Save for something', 'Pay off debt', 'Cut spending', 'Start investing'] },
    { q: 'What makes it hard?', say: 'What makes it hard', choices: ['Impulse buys', 'Takeout', 'Pay that changes', 'Subscriptions', 'Not sure where it goes'] },
    WIN ] },
  { id: 'health', emoji: '\u{1F4AA}', label: 'Health and fitness', phrase: 'my health and fitness', questions: [
    { q: 'What do you want to work on?', say: 'My goal', choices: ['Start working out', 'Eat better', 'Sleep better', 'Build a habit', 'Lower stress'] },
    { q: 'What gets in the way?', say: 'What gets in the way', choices: ['No time', 'No motivation', 'Not sure where to start', 'An injury'] },
    WIN ] },
  { id: 'home', emoji: '\u{1F3E0}', label: 'Home and life admin', phrase: 'home and life admin', questions: [
    { q: 'What needs handling?', say: 'What I want', choices: ['Clean and declutter', 'Split up chores', 'Get organized', 'A bill or appointment', 'Plan a move'] },
    { q: 'How much time can you give it?', say: 'Time I have', choices: ['10 minutes a day', 'An hour a week', 'A weekend'] },
    WIN ] },
  { id: 'food', emoji: '\u{1F373}', label: 'Food and cooking', phrase: 'food and cooking', questions: [
    { q: 'What do you want to do?', say: 'What I want', choices: ['Plan meals for the week', 'Cook with what I have', 'Eat well on a budget', 'Meal prep', 'Learn a recipe'] },
    { q: 'Anything to work around?', say: 'Limits', choices: ['Quick meals only', 'Cooking for one', 'Feeding a family', 'Vegetarian', 'Allergies'] },
    WIN ] },
  { id: 'writing', emoji: '✉️', label: 'Writing and messages', phrase: 'writing something', questions: [
    { q: 'What are you writing?', say: 'What I\'m writing', choices: ['Reply to an email', 'A tough message', 'A social post', 'A cover letter', 'Polish my writing'] },
    { q: 'Who\'s it for?', say: 'Who it\'s for', choices: ['My boss', 'A friend', 'A customer', 'A teacher', 'Everyone online'] },
    { q: 'What tone?', say: 'Tone', choices: ['Friendly', 'Professional', 'Direct', 'Funny'] } ] },
  { id: 'plans', emoji: '\u{1F5FA}️', label: 'Plans and trips', phrase: 'planning something', questions: [
    { q: 'What are you planning?', say: 'What I\'m planning', choices: ['A trip', 'An event', 'My week', 'A project'] },
    { q: 'When is it?', say: 'When', choices: ['This week', 'This month', 'In a few months'] },
    WIN ] },
  { id: 'tech', emoji: '\u{1F4F1}', label: 'Tech and devices', phrase: 'tech and my devices', questions: [
    { q: 'What do you need?', say: 'What I want', choices: ['Set up a Shortcut', 'Fix a problem', 'Learn an app', 'Pick something to buy', 'Secure my accounts'] },
    { q: 'Which devices?', say: 'Devices', choices: ['iPhone', 'iPad', 'Mac', 'Windows PC', 'Android'] },
    WIN ] },
  { id: 'creative', emoji: '\u{1F3A8}', label: 'Creative and ideas', phrase: 'a creative idea', questions: [
    { q: 'What are you working on?', say: 'What I want', choices: ['Name something', 'Content ideas', 'Start a project', 'Get unstuck', 'A gift idea'] },
    { q: 'Who\'s it for?', say: 'Who it\'s for', choices: ['Me', 'My business', 'A friend', 'School'] },
    WIN ] }
];
