import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getFirebaseIdToken } from '../lib/firebaseClient';
import { useAuth } from '../context/AuthContext';
import { auth } from '../lib/firebaseClient';
import { signOut } from 'firebase/auth';
import { Search, LogOut, RefreshCw, Copy, Send, Bot, Calendar, Users, MapPin, Menu, X, Plus, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import TextareaAutosize from 'react-textarea-autosize';
import Avatar from './Avatar.jsx';
import { Clock, Utensils, Bed, Info, Lightbulb } from 'lucide-react';

// Enhanced StageInput component with advanced date selection and pace options
const StageInput = ({ inputSpec, quickOptions, flowState, setFlowState, onSubmit }) => {
  const [multiSel, setMultiSel] = useState([]);
  const [uiDays, setUiDays] = useState(flowState?.durationDays || 7);
  const [uiDaysFlex, setUiDaysFlex] = useState(flowState?.durationFlex || false);
  const [uiStartDate, setUiStartDate] = useState(flowState?.startDate || '');
  const [uiEndDate, setUiEndDate] = useState(flowState?.endDate || '');
  const [uiDateFlex, setUiDateFlex] = useState(flowState?.dateFlex || 'none');
  const [uiPace, setUiPace] = useState(flowState?.pace || '');
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [showDurationWarning, setShowDurationWarning] = useState(false);
  const [originalDays, setOriginalDays] = useState(null);
  const [pendingDuration, setPendingDuration] = useState(null);

  // Debug logging
  useEffect(() => {
    console.log('StageInput flowState:', flowState);
    console.log('uiStartDate:', uiStartDate, 'uiEndDate:', uiEndDate);
  }, [flowState, uiStartDate, uiEndDate]);

  // Store original days when component loads
  useEffect(() => {
    if (flowState?.durationDays && !originalDays) {
      setOriginalDays(flowState.durationDays);
    }
  }, [flowState?.durationDays, originalDays]);

  useEffect(() => {
    if (inputSpec?.type === 'multiselect') {
      setMultiSel(flowState?.interests || []);
    }
  }, [inputSpec?.type, flowState?.interests]);

  // Auto-calculate end date when start date and days are set
  useEffect(() => {
    if (uiStartDate && uiDays && inputSpec?.type === 'dates') {
      const start = new Date(uiStartDate);
      const end = new Date(start);
      end.setDate(start.getDate() + uiDays - 1);
      setUiEndDate(end.toISOString().split('T')[0]);
    }
  }, [uiStartDate, uiDays, inputSpec?.type]);

  const generateCalendar = () => {
    const firstDay = new Date(calendarYear, calendarMonth, 1);
    const startingDayOfWeek = firstDay.getDay();
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    
    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    return days;
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const isDateInRange = (day) => {
    if (!day || !uiStartDate) return false;
    const date = new Date(calendarYear, calendarMonth, day);
    const start = new Date(uiStartDate);
    const end = uiEndDate ? new Date(uiEndDate) : start;
    return date >= start && date <= end;
  };

  const isDateSelected = (day) => {
    if (!day) return false;
    const date = new Date(calendarYear, calendarMonth, day).toISOString().split('T')[0];
    return date === uiStartDate || date === uiEndDate;
  };

  const handleDateSelect = (day) => {
    if (!day) return;
    const selectedDate = new Date(calendarYear, calendarMonth, day);
    const dateString = selectedDate.toISOString().split('T')[0];
    
    if (!uiStartDate || (uiStartDate && uiEndDate)) {
      // First click or resetting - set start date
      setUiStartDate(dateString);
      setUiEndDate('');
      setShowDurationWarning(false);
    } else if (uiStartDate && !uiEndDate) {
      // Second click - set end date
      const start = new Date(uiStartDate);
      if (selectedDate >= start) {
        setUiEndDate(dateString);
        const diffTime = selectedDate - start;
        const newDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        
        // Check if duration changed significantly from original
        if (originalDays && Math.abs(newDays - originalDays) > 0) {
          setShowDurationWarning(true);
          setPendingDuration(newDays);
        } else {
          setUiDays(newDays);
        }
      } else {
        // If selected date is before start date, make it the new start date
        setUiStartDate(dateString);
        setUiEndDate('');
        setShowDurationWarning(false);
      }
    }
  };

  const acceptDurationChange = () => {
    setUiDays(pendingDuration);
    setShowDurationWarning(false);
    setPendingDuration(null);
    // Update the flow state to reflect the change
    setFlowState(prev => ({ ...prev, durationDays: pendingDuration }));
  };

  const rejectDurationChange = () => {
    // Reset to match original duration
    if (uiStartDate && originalDays) {
      const start = new Date(uiStartDate);
      const end = new Date(start);
      end.setDate(start.getDate() + originalDays - 1);
      setUiEndDate(end.toISOString().split('T')[0]);
      setUiDays(originalDays);
    }
    setShowDurationWarning(false);
    setPendingDuration(null);
  };

  const handleSubmit = async (value) => {
    if (inputSpec?.type === 'days') {
      const payload = { 
        durationDays: uiDays, 
        durationFlex: uiDaysFlex
      };
      setFlowState(prev => ({ ...prev, ...payload }));
      
      let response = `${uiDays} days`;
      if (uiDaysFlex) {
        response += ` with flexibility`;
      }
      await onSubmit(response);
      
    } else if (inputSpec?.type === 'dates') {
      const payload = { 
        startDate: uiStartDate, 
        endDate: uiEndDate,
        dateFlex: uiDateFlex,
        durationDays: uiDays
      };
      setFlowState(prev => ({ ...prev, ...payload }));
      
      let response = `Start: ${formatDate(uiStartDate)}`;
      if (uiEndDate) response += ` → End: ${formatDate(uiEndDate)} (${uiDays} days)`;
      if (flowState?.durationFlex && uiDateFlex && uiDateFlex !== 'none') {
        response += ` with ${uiDateFlex} flexibility`;
      }
      await onSubmit(response);
      
    } else if (inputSpec?.type === 'pace') {
      const payload = { pace: uiPace };
      setFlowState(prev => ({ ...prev, ...payload }));
      await onSubmit(`${uiPace} pace`);
      
    } else if (inputSpec?.type === 'multiselect') {
      setFlowState(prev => ({ ...prev, interests: multiSel }));
      await onSubmit(multiSel.join(', '));
    } else {
      await onSubmit(value);
    }
  };

  if (inputSpec?.type === 'options') {
    // Check if this is a pace question based on the options
    const isPaceQuestion = quickOptions?.some(opt => 
      /relaxed|balanced|action|fixed/i.test(opt)
    );
    
    if (isPaceQuestion) {
      // Special styling for pace options
      return (
        <div className="space-y-6">
          <div className="text-center text-white/80 text-sm mb-6">What's your preferred travel pace?</div>
          
          <div className="grid grid-cols-2 gap-4">
            {(quickOptions || []).map((opt, i) => {
              const paceDescriptions = {
                'Relaxed': 'Take it easy, plenty of downtime',
                'Balanced': 'Mix of activities and rest',
                'Action-Packed': 'See and do as much as possible',
                'Fixed Schedule': 'Stick to planned itinerary'
              };
              
              return (
                <button
                  key={i}
                  onClick={() => handleSubmit(opt)}
                  className="p-4 rounded-xl text-sm transition-all bg-white/10 text-white/90 hover:bg-purple-500/20 border-2 border-white/20 hover:border-purple-400 group"
                >
                  <div className="font-medium text-base text-purple-200 group-hover:text-purple-100">{opt}</div>
                  <div className="text-xs opacity-75 mt-1 text-white/70">
                    {paceDescriptions[opt] || 'Travel at your preferred speed'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      );
    }
    
    // Regular options styling
    return (
      <div className="flex flex-wrap gap-3 justify-center">
        {(quickOptions || []).map((opt, i) => (
          <button
            key={i}
            onClick={() => handleSubmit(opt)}
            className="px-6 py-3 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            {opt}
          </button>
        ))}
      </div>
    );
  }

  if (inputSpec?.type === 'multiselect') {
    const options = inputSpec?.options || [];
    return (
      <div className="space-y-4">
        <div className="text-center text-white/80 text-sm mb-4">Select all that interest you:</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {options.map((opt, i) => {
            const isSelected = multiSel.includes(opt);
            return (
              <button
                key={i}
                onClick={() => {
                  setMultiSel(prev => 
                    isSelected ? prev.filter(x => x !== opt) : [...prev, opt]
                  );
                }}
                className={`p-3 rounded-xl border transition-all duration-200 ${
                  isSelected 
                    ? 'bg-blue-500/20 border-blue-400 text-blue-200' 
                    : 'bg-white/5 border-white/20 text-white/80 hover:bg-white/10'
                }`}
              >
                <div className="text-sm font-medium flex items-center justify-between">
                  {opt}
                  {isSelected && <Check className="w-4 h-4 text-blue-400" />}
                </div>
              </button>
            );
          })}
        </div>
        <div className="flex justify-center">
          <button
            onClick={() => handleSubmit(multiSel)}
            disabled={multiSel.length === 0}
            className="px-8 py-3 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:from-green-600 hover:to-emerald-700 transition-all duration-200"
          >
            Continue ({multiSel.length} selected)
          </button>
        </div>
      </div>
    );
  }

  if (inputSpec?.type === 'days') {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="text-white/80 text-sm mb-4">How many days are you planning?</div>
          <div className="flex items-center justify-center gap-4 mb-4">
            <button
              onClick={() => setUiDays(Math.max(1, uiDays - 1))}
              className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors text-xl font-bold"
            >
              −
            </button>
            <div className="text-3xl font-bold text-white min-w-[4rem] px-4 py-2 bg-white/10 rounded-xl border border-white/20">
              {uiDays}
            </div>
            <button
              onClick={() => setUiDays(uiDays + 1)}
              className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors text-xl font-bold"
            >
              +
            </button>
          </div>
          
          {/* Quick day selection buttons */}
          <div className="grid grid-cols-4 gap-2 mb-6">
            {[3, 5, 7, 10, 14, 21, 30].map(days => (
              <button
                key={days}
                onClick={() => setUiDays(days)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  uiDays === days
                    ? 'bg-blue-500 text-white shadow-lg'
                    : 'bg-white/10 text-white/90 hover:bg-white/20'
                }`}
              >
                {days}d
              </button>
            ))}
          </div>
        </div>

        {/* Simple flexibility checkbox with description */}
        <div className="text-center">
          <label className="inline-flex items-center gap-3 text-white/90 text-sm cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                checked={uiDaysFlex}
                onChange={(e) => setUiDaysFlex(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-5 h-5 rounded border-2 transition-all ${
                uiDaysFlex 
                  ? 'bg-green-500 border-green-500' 
                  : 'bg-transparent border-white/40'
              }`}>
                {uiDaysFlex && (
                  <Check className="w-3 h-3 text-white absolute top-0.5 left-0.5" />
                )}
              </div>
            </div>
            <span>Flexible dates</span>
          </label>
          <div className="text-xs text-white/60 mt-1">
            Flexibility means ±2-3 days adjustment in your trip duration
          </div>
        </div>

        <button
          onClick={() => handleSubmit(uiDays)}
          className="w-full px-8 py-3 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium hover:from-green-600 hover:to-emerald-700 transition-all duration-200"
        >
          <Calendar className="w-4 h-4 inline mr-2" />
          Continue with {uiDays} days
        </button>
      </div>
    );
  }

  if (inputSpec?.type === 'dates') {
    return (
      <div className="space-y-6">
        <div className="text-center text-white/80 text-sm">Plan your travel dates</div>
        
        {/* Main layout: Left side (inputs + submit) and Right side (calendar + flexibility) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Left Side - Date Inputs, Trip Summary, and Submit Button */}
          <div className="space-y-6">
            {/* Date inputs */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">Start Date</label>
                <input
                  type="date"
                  value={uiStartDate}
                  onChange={(e) => {
                    setUiStartDate(e.target.value);
                    setShowDurationWarning(false);
                    console.log('Start date changed:', e.target.value);
                  }}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:border-blue-400 focus:outline-none"
                  min={new Date().toISOString().split('T')[0]}
                />
                {uiStartDate && (
                  <p className="mt-1 text-xs text-white/70">{formatDate(uiStartDate)}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white/90 mb-2">
                  End Date {uiDays && `(${uiDays} days)`}
                </label>
                <input
                  type="date"
                  value={uiEndDate}
                  onChange={(e) => {
                    setUiEndDate(e.target.value);
                    console.log('End date changed:', e.target.value);
                    if (uiStartDate && e.target.value) {
                      const start = new Date(uiStartDate);
                      const end = new Date(e.target.value);
                      const diffTime = end - start;
                      const newDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                      
                      // Check for duration change
                      if (originalDays && Math.abs(newDays - originalDays) > 0) {
                        setShowDurationWarning(true);
                        setPendingDuration(newDays);
                      } else {
                        setUiDays(newDays);
                      }
                    }
                  }}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:border-blue-400 focus:outline-none"
                  min={uiStartDate || new Date().toISOString().split('T')[0]}
                />
                {uiEndDate && (
                  <p className="mt-1 text-xs text-white/70">{formatDate(uiEndDate)}</p>
                )}
              </div>
            </div>

            {/* Trip summary */}
            {uiStartDate && uiEndDate && (
              <div className="p-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl border border-blue-400/30 backdrop-blur-sm">
                <div className="text-center">
                  <div className="text-blue-200 font-medium flex items-center justify-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Trip Summary
                  </div>
                  <div className="text-sm text-blue-300 mt-1">
                    {formatDate(uiStartDate)} → {formatDate(uiEndDate)}
                  </div>
                  <div className="text-lg font-bold text-blue-100 mt-1">
                    {uiDays} days
                    {originalDays && uiDays !== originalDays && (
                      <span className="text-xs text-yellow-300 ml-2">
                        (Changed from {originalDays} days)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Duration Change Warning */}
            {showDurationWarning && (
              <div className="p-4 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-xl border border-yellow-400/50 backdrop-blur-sm">
                <div className="text-center">
                  <div className="text-yellow-200 font-medium flex items-center justify-center gap-2 mb-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L5.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    Duration Changed
                  </div>
                  <p className="text-sm text-yellow-100 mb-3">
                    You originally selected <strong>{originalDays} days</strong>, but your new dates span <strong>{pendingDuration} days</strong>.
                    {pendingDuration > originalDays ? ' This extends your trip.' : ' This shortens your trip.'}
                  </p>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={acceptDurationChange}
                      className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      Accept ({pendingDuration} days)
                    </button>
                    <button
                      onClick={rejectDurationChange}
                      className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      Keep Original ({originalDays} days)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Submit button - moved here from bottom */}
            <div className="bg-gradient-to-br from-black/20 to-black/40 backdrop-blur-md p-5 rounded-xl border border-white/20">
              <button
                onClick={() => {
                  console.log('Confirm dates clicked. Start:', uiStartDate, 'End:', uiEndDate);
                  if (uiStartDate || uiEndDate) {
                    handleSubmit(uiStartDate || uiEndDate);
                  }
                }}
                disabled={!uiStartDate && !uiEndDate}
                className="w-full px-8 py-4 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:from-green-600 hover:to-emerald-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                <div className="flex items-center justify-center gap-3">
                  <Calendar className="w-5 h-5" />
                  <span>Confirm Dates</span>
                  {flowState?.durationFlex && uiDateFlex && uiDateFlex !== 'none' && (
                    <span className="text-sm opacity-90">({uiDateFlex} flexibility)</span>
                  )}
                </div>
              </button>
              
              {/* Debug info - smaller and more subtle */}
              <div className="mt-3 text-xs text-white/40 text-center">
                {uiStartDate || 'No start'} • {uiEndDate || 'No end'} • {uiDays} days
              </div>
            </div>
          </div>

          {/* Right Side - Calendar + Flexibility Options */}
          <div className="space-y-4">
            {/* Calendar */}
            <div className="bg-gradient-to-br from-white/5 to-white/10 rounded-xl p-5 backdrop-blur-md border border-white/20">
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => {
                    if (calendarMonth === 0) {
                      setCalendarMonth(11);
                      setCalendarYear(calendarYear - 1);
                    } else {
                      setCalendarMonth(calendarMonth - 1);
                    }
                  }}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-white" />
                </button>
                
                <h3 className="text-lg font-semibold text-white">
                  {new Date(calendarYear, calendarMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h3>
                
                <button
                  onClick={() => {
                    if (calendarMonth === 11) {
                      setCalendarMonth(0);
                      setCalendarYear(calendarYear + 1);
                    } else {
                      setCalendarMonth(calendarMonth + 1);
                    }
                  }}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <ChevronRight className="w-4 h-4 text-white" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="p-2 text-center text-xs font-medium text-white/70">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {generateCalendar().map((day, index) => {
                  const isDisabled = !day || new Date(calendarYear, calendarMonth, day) < new Date().setHours(0,0,0,0);
                  return (
                    <button
                      key={index}
                      onClick={() => handleDateSelect(day)}
                      disabled={isDisabled}
                      className={`p-2 text-sm rounded-lg transition-all ${
                        !day 
                          ? 'invisible' 
                          : isDateSelected(day)
                          ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold shadow-lg'
                          : isDateInRange(day)
                          ? 'bg-blue-300/30 text-blue-200 border border-blue-400/50'
                          : isDisabled
                          ? 'text-white/30 cursor-not-allowed'
                          : 'text-white/90 hover:bg-white/20 hover:scale-110'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>

              {/* Instruction text below calendar */}
              <div className="mt-4 text-xs text-white/60 text-center">
                <p>Click once to set start date, click again to set end date</p>
              </div>
            </div>

            {/* Flexibility options - moved to below calendar */}
            {flowState?.durationFlex && (uiStartDate || uiEndDate) && (
              <div className="bg-gradient-to-br from-white/5 to-white/10 rounded-xl p-5 border border-white/20 backdrop-blur-sm">
                <div className="text-center mb-4">
                  <h3 className="text-sm font-medium text-white/90 flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Date Flexibility Options
                  </h3>
                  <p className="text-xs text-white/60 mt-1">Choose your preferred flexibility level</p>
                </div>
                
                <div className="space-y-3">
                  {[
                    { key: 'start', label: 'Start flexibility', desc: '±2-3 days at beginning', icon: '🏁' },
                    { key: 'end', label: 'End flexibility', desc: '±2-3 days at conclusion', icon: '🏃‍♂️' },
                    { key: 'full', label: 'Full flexibility', desc: 'Throughout entire trip', icon: '🌟' }
                  ].map(option => (
                    <button
                      key={option.key}
                      onClick={() => setUiDateFlex(option.key)}
                      className={`w-full p-3 rounded-lg text-sm transition-all duration-200 ${
                        uiDateFlex === option.key
                          ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg scale-105'
                          : 'bg-white/10 text-white/90 hover:bg-white/20 hover:scale-102'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{option.icon}</span>
                        <div className="flex-1 text-left">
                          <div className="font-medium flex items-center gap-2">
                            {option.label}
                            {uiDateFlex === option.key && <Check className="w-4 h-4" />}
                          </div>
                          <div className="text-xs opacity-75">{option.desc}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Separate pace question with fix option
  if (inputSpec?.type === 'pace') {
    return (
      <div className="space-y-6">
        <div className="text-center text-white/80 text-sm mb-6">What's your preferred travel pace?</div>
        
        <div className="grid grid-cols-2 gap-4">
          {[
            { key: 'relaxed', label: 'Relaxed', desc: 'Take it easy, plenty of downtime' },
            { key: 'moderate', label: 'Moderate', desc: 'Balanced mix of activities and rest' },
            { key: 'fast', label: 'Fast-paced', desc: 'See and do as much as possible' },
            { key: 'fixed', label: 'Fixed Schedule', desc: 'Stick to planned itinerary' }
          ].map(option => (
            <button
              key={option.key}
              onClick={() => setUiPace(option.key)}
              className={`p-4 rounded-xl text-sm transition-all ${
                uiPace === option.key
                  ? 'bg-purple-500 text-white border-2 border-purple-400'
                  : 'bg-white/10 text-white/90 hover:bg-white/20 border-2 border-white/20'
              }`}
            >
              {uiPace === option.key && <Check className="w-4 h-4 inline mr-2" />}
              <div className="font-medium text-base">{option.label}</div>
              <div className="text-xs opacity-75 mt-1">{option.desc}</div>
            </button>
          ))}
        </div>

        <button
          onClick={() => handleSubmit(uiPace)}
          disabled={!uiPace}
          className="w-full px-8 py-3 rounded-full bg-gradient-to-r from-purple-500 to-purple-600 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:from-purple-600 hover:to-purple-700 transition-all duration-200"
        >
          Continue with {uiPace} pace
        </button>
      </div>
    );
  }

  return null;
};

// Render itinerary cards
const ItineraryCards = ({ items }) => {
  const iconFor = (type) => {
    switch ((type || '').toLowerCase()) {
      case 'food': return Utensils;
      case 'activity': return MapPin;
      case 'lodging': return Bed;
      case 'info': return Info;
      case 'tip': return Lightbulb;
      default: return MapPin;
    }
  };
  return (
    <div className="space-y-3">
      {items.map((it, idx) => {
        const Icon = iconFor(it.type);
        return (
          <div key={idx} className="rounded-2xl border border-white/10 bg-black/30 backdrop-blur-md p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 h-8 w-8 rounded-full bg-white/10 grid place-items-center">
                <Icon className="w-4 h-4 text-white/90" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-white font-medium truncate">{it.title || 'Untitled'}</h4>
                  {it.time ? (
                    <span className="inline-flex items-center gap-1 text-xs text-white/80 bg-white/10 rounded-full px-2 py-0.5"><Clock className="w-3 h-3" />{it.time}</span>
                  ) : null}
                </div>
                {it.description ? (
                  <p className="mt-1 text-sm text-white/80 whitespace-pre-wrap">{it.description}</p>
                ) : null}
                {it.type ? (
                  <div className="mt-2 text-[11px] text-white/60 capitalize">{it.type}</div>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const ChatMessage = ({ message, userName }) => {
  const isUser = message.role === 'user';
  const assistantCls = 'w-full max-w-[720px] rounded-[18px] px-6 py-5 text-sm bg-white/6 backdrop-blur-md border border-white/10 text-white shadow-inner';
  const userCls = 'ml-auto inline-block rounded-full px-4 py-2 text-sm font-medium text-white bg-gradient-to-br from-blue-500 to-indigo-600';

  return (
    <div className={`flex items-start gap-4 my-6 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && <Avatar role={message.role} />}
      <div>
        {message.type === 'itinerary-json' && Array.isArray(message.content) ? (
          <div className={assistantCls}>
            <ItineraryCards items={message.content} />
          </div>
        ) : isUser ? (
          <div className={userCls}>{message.content}</div>
        ) : (
          <div>
            <div className={assistantCls}>
              <div className="prose prose-invert prose-p:my-0 prose-headings:my-2 break-words">
                <ReactMarkdown>{String(message.content ?? '')}</ReactMarkdown>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button title="Regenerate" className="h-8 w-8 rounded-md bg-white/6 border border-white/10 grid place-items-center text-white/90 hover:bg-white/10">
                <RefreshCw className="w-4 h-4" />
              </button>
              <button title="Copy" className="h-8 w-8 rounded-md bg-white/6 border border-white/10 grid place-items-center text-white/90 hover:bg-white/10">
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
      {isUser && <Avatar role={message.role} name={userName} />}
    </div>
  );
};

export default function ChatboxStage({ isSidebarOpen = false, setIsSidebarOpen = () => {} }) {
  const { currentUser } = useAuth();
  const fullNameOrEmail = currentUser?.displayName || currentUser?.email || '';
  const shortName = (() => {
    try {
      const raw = (currentUser?.displayName || '').trim();
      const parts = raw ? raw.split(/\s+/).filter(Boolean) : [];
      if (parts.length >= 2) return `${parts[0]} ${parts[parts.length - 1]}`; // first + last
      if (parts.length === 1) return parts[0];
      // fallback to email prefix
      const e = (currentUser?.email || '').split('@')[0];
      return e || 'Guest';
    } catch (e) {
      return (currentUser?.email || 'Guest').split('@')[0];
    }
  })();
  const firstName = (() => {
    const raw = (currentUser?.displayName || currentUser?.email || '').trim();
    if (!raw) return '';
    const parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length) return parts[0];
    return raw.split('@')[0] || raw;
  })();
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [chats, setChats] = useState(() => [{ id: 'default', title: 'New chat', messages: [] }]);
  const searchRef = useRef(null);
  const [activeId, setActiveId] = useState('default');
  const activeChat = useMemo(() => chats.find((c) => c.id === activeId), [chats, activeId]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  // Frontend is a dumb renderer; backend provides stage/inputSpec/quickOptions
  const [inputSpec, setInputSpec] = useState({ type: 'freeText' });
  const [quickOptions, setQuickOptions] = useState([]);
  const [flowState, setFlowState] = useState({});
  const [stage, setStage] = useState('greeting');
  const greetedRef = useRef(new Set());
  const lastAssistantStageRef = useRef({});
  const endRef = useRef(null);
  const sendingRef = useRef(false); // Prevent concurrent sends

  // Debug: Log current state to understand question/option mismatch
  console.log('🔍 ChatboxStage State Debug:', {
    stage,
    inputSpecType: inputSpec?.type,
    inputSpecOptions: inputSpec?.options,
    lastMessage: activeChat?.messages?.slice(-1)[0],
    messagesLength: activeChat?.messages?.length || 0
  });

  // Fix for question/option mismatch: ensure inputSpec matches stage
  useEffect(() => {
    const getExpectedInputForStage = (currentStage) => {
      switch (currentStage) {
        case 'ask_intent':
          return { type: 'options', options: ['I have specific locations', 'I only know a region'] };
        case 'ask_experience':
          return { type: 'options', options: ['Beginner', 'Intermediate', 'Advanced'] };
        case 'ask_duration':
          return { type: 'days' };
        case 'ask_dates':
          return { type: 'dates' };
        case 'ask_travelers':
          return { type: 'options', options: ['Solo Traveler', 'A Couple', 'Family', 'A Group of Friends'] };
        case 'ask_pace':
          return { type: 'options', options: ['Relaxed', 'Balanced', 'Action-Packed', 'Fixed Schedule'] };
        case 'ask_interests':
          return { type: 'multiselect', options: ['History & Museums','Food & Local Cuisine','Adventure & Outdoors','Art & Culture','Nightlife & Entertainment','Shopping','Relaxation & Wellness'] };
        case 'ask_budget':
          return { type: 'options', options: ['Budget-Friendly','Mid-Range','Luxury'] };
        case 'greeting':
          return { type: 'options', options: ['I have specific locations', 'I only know a region'] };
        default:
          return { type: 'freeText' };
      }
    };

    const expectedInput = getExpectedInputForStage(stage);
    
    // If there's a mismatch, fix it
    if (inputSpec?.type !== expectedInput.type) {
      console.log('🔧 Fixing inputSpec mismatch:', {
        currentStage: stage,
        currentInputSpec: inputSpec,
        expectedInput
      });
      setInputSpec(expectedInput);
    }
  }, [stage, inputSpec]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChat?.messages.length, isTyping]);

  const base = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

  const pushMessage = (chatId, role, content) => {
    const makeMsg = (role, content) => {
      if (content && typeof content === 'object' && ('text' in content || 'content' in content) && !Array.isArray(content)) {
        const text = content.content || content.text || '';
        return { role, content: text, ...content };
      }
      return { role, content };
    };

    setChats((prev) => {
      // Find the chat to update
      const chat = prev.find(c => c.id === chatId);
      if (!chat) return prev;

      const msgs = Array.isArray(chat.messages) ? [...chat.messages] : [];
      const newMsg = makeMsg(role, content);
      
      // For user messages, always add them
      if (role === 'user') {
        // Prevent duplicate user messages
        if (msgs.length > 0 && 
            msgs[msgs.length - 1].role === 'user' && 
            msgs[msgs.length - 1].content === newMsg.content) {
          return prev;
        }
        msgs.push(newMsg);
      }
      // For assistant messages
      else if (role === 'assistant') {
        // Add assistant messages unless the previous assistant message is truly identical.
        // Previously we only compared the text (`content`) which caused the UI to drop
        // messages that had identical text but different metadata (for example
        // different `nextStage` or updated `inputSpec`). That prevented the chat
        // flow from visibly progressing. We now compare key metadata too.
        const lastAssistantMsg = [...msgs].reverse().find(m => m.role === 'assistant');
        const suggestionsEqual = (a, b) => JSON.stringify(a || []) === JSON.stringify(b || []);
        const inputSpecEqual = (a, b) => JSON.stringify(a || {}) === JSON.stringify(b || {});

        const shouldAdd = !lastAssistantMsg
          || lastAssistantMsg.content !== newMsg.content
          || lastAssistantMsg.nextStage !== newMsg.nextStage
          || !suggestionsEqual(lastAssistantMsg.suggestions, newMsg.suggestions)
          || !inputSpecEqual(lastAssistantMsg.inputSpec, newMsg.inputSpec);

        if (shouldAdd) {
          msgs.push(newMsg);
        }
      }

      return prev.map(c => c.id === chatId ? { ...c, messages: msgs } : c);
    });
  };

  // This function is now the single source of truth for sending messages.
  // It correctly uses the component's `stage` state and updates it from the server's `stageNext` response.
  async function sendMessage(text = '', stageOverride = undefined) {
  if (sendingRef.current) {
    console.log('Preventing concurrent send');
    return;
  }
  sendingRef.current = true;

  const chatId = activeId;
  const msg = text.trim();

  if (!msg && !stageOverride) {
    sendingRef.current = false;
    return;
  }

  try {
    const prevMessage = activeChat?.messages?.[activeChat.messages.length - 1];
    if (msg && (!prevMessage || prevMessage.role !== 'user' || prevMessage.content !== msg)) {
      pushMessage(chatId, 'user', msg);
    }
    setInput('');
    setIsTyping(true);

    const token = await getFirebaseIdToken();
    const stageToSend = stageOverride || stage || 'greeting';

    const payload = {
      mode: 'chat',
      message: msg,
      stage: stageToSend,
      user: currentUser ? { uid: currentUser.uid, displayName: firstName } : null,
      state: flowState,
    };

    const res = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Server responded with ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    
    // 🔍 Debug logging to trace stage transitions
    console.log("🔎 Server response:", data);
    console.log("➡️ Current stage:", stage, " | Next stage:", data.stageNext);
    
    if (!data?.reply && !data?.message) {
      throw new Error('Invalid server response - no message content');
    }

    const validStages = [
      'greeting',
      'ask_intent',
      'input_locations',
      'input_region',
      'ask_duration',
      'ask_dates',
      'ask_travelers',
      'ask_pace',
      'ask_interests',
      'ask_budget',
      'must_haves',
      'must_nots',
      'generate_suggestions',
      'iterate'
    ];

    if (!data?.stageNext) {
      console.warn('Server response missing stageNext property');
    } else if (!validStages.includes(data.stageNext)) {
      console.warn(`Unexpected stage: ${data.stageNext}`);
    }

    // ✅ Update stage + input BEFORE building assistant message
    if (data?.stageNext && data.stageNext !== stage) {
      setStage(data.stageNext);
    }
    if (data?.input) {
      setInputSpec(data.input);
    }
    if (Array.isArray(data?.quickOptions)) {
      setQuickOptions(data.quickOptions);
    }
    if (data?.state) {
      setFlowState(prev => ({ ...prev, ...data.state }));
    }

    // ✅ Build assistant message with UPDATED values
    const assistantMsg = {
      content: data?.reply || data?.message,
      suggestions: data?.suggestions,
      inputSpec: data?.input,
      currentStage: data?.stageNext || stage,
      nextStage: data?.stageNext,
      hints: data?.hints,
    };

    pushMessage(chatId, 'assistant', assistantMsg);

  } catch (err) {
    console.error('Chat send error:', err);
    pushMessage(chatId, 'assistant', `Sorry, I encountered an error: ${err.message}`);
  } finally {
    setIsTyping(false);
    sendingRef.current = false;
  }
}


  useEffect(() => {
    // This effect is responsible for sending the initial "greeting" message when a new chat is created.
    // It runs when the active chat changes.
    if (activeChat && activeChat.messages.length === 0 && !greetedRef.current.has(activeId)) {
      // We immediately mark this chat ID as "greeted" to prevent this effect from ever running
      // for this chat again.
      greetedRef.current.add(activeId);
      
      // We send a message with an empty text content but a specific 'greeting' stage.
      // The backend will see the 'greeting' stage and know to send the initial welcome message.
      sendMessage('', 'greeting');
    }
    // The dependency array ensures this logic re-evaluates ONLY when the active chat instance changes.
    // The guards inside the 'if' statement prevent it from re-sending the greeting.
  }, [activeId, activeChat]);

  // When user clicks a quick option, immediately move to next stage
  const handleQuick = async (opt) => {
    // Prevent any concurrent actions
    if (isTyping || sendingRef.current) {
      console.log('Preventing concurrent quick option click');
      return;
    }

    // Get both the last user and assistant messages
    const messages = activeChat?.messages || [];
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant');

    // Prevent duplicate submissions
    if (lastUserMsg?.content === opt) {
      console.log('Preventing duplicate quick option submission');
      return;
    }

    // Clear any existing input
    setInput('');

    // Track the current stage to detect if we're stuck
    const currentStage = stage;

    // Special handling for the initial stage transition
    if (currentStage === 'greeting' || currentStage === 'ask_intent') {
      if (opt === 'I have specific locations') {
        await sendMessage(opt, 'input_locations');
      } else if (opt === 'I only know a region') {
        await sendMessage(opt, 'input_region');
      }
      return;
    }

    // For all other options, include the current stage as context
    await sendMessage(opt, currentStage);
  };
  
  const handleKey = (e) => { 
    if (e.key === 'Enter' && !e.shiftKey) { 
      e.preventDefault(); 
      sendMessage(input); 
    } 
  };

  const newChat = () => {
    const id = Math.random().toString(36).slice(2, 9);
    const c = { id, title: 'New chat', messages: [] };
    
    // Reset all states first
    setFlowState({});
    setQuickOptions([]);
    setInputSpec({ type: 'freeText' });
    setStage('greeting');
    setInput('');
    
    // Then update the chat list and active ID
    setChats((p) => [c, ...p]);
    setActiveId(id);
    
    // Clean up any references
    greetedRef.current.delete(id);
    delete lastAssistantStageRef.current[id];
  };

  // Load saved chats & search from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('voyager_chats');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) setChats(parsed);
      }
      const s = localStorage.getItem('voyager_search');
      if (s) setSearch(s);
    } catch (e) {
      console.warn('Failed to load local state', e);
    }
  }, []);

  // Persist chats and search to localStorage
  useEffect(() => {
    try { 
      localStorage.setItem('voyager_chats', JSON.stringify(chats)); 
    } catch (e) { 
      console.error('Failed to save chats:', e);
    }
  }, [chats]);

  useEffect(() => { 
    try { 
      localStorage.setItem('voyager_search', search); 
    } catch (e) {
      console.error('Failed to save search:', e);
    }
  }, [search]);

  // Keyboard shortcut: Ctrl/Cmd+K to focus search
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Handle copy functionality
  const handleCopy = (content) => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(content).then(() => {
        // Could add a toast notification here
      }).catch(err => {
        console.error('Failed to copy:', err);
      });
    }
  };

  // Handle regenerate functionality
  const handleRegenerate = async () => {
    if (!activeChat?.messages?.length) return;
    
    // Find the last user message
    const lastUserMsgIndex = activeChat.messages.findLastIndex(m => m.role === 'user');
    if (lastUserMsgIndex === -1) return;
    
    const lastUserMsg = activeChat.messages[lastUserMsgIndex];
    
    // Remove messages after the last user message
    setChats(prev => prev.map(c => {
      if (c.id !== activeId) return c;
      return {
        ...c,
        messages: c.messages.slice(0, lastUserMsgIndex + 1)
      };
    }));
    
    // Resend the message
    await sendMessage(lastUserMsg.content);
  };

  return (
    <div className="relative h-screen w-full text-white bg-transparent">
      <div className="flex min-h-0">
        {/* Sidebar: full-height column */}
        <aside className={`w-80 border-r border-white/8 bg-gradient-to-b from-black/30 to-black/20 backdrop-blur-xl p-6 flex flex-col items-center min-h-0`} style={{ height: '100vh' }}>
          {/* Centered logo block */}
          <div className="flex flex-col items-center mb-4">
            <div className="h-20 w-20 flex items-center justify-center rounded-2xl bg-white/3 p-3">
              <img src="/logo.png" alt="Voyager" className="h-full w-full object-contain" />
            </div>
            <div className="mt-3 text-2xl font-semibold tracking-tight">Voyager.ai</div>
            <div className="mt-1 text-sm text-white/70">Welcome, {(currentUser?.displayName || currentUser?.email || 'Guest').split(' ')[0]}</div>
          </div>

          {/* Search toggle/button */}
          <div className="w-full mb-4">
            {!searchOpen ? (
              <button 
                onClick={() => { 
                  setSearchOpen(true); 
                  setTimeout(() => searchRef.current?.focus(), 60); 
                }} 
                className="w-full text-left rounded-lg bg-black/40 px-3 py-2 text-sm text-white/80 hover:bg-black/50 transition-colors"
              >
                🔎 Search chats
              </button>
            ) : (
              <div className="flex items-center gap-2 rounded-md bg-black/30 px-2 py-1">
                <Search className="w-4 h-4 text-white/70" />
                <input 
                  ref={searchRef} 
                  placeholder="Search chats" 
                  value={search} 
                  onChange={(e) => setSearch(e.target.value)} 
                  className="bg-transparent outline-none text-sm text-white/80 w-full" 
                />
                <button 
                  onClick={() => { setSearch(''); setSearchOpen(false); }} 
                  className="text-white/60 hover:text-white/80 transition-colors"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          <div className="w-full mb-4">
            <button 
              onClick={newChat} 
              className="w-full text-left rounded-lg bg-gradient-to-r from-[#16a34a] to-[#10b981] px-4 py-2 text-sm font-semibold text-black shadow-sm hover:shadow-md transition-shadow"
            >
              + New Journey
            </button>
          </div>

          <div className="w-full border-t border-white/6 pt-3 mt-2 space-y-2 overflow-y-auto flex-1 min-h-0">
            {(() => {
              const q = search.trim().toLowerCase();
              const visible = q ? chats.filter((c) => (c.title || '').toLowerCase().includes(q)) : chats;
              return visible.map((c) => (
                <div 
                  key={c.id} 
                  className={`rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors ${
                    c.id === activeId ? 'bg-white/6 text-white' : 'text-white/70 hover:bg-white/3'
                  }`} 
                  onClick={() => setActiveId(c.id)}
                >
                  {c.title}
                </div>
              ));
            })()}
          </div>

          {/* Profile / Logout at bottom */}
          <div className="w-full mt-4 pt-3 border-t border-white/6 flex items-center gap-3">
            <div className="flex items-center gap-3">
              <Avatar role="user" name={currentUser?.displayName || currentUser?.email || ''} size={44} />
              <div className="text-sm">
                <div className="font-medium">{shortName}</div>
                <div className="text-xs text-white/60">{currentUser ? 'Member' : 'Not signed in'}</div>
              </div>
            </div>
            <div className="ml-auto">
              {currentUser ? (
                <button 
                  onClick={() => { 
                    try { 
                      signOut(auth); 
                    } catch (e) { 
                      console.error('Sign out error:', e); 
                    } 
                  }} 
                  className="rounded-md p-2 bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <LogOut className="w-4 h-4 text-white" />
                </button>
              ) : null}
            </div>
          </div>
        </aside>

        {/* Main chat area: full-height flex column so input stays at bottom */}
        <main className="flex-1 overflow-hidden relative flex flex-col min-h-0" style={{ height: '100vh' }}>
          <div
            className="flex-1 overflow-y-auto p-8 min-h-0"
            style={{
              // very subtle starlight-style highlight: faint radial dots and inset glow
              backgroundImage: 'radial-gradient(rgba(255,255,255,0.02) 1px, transparent 1px)',
              backgroundSize: '220px 220px',
              boxShadow: 'inset 0 0 40px rgba(255,255,255,0.01)'
            }}
          >
            <div className="mx-auto max-w-3xl pt-2">
              {activeChat?.messages?.map((m, i) => (
                <div key={i}>
                  <ChatMessage message={m} userName={fullNameOrEmail} />
                </div>
              ))}

              {isTyping && (
                <div className="my-4 flex items-start gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 animate-pulse items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
                    <Bot className="h-6 w-6 text-white" />
                  </div>
                  <div className="w-full max-w-[720px] rounded-[18px] px-6 py-5 text-sm bg-white/6 backdrop-blur-md border border-white/10 text-white">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-white/60 rounded-full animate-pulse"></div>
                      <div className="w-2 h-2 bg-white/60 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-2 h-2 bg-white/60 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={endRef} />
            </div>
          </div>

          {/* Composer pinned to bottom inside the main column */}
          <div className="sticky bottom-0 left-0 right-0 flex justify-center pointer-events-none" style={{ paddingBottom: '8px' }}>
            <div className="pointer-events-auto max-w-3xl w-full px-4">
              <AnimatePresence mode="wait">
                {inputSpec && (inputSpec.type === 'options' || inputSpec.type === 'multiselect' || inputSpec.type === 'dates' || inputSpec.type === 'days') ? (
                  <motion.div 
                    key="options-panel" 
                    initial={{ opacity: 0, y: 30 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    exit={{ opacity: 0, y: 30 }} 
                    transition={{ duration: 0.18 }}
                  >
                    <div className="rounded-full bg-white/5 backdrop-blur-md p-3" style={{ boxShadow: '0 0 30px rgba(255,255,255,0.02)' }}>
                      <StageInput
                        inputSpec={inputSpec}
                        quickOptions={quickOptions}
                        flowState={flowState}
                        setFlowState={(s) => setFlowState(s)}
                        onSubmit={async (value) => {
                          // The `StageInput` component now just submits a value.
                          // `sendMessage` handles all the logic of constructing and sending the payload.
                          const messageText = typeof value === 'string' ? value : JSON.stringify(value);
                          await sendMessage(messageText);
                        }}
                      />
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="text-input" 
                    initial={{ opacity: 0, y: 30 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    exit={{ opacity: 0, y: 30 }} 
                    transition={{ duration: 0.18 }}
                  >
                    <div className="rounded-full bg-white/5 backdrop-blur-md p-3 flex items-center gap-3" style={{ boxShadow: '0 0 30px rgba(255,255,255,0.02)' }}>
                      <TextareaAutosize 
                        value={input} 
                        onChange={(e) => setInput(e.target.value)} 
                        onKeyPress={handleKey} 
                        minRows={1} 
                        maxRows={6} 
                        placeholder="Type your message..." 
                        className="w-full resize-none bg-transparent py-3 pl-4 pr-24 text-gray-200 placeholder-gray-400 outline-none text-sm" 
                        disabled={isTyping}
                      />
                      <button 
                        onClick={() => sendMessage(input)} 
                        disabled={isTyping || !input.trim()} 
                        className="ml-auto rounded-full bg-[#19c37d] px-4 py-2 text-black font-semibold hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                      >
                        <Send size={16} />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}