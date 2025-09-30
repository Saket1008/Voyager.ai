// Shared Traveler's DNA questions used by onboarding and chat personalization
export const DNA_QUESTIONS = [
  // 11 curated, stable user preferences
  { key: 'pace', title: "What's your ideal trip pace?", options: ['Relaxed', 'Balanced', 'Action-Packed'] },
  { key: 'budget', title: 'What is your typical budget preference?', options: ['Budget-Friendly', 'Mid-Range', 'Luxury'] },
  { key: 'travelStyle', title: 'What is your preferred travel style?', options: ['Must-see Landmarks', 'Off-the-beaten-path', 'Mix of both'] },
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
      'Architecture & Design',
      'Photography Spots',
      'Local Festivals & Events',
    ],
    isMultiSelect: true,
    maxSelections: 3,
  },
  { key: 'accommodation', title: 'Where do you prefer to stay?', options: ['Hotels', 'Boutique Hotels', 'Resorts', 'Hostels', 'Vacation Rentals (Airbnb)'], isOptional: true },
  { key: 'roomType', title: 'Preferred room type?', options: ['Private Room', 'Suite', 'Shared (Hostel)'], isOptional: true },
  { key: 'foodPrefs', title: 'Any food preferences?', options: ['Vegetarian', 'Vegan', 'Pescatarian', 'Halal', 'Kosher', 'No preference'], isOptional: true, isMultiSelect: true, maxSelections: 3 },
  { key: 'dietaryRestrictions', title: 'Any dietary restrictions/allergies?', options: ['Gluten-free', 'Lactose-free', 'Nut allergy', 'Shellfish allergy', 'Other'], isOptional: true, isMultiSelect: true, maxSelections: 3 },
  { key: 'transportMode', title: 'Preferred local transport?', options: ['Public Transit', 'Rideshare/Taxi', 'Rental Car', 'Walking/Biking'], isOptional: true },
  { key: 'dailyStart', title: 'When do you like to start your day?', options: ['Early (6-8am)', 'Mid (9-11am)', 'Late (12pm+)'], isOptional: true },
  { key: 'nightlife', title: 'Nightlife preference?', options: ['None', 'Casual bars', 'Live music', 'Clubs'], isOptional: true },
];
