import React from 'react';

interface GutIconProps {
  size?: number;
  className?: string;
}

const GutIcon: React.FC<GutIconProps> = ({ size = 24, className = "" }) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M12 21c-3 0-5-2-5-4.5s1.5-3.5 3.5-4 4.5-1.5 4.5-4-2-4.5-5-4.5-5 2-5 4" />
      <path d="M12 3c3 0 5 2 5 4.5s-1.5 3.5-3.5 4-4.5 1.5-4.5 4 2 4.5 5 4.5 5-2 5-4" />
    </svg>
  );
};

export default GutIcon;