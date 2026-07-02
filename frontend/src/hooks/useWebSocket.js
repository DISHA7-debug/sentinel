import { useEffect, useRef, useState, useCallback } from "react";

const RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECT_DELAY_MS = 15000;

export function useWebSocket(url) {
  const ws = useRef(null);
  const reconnectTimer = useRef(null);
  const reconnectAttempts = useRef(0);
  const mounted = useRef(true);
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);

  const connect = useCallback(() => {
    if (!url || !mounted.current) return;

    try {
      ws.current = new WebSocket(url);
    } catch {
      scheduleReconnect();
      return;
    }

    ws.current.onopen = () => {
      if (!mounted.current) return;
      reconnectAttempts.current = 0;
      setConnected(true);
    };

    ws.current.onclose = () => {
      if (!mounted.current) return;
      setConnected(false);
      scheduleReconnect();
    };

    ws.current.onerror = () => {
      ws.current?.close();
    };

    ws.current.onmessage = (e) => {
      if (!mounted.current) return;
      setLastMessage(e.data);
    };
  }, [url]);

  const scheduleReconnect = useCallback(() => {
    if (!mounted.current) return;
    clearTimeout(reconnectTimer.current);
    const delay = Math.min(
      RECONNECT_DELAY_MS * Math.pow(1.5, reconnectAttempts.current),
      MAX_RECONNECT_DELAY_MS
    );
    reconnectAttempts.current += 1;
    reconnectTimer.current = setTimeout(connect, delay);
  }, [connect]);

  useEffect(() => {
    mounted.current = true;
    connect();
    return () => {
      mounted.current = false;
      clearTimeout(reconnectTimer.current);
      ws.current?.close();
    };
  }, [connect]);

  const sendMessage = useCallback((msg) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(msg);
      return true;
    }
    return false;
  }, []);

  return { lastMessage, sendMessage, connected };
}
