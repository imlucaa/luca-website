'use client';

import { useState, useEffect } from 'react';
import { BentoCard } from '@/components/ui/BentoCard';
import { Clock } from 'lucide-react';

export function TimeCard() {
  const [time, setTime] = useState('00:00');
  const [seconds, setSeconds] = useState('00');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const secs = now.getSeconds().toString().padStart(2, '0');
      setTime(`${hours}:${minutes}`);
      setSeconds(secs);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <BentoCard className="time-card">
      <span className="text-label">Local Time</span>
      <div className="time-card-content">
        <div className="time-display">
          {time}
          <span className="time-seconds">:{seconds}</span>
        </div>
        <div className="time-location">
          <Clock className="w-3 h-3 opacity-50" />
          <span>Sydney, AU</span>
        </div>
      </div>
    </BentoCard>
  );
}
