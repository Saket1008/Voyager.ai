import React from 'react';
import { motion } from 'framer-motion';
import { Minus, Plus } from 'lucide-react';

/**
 * DaySelector
 * Props:
 * - onSelect: (days: number) => void
 * - currentValue: number | string
 * - onValueChange: (value: number) => void
 * - suggestedDurations?: number[]
 */
const DaySelector = ({ onSelect, currentValue, onValueChange, suggestedDurations = [3, 5, 7, 10] }) => {
  const numeric = Number.isFinite(currentValue) ? Number(currentValue) : parseInt(String(currentValue || 0), 10) || 0;

  const handleDecrement = () => {
    const newValue = Math.max(1, numeric - 1);
    onValueChange(newValue);
  };

  const handleIncrement = () => {
    const newValue = Math.max(1, numeric + 1);
    onValueChange(newValue);
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    // Allow empty input for editing; caller decides when to Set
    if (val === '') {
      onValueChange('');
      return;
    }
    const parsed = parseInt(val, 10);
    if (!Number.isNaN(parsed)) {
      onValueChange(Math.max(1, parsed));
    }
  };

  const setDisabled = numeric <= 0 || Number.isNaN(numeric);

  return (
    <div className="flex flex-col items-center p-4 bg-gray-800/70 rounded-xl shadow-md border border-gray-700">
      <div className="flex items-center gap-3 w-full justify-center mb-3">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleDecrement}
          className="p-2 rounded-full bg-gray-700 text-white hover:bg-gray-600 transition-colors"
          aria-label="Decrease days"
        >
          <Minus className="w-5 h-5" />
        </motion.button>
        <input
          type="number"
          min="1"
          inputMode="numeric"
          className="w-24 p-2 text-center rounded-md bg-gray-900 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500/60"
          value={currentValue}
          onChange={handleInputChange}
        />
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleIncrement}
          className="p-2 rounded-full bg-gray-700 text-white hover:bg-gray-600 transition-colors"
          aria-label="Increase days"
        >
          <Plus className="w-5 h-5" />
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => !setDisabled && onSelect(numeric)}
          disabled={setDisabled}
          className={`px-4 py-2 rounded-lg text-sm font-medium shadow-md transition-colors ${
            setDisabled ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-purple-600 text-white hover:bg-purple-700'
          }`}
        >
          Set Days
        </motion.button>
      </div>

      {Array.isArray(suggestedDurations) && suggestedDurations.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 w-full">
          <span className="text-gray-400 text-xs w-full text-center mb-1">Or choose a common duration:</span>
          {suggestedDurations.map((d) => (
            <motion.button
              key={d}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onSelect(d)}
              className="px-3 py-1 rounded-full text-xs bg-gray-900 text-purple-300 border border-purple-500/40 hover:bg-gray-800 transition-colors"
            >
              {d} {d === 1 ? 'Day' : 'Days'}
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
};

export default DaySelector;
