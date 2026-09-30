// The Dealer's speech (STORY 11.2). Category sizes are exact: greet 4, hover 6, signed 5, refused 3, leaving 4, curse 3.
// Pure data (node-importable). DealerSpeech picks at random within a category and never repeats the previous line.

export const DEALER_LINES = {
  greet: [
    'Well, well. A debtor with initiative. Pull up a chair, friend.',
    'You found my little office. How thoughtful.',
    'Come in. The door was never locked. It was never a door.',
    'Ah, a customer. I do love a customer who is still breathing.',
  ],
  hover: [
    'Read it twice. I will not tell you what the second read says.',
    'Everything I offer is true. That is the problem.',
    'A little of yours, a lot of mine.',
    'Take your time. I have all of it.',
    'The terms are simple. The consequences are elegant.',
    'Sign, and I will owe you. I do so like owing.',
  ],
  signed: [
    'Wonderful. Signed and witnessed.',
    'A pleasure. I honour every word. Especially the small ones.',
    'Hm. Hm! That felt like a real smile.',
    'There. Now we are partners. Of a sort.',
    'Keep the pen. No, I insist. It remembers you.',
  ],
  refused: [
    'No? Of course. The offer stands. It always stands.',
    'Pride. Delicious. Please, keep it.',
    'You will be back. Everyone is back.',
  ],
  leaving: [
    'Mind the way out. It is much longer than the way in.',
    'Give my regards to the Marshal. He has never once written.',
    'Until we meet again. Which is soon.',
    'Go on, then. I shall be here. I am always here.',
  ],
  curse: [
    'A little something to remember me by.',
    'Free of charge. Well. Free of coin.',
    'It is only a curse. Everyone has one. You have merely upgraded.',
  ],
};

/** Rider greetings (replace `greet` 30 % of the time). */
export const DEALER_RIDER_GREET = {
  gunslinger: 'Eli. The deputy. Still on my books, friend.',
  preacher: 'Reverend. I did so enjoy the Amen.',
  hunter: 'Mr. Rook! Business or pleasure? I only ask because you are armed.',
  queen: 'Maude! Do not bother shuffling. I have already counted.',
};

/** Situational extras (each is offered as a `greet` replacement when its condition holds; see DealerSpeech.pickGreet). */
export const DEALER_EXTRA = {
  refusedThrice: [
    'Three times. I am beginning to take it personally.',
    'You have said no more than anyone in county history. Impressive. Irritating.',
  ],
  gunslingerLate: 'Your missus asks after you, deputy. She is quite well. Comparatively.', // gunslinger, floors 4-5
  cleanHell: 'Not one signature. Not one. I have a page for you regardless.', // clean Hell run, floor 5
};

export const DEALER_CATEGORIES = Object.keys(DEALER_LINES);
