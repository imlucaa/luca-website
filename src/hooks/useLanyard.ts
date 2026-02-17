'use client';

import { useState, useEffect, useRef } from 'react';
import { DISCORD_ID } from '@/lib/constants';
import type { LanyardData, LanyardWebSocketMessage } from '@/lib/types';

export function useLanyard() {
  const [data, setData] = useState<LanyardData | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let mounted = true;

    const connectWebSocket = () => {
      try {
        const ws = new WebSocket('wss://api.lanyard.rest/socket');
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('Lanyard WebSocket connected');
        };

        ws.onmessage = (event) => {
          if (!mounted) return;

          try {
            const message: LanyardWebSocketMessage = JSON.parse(event.data);

            switch (message.op) {
              case 1: // Hello
                const helloData = message.d as { heartbeat_interval: number };
                // Send initial subscribe
                ws.send(
                  JSON.stringify({
                    op: 2,
                    d: {
                      subscribe_to_id: DISCORD_ID,
                    },
                  })
                );

                // Setup heartbeat
                if (heartbeatRef.current) {
                  clearInterval(heartbeatRef.current);
                }
                heartbeatRef.current = setInterval(() => {
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ op: 3 }));
                  }
                }, helloData.heartbeat_interval);
                break;

              case 0: // Event
                if (message.t === 'INIT_STATE' || message.t === 'PRESENCE_UPDATE') {
                  const presenceData = message.d as LanyardData;
                  setData(presenceData);
                  setError(null);
                  setIsLoading(false);
                }
                break;
            }
          } catch (err) {
            console.error('Error parsing WebSocket message:', err);
          }
        };

        ws.onerror = (event) => {
          console.error('Lanyard WebSocket error:', event);
          if (mounted) {
            setError(new Error('WebSocket connection error'));
          }
        };

        ws.onclose = () => {
          console.log('Lanyard WebSocket closed');
          if (heartbeatRef.current) {
            clearInterval(heartbeatRef.current);
            heartbeatRef.current = null;
          }

          // Reconnect after 3 seconds if still mounted
          if (mounted) {
            setTimeout(() => {
              if (mounted) {
                connectWebSocket();
              }
            }, 3000);
          }
        };
      } catch (err) {
        console.error('Error creating WebSocket:', err);
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Failed to connect to Lanyard'));
          setIsLoading(false);
        }
      }
    };

    connectWebSocket();

    return () => {
      mounted = false;
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return { data, error, isLoading };
}
