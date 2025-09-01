// Shared Traveler's DNA questions used by onboarding and chat personalization
export const DNA_QUESTIONS = [
  {
    key: 'pace',
    title: "What's your ideal trip pace?",
    options: ['Relaxed', 'Balanced', 'Fast-Paced'],
  },
  {
    key: 'budget',
    title: 'What is your typical budget preference?',
    options: ['Saver', 'Economical', 'Premium', 'Luxury'],
  },
  {
    key: 'interests',
    title: 'What kind of activities interest you most? (Select up to 3)',
    options: ['History & Culture', 'Nature & Outdoors', 'Food & Culinary', 'Adventure & Sports', 'Art & Museums', 'Shopping & Nightlife'],
    isMultiSelect: true,
    maxSelections: 3,
  },
  {
    key: 'accommodation',
    title: 'Where do you prefer to stay?',
    options: ['Hotels', 'Boutique Hotels', 'Resorts', 'Hostels', 'Vacation Rentals (Airbnb)'],
  },
];
