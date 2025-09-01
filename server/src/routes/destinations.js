import { Router } from 'express';

const router = Router();

// A lightweight list of popular destinations (can be expanded)
const CITIES = [
  'Amsterdam', 'Athens', 'Auckland', 'Bangkok', 'Barcelona', 'Beijing', 'Berlin', 'Bogotá', 'Boston', 'Brussels',
  'Budapest', 'Buenos Aires', 'Cairo', 'Cape Town', 'Casablanca', 'Chennai', 'Chicago', 'Copenhagen', 'Dallas', 'Delhi',
  'Doha', 'Dubai', 'Dublin', 'Edinburgh', 'Florence', 'Frankfurt', 'Geneva', 'Hanoi', 'Helsinki', 'Hong Kong',
  'Honolulu', 'Istanbul', 'Jakarta', 'Johannesburg', 'Kyoto', 'Kuala Lumpur', 'Lagos', 'Las Vegas', 'Lisbon', 'London',
  'Los Angeles', 'Lyon', 'Madrid', 'Manila', 'Melbourne', 'Mexico City', 'Miami', 'Milan', 'Montreal', 'Moscow',
  'Mumbai', 'Munich', 'Nairobi', 'Naples', 'New Delhi', 'New York', 'Nice', 'Osaka', 'Oslo', 'Paris',
  'Perth', 'Philadelphia', 'Phoenix', 'Prague', 'Quebec City', 'Reykjavik', 'Rio de Janeiro', 'Rome', 'San Diego', 'San Francisco',
  'Santiago', 'São Paulo', 'Seattle', 'Seoul', 'Seville', 'Shanghai', 'Singapore', 'Stockholm', 'Sydney', 'Taipei',
  'Tallinn', 'Tel Aviv', 'Tokyo', 'Toronto', 'Valencia', 'Vancouver', 'Venice', 'Vienna', 'Warsaw', 'Washington, D.C.',
  'Zurich'
];

router.get('/suggest', (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  if (!q || q.length < 1) return res.json([]);
  const matches = CITIES.filter((name) => name.toLowerCase().startsWith(q)).slice(0, 10);
  res.json(matches);
});

export default router;
