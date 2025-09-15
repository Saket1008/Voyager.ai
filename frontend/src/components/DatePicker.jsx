import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

// Helper function to format date to YYYY-MM-DD
const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Props:
// - onSelect: (value: string) => void
// - startDate: string | Date | undefined
// - duration: number | undefined
// - suggestedMonths: string[]
const DatePicker = ({ onSelect, startDate: propStartDate, duration, suggestedMonths = [] }) => {
  const [startDate, setStartDate] = useState(propStartDate ? formatDate(propStartDate) : '');
  const [endDate, setEndDate] = useState('');

  // Auto-calc end date when startDate and duration are known
  useEffect(() => {
    if (startDate && duration && duration > 0) {
      const start = new Date(startDate);
      const end = new Date(start);
      end.setDate(start.getDate() + duration - 1); // -1 because start day is day 1
      setEndDate(formatDate(end));
    } else if (propStartDate && !startDate) {
      setStartDate(formatDate(propStartDate));
    }
  }, [startDate, duration, propStartDate]);

  const handleSetDates = () => {
    if (startDate && endDate) {
      onSelect(`${startDate} to ${endDate}`);
    } else if (startDate) {
      onSelect(startDate);
    }
  };

  const handleMonthSuggestionClick = (month) => {
    // For simplicity, we just forward the month/season to the AI as a preference
    onSelect(month);
  };

  return (
    <div className="flex flex-col items-center p-4 bg-gray-800 rounded-lg shadow-md">
      <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4 mb-4 w-full">
        <div className="flex-1 w-full">
          <label htmlFor="startDate" className="block text-gray-400 text-sm mb-1">Start Date:</label>
          <input
            type="date"
            id="startDate"
            className="w-full p-2 rounded-md bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="flex-1 w-full">
          <label htmlFor="endDate" className="block text-gray-400 text-sm mb-1">End Date:</label>
          <input
            type="date"
            id="endDate"
            className="w-full p-2 rounded-md bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleSetDates}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-purple-700 transition-colors text-sm w-full sm:w-auto mt-3 sm:mt-0"
          disabled={!startDate}
        >
          Set Dates
        </motion.button>
      </div>

      {suggestedMonths.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 mt-2 w-full">
          <span className="text-gray-400 text-sm w-full text-center mb-1">Or consider traveling in:</span>
          {suggestedMonths.map((month) => (
            <motion.button
              key={month}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleMonthSuggestionClick(month)}
              className="bg-gray-700 text-purple-300 px-3 py-1 rounded-full border border-purple-500 hover:bg-gray-600 transition-colors text-sm"
            >
              {month}
            </motion.button>
          ))}
        </div>
      )}

      {/*
        NOTE: For a production application, you would typically integrate a
        more robust third-party date picker library here (e.g., react-datepicker, react-date-range).
        This simplified HTML5 input version has limitations (e.g., no easy range selection visual,
        browser-dependent UI).
      */}
    </div>
  );
};

export default DatePicker;
