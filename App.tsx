import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import WelcomeScreen from './screens/WelcomeScreen';
import OnboardingWizard from './screens/OnboardingWizard';
import DashboardScreen from './screens/DashboardScreen';
import { UserProfile } from './types';

// Wrapper to allow usage of useNavigate within the Router context
const OnboardingRoute: React.FC<{ onComplete: (p: UserProfile) => void }> = ({ onComplete }) => {
  const navigate = useNavigate();
  return (
    <OnboardingWizard 
      onComplete={(profile) => {
        onComplete(profile);
        navigate('/dashboard', { replace: true });
      }} 
    />
  );
};

const App: React.FC = () => {
  // Global State for User Profile
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // Initialize from local storage if available
  useEffect(() => {
    const stored = localStorage.getItem('guthealth_profile');
    if (stored) {
        try {
            setUserProfile(JSON.parse(stored));
        } catch (e) { console.error("Failed to parse profile", e); }
    }
  }, []);

  const handleOnboardingComplete = (profile: UserProfile) => {
      setUserProfile(profile);
      localStorage.setItem('guthealth_profile', JSON.stringify(profile));
  };

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<WelcomeScreen />} />
        <Route 
            path="/onboarding" 
            element={<OnboardingRoute onComplete={handleOnboardingComplete} />} 
        />
        <Route 
            path="/dashboard" 
            element={
                userProfile 
                ? <DashboardScreen userProfile={userProfile} /> 
                : <Navigate to="/onboarding" replace />
            } 
        />
      </Routes>
    </HashRouter>
  );
};

export default App;