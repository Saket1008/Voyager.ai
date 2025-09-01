import React, { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebaseClient';
import { doc, setDoc } from 'firebase/firestore';
import { DNA_QUESTIONS } from '../lib/dnaQuestions';

export default function OnboardingPage({ onDone }) {
  const { currentUser } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [saving, setSaving] = useState(false);

  const isComplete = currentStep >= DNA_QUESTIONS.length;
  const question = useMemo(() => DNA_QUESTIONS[currentStep], [currentStep]);

  function handleAnswer(key, value) {
    const q = DNA_QUESTIONS.find((x) => x.key === key);
    setAnswers((prev) => {
      const next = { ...prev };
      if (q?.isMultiSelect) {
        const prevArr = Array.isArray(prev[key]) ? prev[key] : [];
        const isSelected = prevArr.includes(value);
        let updated = isSelected ? prevArr.filter((v) => v !== value) : [...prevArr, value];
        if (!isSelected && q.maxSelections && updated.length > q.maxSelections) {
          // Enforce max selections quietly
          updated = prevArr; // ignore this extra selection
        }
        next[key] = updated;
      } else {
        next[key] = value;
      }
      return next;
    });
  }

  function handleNext() {
    setCurrentStep((s) => Math.min(DNA_QUESTIONS.length, s + 1));
  }

  function handleBack() {
    setCurrentStep((s) => Math.max(0, s - 1));
  }

  async function handleFinishOnboarding() {
    if (!currentUser || !db) {
      onDone?.();
      return;
    }
    setSaving(true);
    try {
      const ref = doc(db, 'users', currentUser.uid);
      await setDoc(ref, { travelProfile: answers }, { merge: true });
      onDone?.();
    } catch (e) {
      console.error('Failed saving onboarding profile', e);
    } finally {
      setSaving(false);
    }
  }

  const progress = Math.min(currentStep, DNA_QUESTIONS.length) / DNA_QUESTIONS.length;

  return (
    <div className="mx-auto w-full max-w-2xl p-4 text-white">
      <div className="mb-3">
        <div className="text-sm font-semibold">Create your Traveler's DNA</div>
        <div className="mt-2 h-1 w-full overflow-hidden rounded bg-white/10">
          <div className="h-full bg-[#19c37d]" style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="mt-1 text-xs text-white/70">Step {Math.min(currentStep + 1, DNA_QUESTIONS.length)} of {DNA_QUESTIONS.length}</div>
      </div>

      <div className="rounded-xl border border-white/15 bg-white/5 p-4">
        {!isComplete ? (
          <div>
            <div className="mb-3 text-sm font-medium">{question.title}</div>
            <div className="flex flex-wrap gap-2">
              {question.options.map((opt) => {
                const key = question.key;
                const isMulti = !!question.isMultiSelect;
                const selected = isMulti
                  ? (Array.isArray(answers[key]) && answers[key].includes(opt))
                  : answers[key] === opt;
                return (
                  <button
                    key={opt}
                    onClick={() => {
                      handleAnswer(key, opt);
                      if (!question.isMultiSelect) handleNext();
                    }}
                    className={`rounded-md border px-3 py-1 text-xs transition-colors ${
                      selected ? 'border-white bg-white text-black' : 'border-white/20 bg-white/10 hover:bg-white/15'
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex items-center justify-between text-xs">
              <button onClick={handleBack} className="rounded-md border border-white/20 bg-white/10 px-3 py-1 disabled:opacity-50" disabled={currentStep === 0}>Back</button>
              <div className="flex gap-2">
                <button onClick={handleNext} className="rounded-md border border-white/20 bg-white/10 px-3 py-1">
                  {question.isMultiSelect ? 'Next' : 'Skip'}
                </button>
              </div>
            </div>
            {question.isMultiSelect && (
              <div className="mt-2 text-[11px] text-white/60">Select up to {question.maxSelections || 3}. Selected: {Array.isArray(answers[question.key]) ? answers[question.key].length : 0}</div>
            )}
          </div>
        ) : (
          <div>
            <div className="mb-3 text-sm">All set. Save your Traveler's DNA to personalize your itineraries.</div>
            <div className="flex items-center justify-between text-xs">
              <button onClick={handleBack} className="rounded-md border border-white/20 bg-white/10 px-3 py-1">Back</button>
              <button disabled={saving} onClick={handleFinishOnboarding} className="rounded-md border border-white/20 bg-[#19c37d] px-3 py-1 text-black disabled:opacity-50">
                {saving ? 'Saving…' : 'Finish'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
