import React, { useEffect, useRef, useState } from 'react';

// Travel words formed by star constellation patterns
const TRAVEL_STAR_WORDS = [
  {
    word: "GO",
    pattern: [
      // G letter
      {x: 0, y: 0}, {x: 0, y: 20}, {x: 0, y: 40}, {x: 0, y: 60},
      {x: 20, y: 0}, {x: 40, y: 0}, {x: 40, y: 30}, {x: 20, y: 30}, {x: 40, y: 60}, {x: 20, y: 60},
      // O letter (offset)
      {x: 80, y: 0}, {x: 100, y: 0}, {x: 120, y: 0},
      {x: 80, y: 20}, {x: 120, y: 20},
      {x: 80, y: 40}, {x: 120, y: 40},
      {x: 80, y: 60}, {x: 100, y: 60}, {x: 120, y: 60}
    ],
    connections: [
      // G connections
      [0,1],[1,2],[2,3],[0,4],[4,5],[7,6],[6,8],[8,9],[9,3],
      // O connections
      [10,11],[11,12],[12,14],[14,16],[16,18],[18,17],[17,15],[15,13],[13,10]
    ]
  },
  {
    word: "FLY",
    pattern: [
      // F letter
      {x: 0, y: 0}, {x: 0, y: 20}, {x: 0, y: 40}, {x: 0, y: 60},
      {x: 20, y: 0}, {x: 40, y: 0}, {x: 20, y: 30},
      // L letter
      {x: 70, y: 0}, {x: 70, y: 20}, {x: 70, y: 40}, {x: 70, y: 60}, {x: 90, y: 60}, {x: 110, y: 60},
      // Y letter
      {x: 140, y: 0}, {x: 150, y: 20}, {x: 160, y: 0}, {x: 150, y: 40}, {x: 150, y: 60}
    ],
    connections: [
      // F connections
      [0,1],[1,2],[2,3],[0,4],[4,5],[1,6],
      // L connections
      [7,8],[8,9],[9,10],[10,11],[11,12],
      // Y connections
      [13,14],[15,14],[14,16],[16,17]
    ]
  },
  {
    word: "SEE",
    pattern: [
      // S letter
      {x: 0, y: 0}, {x: 20, y: 0}, {x: 40, y: 0}, {x: 0, y: 20}, {x: 20, y: 30}, {x: 40, y: 30},
      {x: 40, y: 40}, {x: 20, y: 60}, {x: 0, y: 60},
      // E letter
      {x: 70, y: 0}, {x: 70, y: 20}, {x: 70, y: 40}, {x: 70, y: 60},
      {x: 90, y: 0}, {x: 110, y: 0}, {x: 90, y: 30}, {x: 90, y: 60}, {x: 110, y: 60},
      // E letter (second)
      {x: 140, y: 0}, {x: 140, y: 20}, {x: 140, y: 40}, {x: 140, y: 60},
      {x: 160, y: 0}, {x: 180, y: 0}, {x: 160, y: 30}, {x: 160, y: 60}, {x: 180, y: 60}
    ],
    connections: [
      // S connections
      [0,1],[1,2],[0,3],[3,4],[4,5],[5,6],[6,7],[7,8],
      // E connections
      [9,10],[10,11],[11,12],[9,13],[13,14],[11,15],[12,16],[16,17],
      // E connections (second)
      [18,19],[19,20],[20,21],[18,22],[22,23],[20,24],[21,25],[25,26]
    ]
  },
  {
    word: "SKY",
    pattern: [
      // S letter
      {x: 0, y: 0}, {x: 20, y: 0}, {x: 40, y: 0}, {x: 0, y: 20}, {x: 20, y: 30}, {x: 40, y: 30},
      {x: 40, y: 40}, {x: 20, y: 60}, {x: 0, y: 60},
      // K letter
      {x: 70, y: 0}, {x: 70, y: 20}, {x: 70, y: 40}, {x: 70, y: 60}, {x: 90, y: 0}, {x: 80, y: 25}, {x: 90, y: 60},
      // Y letter
      {x: 120, y: 0}, {x: 130, y: 20}, {x: 140, y: 0}, {x: 130, y: 40}, {x: 130, y: 60}
    ],
    connections: [
      // S connections
      [0,1],[1,2],[0,3],[3,4],[4,5],[5,6],[6,7],[7,8],
      // K connections
      [9,10],[10,11],[11,12],[10,14],[14,15],[15,16],[15,11],
      // Y connections
      [17,18],[19,18],[18,20],[20,21]
    ]
  }
];

