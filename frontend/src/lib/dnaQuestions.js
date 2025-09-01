// Shared Traveler's DNA questions used by onboarding and chat personalization
export const DNA_QUESTIONS = [
  {
    key: 'pace',
    title: "What's your ideal trip pace?",
    options: ['Relaxed', 'Balanced', 'Action-Packed'],
  },
  {
    key: 'budget',
    title: 'What is your typical budget preference?',
    options: ['Budget-Friendly', 'Mid-Range', 'Luxury'],
  },
  {
    key: 'interests',
    title: 'What kind of activities interest you most? (Select up to 3)',
    options: [
      'History & Museums',
      'Food & Local Cuisine',
      'Adventure & Outdoors',
      'Art & Culture',
      'Nightlife & Entertainment',
      'Shopping',
      'Relaxation & Wellness',
    ],
    isMultiSelect: true,
    maxSelections: 3,
  },
  {
    key: 'travelStyle',
    title: 'What is your preferred travel style?',
    options: ['Must-see Landmarks', 'Off-the-beaten-path', 'Mix of both'],
  },
  {
    key: 'accommodation',
    title: 'Where do you prefer to stay?',
    options: ['Hotels', 'Boutique Hotels', 'Resorts', 'Hostels', 'Vacation Rentals (Airbnb)'],
  },
];