const ItineraryWizard = ({ onBack }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isTyping, setIsTyping] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [multipleSelections, setMultipleSelections] = useState([]);
  const [questionHistory, setQuestionHistory] = useState([]);
  const [constellation, setConstellation] = useState([]);
  const [constellationFormed, setConstellationFormed] = useState(false);
  const inputRef = useRef(null);
  const dateInputRef = useRef(null);
  const canvasRef = useRef(null);

  const questions = [
    {
      id: 'locationType',
      question: 'Do you have specific locations in mind, or would you like me to create an itinerary for a general destination?',
      options: [
        { value: 'specific', label: 'I have specific locations (e.g., Mumbai, Goa, Nagpur, and Ahmedabad)' },
        { value: 'general', label: 'Just a general location (e.g., America, Europe, India)' }
      ],
      type: 'choice'
    },
    {
      id: 'destination',
      question: (answers) => 
        answers.locationType === 'specific' 
          ? 'Please tell me the specific cities or locations you\'d like to visit:'
          : 'Which country or region would you like to explore?',
      type: 'text',
      placeholder: (answers) =>
        answers.locationType === 'specific'
          ? 'e.g., Mumbai, Goa, Nagpur, Ahmedabad'
          : 'e.g., Japan, Europe, Southeast Asia'
    },
    {
      id: 'duration',
      question: 'How many days do you have for this trip?',
      type: 'text',
      placeholder: 'e.g., 7 days, 2 weeks, 10 days'
    },
    {
      id: 'flexibility',
      question: 'Are your dates flexible?',
      options: [
        { value: 'flexible', label: '✨ Yes, I can add or remove 2-3 days if needed' },
        { value: 'fixed', label: '📅 No, I have fixed dates' }
      ],
      type: 'choice'
    },
    {
      id: 'dates',
      question: (answers) => 
        answers.flexibility === 'flexible' 
          ? 'When would you like to start your trip? (approximate dates)'
          : 'What are your exact travel dates?',
      type: 'date',
      showEndDate: true
    },
    {
      id: 'travelPace',
      question: 'What\'s your preferred travel pace?',
      options: [
        { value: 'relaxed', label: '🧘 Relaxed (1-2 main activities per day, lots of free time)' },
        { value: 'balanced', label: '⚖️ Balanced (A good mix of activities and downtime)' },
        { value: 'action-packed', label: '🚀 Action-Packed (See as much as possible!)' }
      ],
      type: 'choice'
    },
    {
      id: 'travelStyle',
      question: 'What type of experiences interest you most? (Select all that apply)',
      options: [
        { value: 'adventure', label: '🏔️ Adventure & Outdoor Activities' },
        { value: 'cultural', label: '🏛️ Cultural & Historical Sites' },
        { value: 'relaxation', label: '🏖️ Relaxation & Beach' },
        { value: 'foodie', label: '🍜 Food & Local Cuisine' },
        { value: 'nightlife', label: '🌃 Nightlife & Entertainment' },
        { value: 'nature', label: '🌿 Nature & Wildlife' },
        { value: 'shopping', label: '🛍️ Shopping & Markets' },
        { value: 'photography', label: '📸 Photography & Scenic Views' }
      ],
      type: 'multiple',
      minSelections: 1
    },
    {
      id: 'transport',
      question: 'What\'s your preferred mode of transportation?',
      options: [
        { value: 'flight', label: '✈️ Flight (Fastest option)' },
        { value: 'train', label: '🚂 Train (Scenic and comfortable)' },
        { value: 'bus', label: '🚌 Bus (Budget-friendly)' },
        { value: 'mixed', label: '🎯 Mixed (Combination based on route)' }
      ],
      type: 'choice',
      conditional: true
    },
    {
      id: 'transportClass',
      question: (answers) => {
        const transport = answers.transport;
        if (transport === 'flight') return 'Which flight class would you prefer?';
        if (transport === 'train') return 'Which train class would you prefer?';
        if (transport === 'bus') return 'Which bus type would you prefer?';
        return 'Which class/type would you prefer?';
      },
      options: (answers) => {
        const transport = answers.transport;
        if (transport === 'flight') {
          return [
            { value: 'economy', label: '💺 Economy Class' },
            { value: 'premium', label: '💎 Premium Economy' },
            { value: 'business', label: '✨ Business Class' },
            { value: 'first', label: '👑 First Class' }
          ];
        }
        if (transport === 'train') {
          return [
            { value: 'sleeper', label: '🛏️ Sleeper Class' },
            { value: '3ac', label: '🚃 3rd AC' },
            { value: '2ac', label: '🚞 2nd AC' },
            { value: '1ac', label: '👑 1st AC' }
          ];
        }
        if (transport === 'bus') {
          return [
            { value: 'regular', label: '🚌 Regular Bus' },
            { value: 'semi-sleeper', label: '💺 Semi-Sleeper' },
            { value: 'sleeper', label: '🛏️ Sleeper Bus' },
            { value: 'luxury', label: '✨ Luxury Bus' }
          ];
        }
        return [
          { value: 'budget', label: '💰 Budget Option' },
          { value: 'comfort', label: '💺 Comfort Option' },
          { value: 'luxury', label: '✨ Luxury Option' }
        ];
      },
      type: 'choice',
      showIf: (answers) => answers.transport && answers.transport !== 'mixed'
    },
    {
      id: 'budget',
      question: 'What\'s your approximate budget range?',
      options: [
        { value: 'budget', label: '💰 Budget-friendly (₹10k-30k per person)' },
        { value: 'mid', label: '💎 Mid-range (₹30k-75k per person)' },
        { value: 'luxury', label: '✨ Luxury (₹75k-1.5L per person)' },
        { value: 'premium', label: '👑 Premium (₹1.5L+ per person)' },
        { value: 'no-limit', label: '🌟 No specific limit' }
      ],
      type: 'choice'
    }
  ];

  // Add after getConstellationPattern
  const getConstellationLines = (questionId) => {
    // Each entry is [fromIndex, toIndex] for the pattern points
    const lines = {
      'locationType': [
        [0,1],[0,2],[1,3],[2,4],[3,5],[4,6],[5,7],[6,7],[7,8],[8,9]
      ],
      'destination': [
        [0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,0],
        [10,11],[12,13]
      ],
      'duration': [
        [0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,0],[8,9],[8,10]
      ],
      'flexibility': [
        [0,1],[1,2],[2,3],[3,4],
        [5,6],[6,7],[7,8],[8,9],
        [10,11],[11,12],[12,13],[13,14],
        [15,16],[16,17],[17,18],[18,19]
      ],
      'dates': [
        [0,1],[1,2],[2,3],[3,4],
        [5,6],[6,7],[7,8],[8,9],
        [10,11],[11,12],[12,13],[13,14],
        [15,16],[16,17],[17,18],[18,19]
      ],
      'travelPace': [
        [0,1],[1,2],[2,3],[3,4],[4,5],
        [6,7],[6,8]
      ],
      'travelStyle': [
        [0,1],[1,2],[2,6],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10]
      ],
      'transport': [
        [0,1],[1,2],[2,3],[3,4],
        [2,5],[2,6],[2,7],[0,8],[0,9],[4,10]
      ],
      'transportClass': [
        [0,1],[1,2],[2,3],[3,4],
        [2,5],[2,6],[2,7],[0,8],[0,9],[4,10]
      ],
      'budget': [
        [0,1],[1,2],[2,3],[3,4],
        [5,6],[6,7],[7,8],
        [9,10],[10,11],[11,12],[12,13]
      ]
    };
    return lines[questionId] || [];
  };

  // Constellation patterns for different question types - more recognizable symbols
  const getConstellationPattern = (questionId, questionType) => {
    const patterns = {
      // Clear location pin icon
      'locationType': [
        // Pin head (circle)
        {x: 0.5, y: 0.15}, {x: 0.45, y: 0.2}, {x: 0.55, y: 0.2},
        {x: 0.4, y: 0.25}, {x: 0.6, y: 0.25}, {x: 0.45, y: 0.3}, {x: 0.55, y: 0.3},
        // Pin point
        {x: 0.5, y: 0.35}, {x: 0.5, y: 0.45}, {x: 0.5, y: 0.55}
      ],
      // Clear globe with meridians
      'destination': [
        // Outer circle
        {x: 0.5, y: 0.1}, {x: 0.7, y: 0.2}, {x: 0.8, y: 0.35},
        {x: 0.8, y: 0.55}, {x: 0.7, y: 0.7}, {x: 0.5, y: 0.8},
        {x: 0.3, y: 0.7}, {x: 0.2, y: 0.55}, {x: 0.2, y: 0.35}, {x: 0.3, y: 0.2},
        // Meridian lines
        {x: 0.5, y: 0.35}, {x: 0.5, y: 0.55},
        // Horizontal line
        {x: 0.35, y: 0.45}, {x: 0.65, y: 0.45}
      ],
      // Clear clock face
      'duration': [
        // Clock circle
        {x: 0.5, y: 0.1}, {x: 0.75, y: 0.2}, {x: 0.85, y: 0.45},
        {x: 0.75, y: 0.7}, {x: 0.5, y: 0.8}, {x: 0.25, y: 0.7},
        {x: 0.15, y: 0.45}, {x: 0.25, y: 0.2},
        // Clock hands (pointing to 3 o'clock)
        {x: 0.5, y: 0.45}, {x: 0.65, y: 0.45}, {x: 0.5, y: 0.3}
      ],
      // Clear calendar grid
      'flexibility': [
        // Top row (calendar header)
        {x: 0.2, y: 0.2}, {x: 0.35, y: 0.2}, {x: 0.5, y: 0.2}, {x: 0.65, y: 0.2}, {x: 0.8, y: 0.2},
        // Second row
        {x: 0.2, y: 0.35}, {x: 0.35, y: 0.35}, {x: 0.5, y: 0.35}, {x: 0.65, y: 0.35}, {x: 0.8, y: 0.35},
        // Third row
        {x: 0.2, y: 0.5}, {x: 0.35, y: 0.5}, {x: 0.5, y: 0.5}, {x: 0.65, y: 0.5}, {x: 0.8, y: 0.5},
        // Fourth row
        {x: 0.2, y: 0.65}, {x: 0.35, y: 0.65}, {x: 0.5, y: 0.65}, {x: 0.65, y: 0.65}, {x: 0.8, y: 0.65}
      ],
      'dates': [
        // Same calendar pattern
        {x: 0.2, y: 0.2}, {x: 0.35, y: 0.2}, {x: 0.5, y: 0.2}, {x: 0.65, y: 0.2}, {x: 0.8, y: 0.2},
        {x: 0.2, y: 0.35}, {x: 0.35, y: 0.35}, {x: 0.5, y: 0.35}, {x: 0.65, y: 0.35}, {x: 0.8, y: 0.35},
        {x: 0.2, y: 0.5}, {x: 0.35, y: 0.5}, {x: 0.5, y: 0.5}, {x: 0.65, y: 0.5}, {x: 0.8, y: 0.5},
        {x: 0.2, y: 0.65}, {x: 0.35, y: 0.65}, {x: 0.5, y: 0.65}, {x: 0.65, y: 0.65}, {x: 0.8, y: 0.65}
      ],
      // Clear speed/gauge icon
      'travelPace': [
        // Semi-circle gauge
        {x: 0.2, y: 0.6}, {x: 0.3, y: 0.4}, {x: 0.45, y: 0.25},
        {x: 0.55, y: 0.25}, {x: 0.7, y: 0.4}, {x: 0.8, y: 0.6},
        // Gauge needle pointing right (fast)
        {x: 0.5, y: 0.6}, {x: 0.7, y: 0.45},
        // Gauge center
        {x: 0.5, y: 0.6}
      ],
      // Clear heart shape
      'travelStyle': [
        // Left heart bump
        {x: 0.35, y: 0.25}, {x: 0.3, y: 0.3}, {x: 0.35, y: 0.35},
        // Right heart bump  
        {x: 0.65, y: 0.25}, {x: 0.7, y: 0.3}, {x: 0.65, y: 0.35},
        // Heart middle and point
        {x: 0.5, y: 0.35}, {x: 0.45, y: 0.45}, {x: 0.55, y: 0.45},
        {x: 0.5, y: 0.55}, {x: 0.5, y: 0.65}
      ],
      // Clear airplane shape
      'transport': [
        // Fuselage
        {x: 0.2, y: 0.45}, {x: 0.35, y: 0.45}, {x: 0.5, y: 0.45}, {x: 0.65, y: 0.45}, {x: 0.8, y: 0.4},
        // Main wings
        {x: 0.4, y: 0.3}, {x: 0.45, y: 0.45}, {x: 0.4, y: 0.6},
        // Tail wings
        {x: 0.25, y: 0.35}, {x: 0.25, y: 0.55},
        // Nose
        {x: 0.8, y: 0.4}
      ],
      'transportClass': [
        // Same airplane pattern
        {x: 0.2, y: 0.45}, {x: 0.35, y: 0.45}, {x: 0.5, y: 0.45}, {x: 0.65, y: 0.45}, {x: 0.8, y: 0.4},
        {x: 0.4, y: 0.3}, {x: 0.45, y: 0.45}, {x: 0.4, y: 0.6},
        {x: 0.25, y: 0.35}, {x: 0.25, y: 0.55}, {x: 0.8, y: 0.4}
      ],
      // Clear dollar sign
      'budget': [
        // Vertical line of $
        {x: 0.5, y: 0.1}, {x: 0.5, y: 0.25}, {x: 0.5, y: 0.45}, {x: 0.5, y: 0.65}, {x: 0.5, y: 0.8},
        // Top S curve
        {x: 0.7, y: 0.2}, {x: 0.6, y: 0.25}, {x: 0.4, y: 0.35}, {x: 0.3, y: 0.4},
        // Bottom S curve
        {x: 0.3, y: 0.5}, {x: 0.4, y: 0.55}, {x: 0.6, y: 0.65}, {x: 0.7, y: 0.7}
      ]
    };
    return patterns[questionId] || patterns['locationType'];
  };

  // Replace the entire useEffect for constellation animation with the following:
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    // Responsive canvas
    const setCanvasSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    setCanvasSize();
    window.addEventListener('resize', setCanvasSize);
    // --- Main Constellation Symbol (centered) ---
    const currentQ = questions[currentStep];
    const pattern = getConstellationPattern(currentQ?.id, currentQ?.type);
    const lines = getConstellationLines(currentQ?.id);
    // Center constellation
    const constellationSize = Math.min(canvas.width, canvas.height) * 0.25;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2.2;
    const stars = pattern.map((point, index) => ({
      id: index,
      x: centerX + (point.x - 0.5) * constellationSize,
      y: centerY + (point.y - 0.5) * constellationSize,
      targetX: centerX + (point.x - 0.5) * constellationSize,
      targetY: centerY + (point.y - 0.5) * constellationSize,
      currentX: Math.random() * canvas.width,
      currentY: Math.random() * canvas.height,
      alpha: 0,
      targetAlpha: 1.0,
      formed: false
    }));
    setConstellation(stars);
    setConstellationFormed(false);
    // --- Travel Star Word Constellation System ---
    const wordConstellations = TRAVEL_STAR_WORDS.map((wordData, index) => {
      const baseX = (canvas.width / (TRAVEL_STAR_WORDS.length + 1)) * (index + 1) - 90; // Center words
      const baseY = canvas.height * (0.3 + Math.random() * 0.4);
      const scale = 0.8; // Scale down the letters

      // Create stars for each point in the word pattern
      const stars = wordData.pattern.map((point, starIndex) => ({
        targetX: baseX + point.x * scale,
        targetY: baseY + point.y * scale,
        currentX: baseX + (Math.random() - 0.5) * 300,
        currentY: baseY + (Math.random() - 0.5) * 300,
        alpha: 0,
        targetAlpha: 0.9,
        forming: true,
        formDelay: starIndex * 150 + Math.random() * 400
      }));

      return {
        word: wordData.word,
        pattern: wordData.pattern,
        connections: wordData.connections,
        stars,
        baseX,
        baseY,
        scale,
        formed: false,
        breaking: false,
        reformTimer: 0
      };
    });
    let animationId;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Animate star word constellations
      const currentTime = Date.now();
      wordConstellations.forEach(constellation => {
        let allFormed = true;

        constellation.stars.forEach(star => {
          if (currentTime > star.formDelay) {
            if (star.forming && !constellation.breaking) {
              // Form word constellation
              const dx = star.targetX - star.currentX;
              const dy = star.targetY - star.currentY;
              const distance = Math.sqrt(dx * dx + dy * dy);

              if (distance > 2) {
                star.currentX += dx * 0.04;
                star.currentY += dy * 0.04;
                allFormed = false;
              } else {
                star.currentX = star.targetX;
                star.currentY = star.targetY;
              }

              if (star.alpha < star.targetAlpha) {
                star.alpha = Math.min(star.alpha + 0.03, star.targetAlpha);
              }
            } else if (constellation.breaking) {
              // Break word constellation
              star.currentX += (Math.random() - 0.5) * 4;
              star.currentY += (Math.random() - 0.5) * 4;
              star.alpha = Math.max(star.alpha - 0.04, 0);
              if (star.alpha > 0) allFormed = false;
            }
          } else {
            allFormed = false;
          }

          // Draw star
          if (star.alpha > 0) {
            ctx.save();
            ctx.globalAlpha = star.alpha;
            ctx.fillStyle = '#87CEEB';
            ctx.shadowColor = '#87CEEB';
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(star.currentX, star.currentY, 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        });

        // Draw connecting lines to form letters when stars are in position
        if (allFormed && !constellation.breaking) {
          constellation.formed = true;

          ctx.save();
          ctx.strokeStyle = '#87CEEB';
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = 0.7;
          ctx.shadowColor = '#87CEEB';
          ctx.shadowBlur = 3;

          constellation.connections.forEach(([fromIndex, toIndex]) => {
            const fromStar = constellation.stars[fromIndex];
            const toStar = constellation.stars[toIndex];
            if (fromStar && toStar && fromStar.alpha > 0.5 && toStar.alpha > 0.5) {
              ctx.beginPath();
              ctx.moveTo(fromStar.currentX, fromStar.currentY);
              ctx.lineTo(toStar.currentX, toStar.currentY);
              ctx.stroke();
            }
          });
          ctx.restore();
        }

        // Random breaking and reforming cycle
        if (constellation.formed && !constellation.breaking) {
          constellation.reformTimer++;
          if (constellation.reformTimer > 250 + Math.random() * 150) { // 4-6 seconds
            constellation.breaking = true;
            constellation.reformTimer = 0;
          }
        }

        // Reset for reformation
        if (constellation.breaking && allFormed) {
          constellation.breaking = false;
          constellation.formed = false;
          constellation.stars.forEach(star => {
            star.forming = true;
            star.alpha = 0;
            star.currentX = constellation.baseX + (Math.random() - 0.5) * 300;
            star.currentY = constellation.baseY + (Math.random() - 0.5) * 300;
            star.formDelay = currentTime + Math.random() * 1000;
          });
        }
      });

      // Animate main constellation stars for the current question
      let allFormed = true;
      stars.forEach((star, index) => {
        const dx = star.targetX - star.currentX;
        const dy = star.targetY - star.currentY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 2) {
          star.currentX += dx * 0.02;
          star.currentY += dy * 0.02;
          allFormed = false;
        } else {
          star.currentX = star.targetX;
          star.currentY = star.targetY;
          star.formed = true;
        }

        if (star.alpha < star.targetAlpha) {
          star.alpha = Math.min(star.alpha + 0.02, star.targetAlpha);
        }

        ctx.save();
        ctx.globalAlpha = star.alpha;
        ctx.fillStyle = '#87CEEB';
        ctx.shadowColor = '#87CEEB';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(star.currentX, star.currentY, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = star.alpha * 0.8;
        ctx.fillStyle = 'white';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(star.currentX, star.currentY, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Draw main constellation lines
      ctx.save();
      ctx.strokeStyle = '#87CEEB';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#87CEEB';
      ctx.shadowBlur = 3;
      lines.forEach(([from, to]) => {
        if (stars[from] && stars[to] && stars[from].formed && stars[to].formed) {
          ctx.globalAlpha = Math.min(stars[from].alpha, stars[to].alpha) * 0.7;
          ctx.beginPath();
          ctx.moveTo(stars[from].currentX, stars[from].currentY);
          ctx.lineTo(stars[to].currentX, stars[to].currentY);
          ctx.stroke();
        }
      });
      ctx.restore();

      if (allFormed && !constellationFormed) {
        setConstellationFormed(true);
      }

      animationId = requestAnimationFrame(animate);
    };
    // Start animation after a short delay
    const startAnimation = setTimeout(() => {
      animate();
    }, 400);
    return () => {
      clearTimeout(startAnimation);
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      window.removeEventListener('resize', setCanvasSize);
    };
  }, [currentStep]);

  // Typewriter effect for questions - Fixed first letter issue
  useEffect(() => {
    if (currentStep < questions.length) {
      const currentQ = questions[currentStep];
      // Skip questions that should not be shown
      if (currentQ.showIf && !currentQ.showIf(answers)) {
        setCurrentStep(prev => prev + 1);
        return;
      }

      const questionText = typeof currentQ.question === 'function'
        ? currentQ.question(answers)
        : currentQ.question;
      
      setIsTyping(true);
      setCurrentQuestion('');
      
      // Fix: Start with empty string and add characters from index 0
      let index = 0;
      const typeInterval = setInterval(() => {
        if (index <= questionText.length) {
          setCurrentQuestion(questionText.substring(0, index));
          index++;
        } else {
          clearInterval(typeInterval);
          setIsTyping(false);
          // Focus input after typewriter completes for text inputs
          if (currentQ.type === 'text' && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 100);
          }
          if (currentQ.type === 'date' && dateInputRef.current) {
            setTimeout(() => dateInputRef.current?.focus(), 100);
          }
        }
      }, 30);

      return () => clearInterval(typeInterval);
    }
  }, [currentStep, answers]);

  const handleAnswer = (questionId, answer) => {
    // Store current state in history before moving to next question
    setQuestionHistory(prev => [...prev, { step: currentStep, answers, inputValue, selectedDate, endDate, multipleSelections }]);
    
    const newAnswers = { ...answers, [questionId]: answer };
    setAnswers(newAnswers);
    
    setTimeout(() => {
      if (currentStep < questions.length - 1) {
        setCurrentStep(prev => prev + 1);
        setInputValue('');
        setSelectedDate('');
        setEndDate('');
        setMultipleSelections([]);
      } else {
        // All questions answered, generate itinerary
        generateItinerary(newAnswers);
      }
    }, 300);
  };

  const handleTextSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim()) {
      handleAnswer(questions[currentStep].id, inputValue.trim());
    }
  };

  const handleDateSubmit = (e) => {
    e.preventDefault();
    if (selectedDate) {
      const dateValue = answers.flexibility === 'flexible' 
        ? { startDate: selectedDate, tentativeEndDate: endDate }
        : { startDate: selectedDate, endDate: endDate };
      handleAnswer(questions[currentStep].id, dateValue);
    }
  };

  const handleMultipleSelection = (value) => {
    const newSelections = multipleSelections.includes(value)
      ? multipleSelections.filter(item => item !== value)
      : [...multipleSelections, value];
    setMultipleSelections(newSelections);
  };

  const handleMultipleSubmit = () => {
    if (multipleSelections.length >= (questions[currentStep].minSelections || 1)) {
      handleAnswer(questions[currentStep].id, multipleSelections);
    }
  };

  const handleBackToQuestion = () => {
    if (questionHistory.length > 0) {
      const previousState = questionHistory[questionHistory.length - 1];
      setCurrentStep(previousState.step);
      setAnswers(previousState.answers);
      setInputValue(previousState.inputValue);
      setSelectedDate(previousState.selectedDate);
      setEndDate(previousState.endDate);
      setMultipleSelections(previousState.multipleSelections);
      setQuestionHistory(prev => prev.slice(0, -1));
    }
  };

  const generateItinerary = (finalAnswers) => {
    console.log('Generating itinerary with answers:', finalAnswers);
    // Here you would typically call your API to generate the itinerary
    // For now, we'll just log the answers
  };

  const getStepProgress = () => {
    return ((currentStep + 1) / questions.length) * 100;
  };

  if (currentStep >= questions.length) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-20">
        <div className="max-w-2xl w-full mx-4 text-center">
          <div className="text-blue-300 text-2xl font-light tracking-widest mb-8"
               style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
            �� Crafting your cosmic journey...
          </div>
          <div className="animate-spin w-12 h-12 border-2 border-blue-300 border-t-transparent rounded-full mx-auto mb-8"></div>
          <div className="text-blue-200 text-sm">
            Analyzing your preferences and creating the perfect itinerary
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-20 p-4">
      <div className="max-w-2xl w-full">
        {/* Star Constellation Background */}
        <canvas 
          ref={canvasRef}
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 1 }}
        />

        {/* Question Card */}
        <div className="bg-black/40 backdrop-blur-lg rounded-xl p-8 border border-blue-300/20 shadow-2xl relative z-10 ml-auto max-w-xl">
          {/* Question Text */}
          <div className="mb-8">
            <h2 className="text-blue-200 text-xl font-light leading-relaxed min-h-[3rem]"
                style={{ 
                  fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
                  textShadow: '0 0 10px rgba(173, 216, 230, 0.3)'
                }}>
              {currentQuestion}
              {isTyping && (
                <span className="inline-block w-0.5 h-6 bg-blue-300 ml-1 animate-pulse"></span>
              )}
            </h2>
          </div>

          {/* Answer Options */}
          {!isTyping && questions[currentStep].type === 'choice' && (
            <div className="space-y-3">
              {questions[currentStep].options.map((option, index) => (
                <button
                  key={option.value}
                  onClick={() => handleAnswer(questions[currentStep].id, option.value)}
                  className="w-full text-left p-4 rounded-lg bg-gradient-to-r from-blue-900/20 to-blue-800/20 border border-blue-400/30 hover:border-blue-300 hover:bg-blue-800/30 transition-all duration-300 group"
                  style={{ 
                    animationDelay: `${index * 100}ms`,
                    animation: 'fadeInUp 0.5s ease forwards'
                  }}
                >
                  <span className="text-blue-100 font-light tracking-wide group-hover:text-white transition-colors duration-300"
                        style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
                    {option.label}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Text Input */}
          {!isTyping && questions[currentStep].type === 'text' && (
            <form onSubmit={handleTextSubmit} className="space-y-4">
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={
                    typeof questions[currentStep].placeholder === 'function'
                      ? questions[currentStep].placeholder(answers)
                      : questions[currentStep].placeholder
                  }
                  className="w-full p-4 rounded-lg bg-black/20 border-2 border-blue-400/30 focus:border-blue-300 focus:outline-none text-blue-100 placeholder-blue-300/50 backdrop-blur-sm"
                  style={{ 
                    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
                    fontSize: '16px'
                  }}
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!inputValue.trim()}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:from-gray-600 disabled:to-gray-500 disabled:cursor-not-allowed text-white rounded-lg font-light tracking-wide transition-all duration-300 transform hover:scale-105"
                  style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}
                >
                  Continue →
                </button>
              </div>
            </form>
          )}

          {/* Date Input */}
          {!isTyping && questions[currentStep].type === 'date' && (
            <form onSubmit={handleDateSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="relative">
                  <label className="block text-blue-300 text-sm font-light mb-2">
                    {answers.flexibility === 'flexible' ? 'Start Date (approximate)' : 'Start Date'}
                  </label>
                  <input
                    ref={dateInputRef}
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full p-4 rounded-lg bg-black/20 border-2 border-blue-400/30 focus:border-blue-300 focus:outline-none text-blue-100 backdrop-blur-sm"
                    style={{ 
                      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
                      fontSize: '16px'
                    }}
                  />
                </div>
                {questions[currentStep].showEndDate && (
                  <div className="relative">
                    <label className="block text-blue-300 text-sm font-light mb-2">
                      {answers.flexibility === 'flexible' ? 'Tentative End Date' : 'End Date'}
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full p-4 rounded-lg bg-black/20 border-2 border-blue-400/30 focus:border-blue-300 focus:outline-none text-blue-100 backdrop-blur-sm"
                      style={{ 
                        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
                        fontSize: '16px'
                      }}
                    />
                  </div>
                )}
              </div>
              {answers.flexibility === 'flexible' && (
                <div className="text-blue-300/70 text-sm text-center">
                  💡 Don't worry, these dates can be adjusted by 2-3 days based on availability
                </div>
              )}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!selectedDate}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:from-gray-600 disabled:to-gray-500 disabled:cursor-not-allowed text-white rounded-lg font-light tracking-wide transition-all duration-300 transform hover:scale-105"
                  style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}
                >
                  Continue →
                </button>
              </div>
            </form>
          )}

          {/* Multiple Selection */}
          {!isTyping && questions[currentStep].type === 'multiple' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                {questions[currentStep].options.map((option, index) => (
                  <button
                    key={option.value}
                    onClick={() => handleMultipleSelection(option.value)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all duration-300 group ${
                      multipleSelections.includes(option.value)
                        ? 'bg-gradient-to-r from-blue-600/30 to-blue-500/30 border-blue-300 text-white'
                        : 'bg-gradient-to-r from-blue-900/20 to-blue-800/20 border-blue-400/30 hover:border-blue-300 hover:bg-blue-800/30 text-blue-100'
                    }`}
                    style={{ 
                      animationDelay: `${index * 100}ms`,
                      animation: 'fadeInUp 0.5s ease forwards'
                    }}
                  >
                    <span className="font-light tracking-wide group-hover:text-white transition-colors duration-300 flex items-center"
                          style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
                      <span className={`w-5 h-5 rounded border-2 mr-3 flex items-center justify-center ${
                        multipleSelections.includes(option.value)
                          ? 'border-blue-300 bg-blue-500'
                          : 'border-blue-400/50'
                      }`}>
                        {multipleSelections.includes(option.value) && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </span>
                      {option.label}
                    </span>
                  </button>
                ))}
              </div>
              <div className="text-center">
                <div className="text-blue-300/70 text-sm mb-4">
                  Selected: {multipleSelections.length} / {questions[currentStep].options.length}
                </div>
                <button
                  onClick={handleMultipleSubmit}
                  disabled={multipleSelections.length < (questions[currentStep].minSelections || 1)}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:from-gray-600 disabled:to-gray-500 disabled:cursor-not-allowed text-white rounded-lg font-light tracking-wide transition-all duration-300 transform hover:scale-105"
                  style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}
                >
                  Continue →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between items-center mt-8">
          <div className="flex gap-4">
            {questionHistory.length > 0 && (
              <button
                onClick={handleBackToQuestion}
                className="text-blue-300/70 hover:text-blue-300 text-sm font-light tracking-wide transition-colors duration-300 flex items-center"
                style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}
              >
                ↰ Previous Question
              </button>
            )}
          </div>
          
          <button
            onClick={onBack}
            className="text-blue-300/70 hover:text-blue-300 text-sm font-light tracking-wide transition-colors duration-300"
            style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}
          >
            ← Back to Home
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default ItineraryWizard;
