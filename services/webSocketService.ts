
import {
  WebSocketProxyStatus,
  WSServerSentMessage,
  WSClientSentMessage,
  WSHttpRequestMessage,
  WSHttpResponseMessage,
  WSStreamStartMessage,
  WSStreamChunkMessage,
  WSStreamEndMessage,
  WSErrorMessage,
  WSPingMessage
} from '../types';

const BASE_WEBSOCKET_URL = process.env.WEBSOCKET_PROXY_URL || "ws://127.0.0.1:5345/v1/ws"; // Target WebSocket URL
const PING_INTERVAL_MS = 25 * 1000; // 25 seconds
const RECONNECT_INITIAL_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 30 * 1000;
const RECONNECT_JITTER_MS = 500;


// Numeric constants for WebSocket readyState
const WS_CONNECTING = 0;
const WS_OPEN = 1;
const WS_CLOSING = 2;
const WS_CLOSED = 3;

let socket: WebSocket | null = null;
let currentStatus: WebSocketProxyStatus = WebSocketProxyStatus.IDLE;
let onStatusChangeCallback: ((status: WebSocketProxyStatus, details?: string) => void) | null = null;
let pingIntervalId: number | null = null;
let reconnectTimeoutId: number | null = null;
let currentReconnectDelay = RECONNECT_INITIAL_DELAY_MS;
let explicitClose = false;
let currentJwtToken: string | null = null;

function updateStatus(newStatus: WebSocketProxyStatus, details?: string) {
  if (currentStatus === newStatus && !details) return; // Avoid redundant updates unless new details are provided
  currentStatus = newStatus;
  if (onStatusChangeCallback) {
    onStatusChangeCallback(currentStatus, details);
  }
  console.log(`WebSocket Proxy Status: ${currentStatus}${details ? ` - ${details}` : ''}`);
}

function sendToServer(message: WSClientSentMessage) {
  if (socket && socket.readyState === WS_OPEN) {
    try {
      const messageString = JSON.stringify(message);
      socket.send(messageString);
      // console.log("WebSocket Proxy: Sent message", message);
    } catch (error) {
      console.error("WebSocket Proxy: Error serializing message for sending:", error, message);
      // Optionally, notify of send error through status update or specific error callback
    }
  } else {
    console.warn("WebSocket Proxy: Cannot send message, socket not open.", message);
  }
}

async function handleHttpRequest(request: WSHttpRequestMessage) {
  const { id, payload } = request;
  let { method, url, headers, body } = payload; // Use let for url as it might be modified

  // Special handling for GET /v1beta/models to remove 'key' query parameter
  if (method === 'GET') {
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.pathname.endsWith('/v1beta/models') || parsedUrl.pathname.endsWith('/v1beta/models/')) {
        if (parsedUrl.searchParams.has('key')) {
          parsedUrl.searchParams.delete('key');
          url = parsedUrl.toString();
          console.log(`WebSocket Proxy: Modified URL for ${id} to remove 'key' param: ${url}`);
        }
      }
    } catch (e) {
      console.error(`WebSocket Proxy: Error parsing URL for modification for request ID ${id}: ${url}`, e);
      // Proceed with original URL if parsing/modification fails
    }
  }


  const fetchOptions: RequestInit = {
    method,
    headers,
  };

  if (method !== 'GET' && method !== 'HEAD') {
    // Only include body if the method is NOT GET or HEAD.
    // An empty string for 'body' on POST/PUT is valid.
    // If 'body' is undefined or null, it won't be included, which is fine.
    if (body !== undefined && body !== null) {
        fetchOptions.body = body;
    }
  }


  try {
    const response = await fetch(url, fetchOptions);

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    if (response.body && typeof response.body.getReader === 'function') { // Check if ReadableStream
      // Stream response
      const streamStartMessage: WSStreamStartMessage = {
        id,
        type: "stream_start",
        payload: { status: response.status, headers: responseHeaders },
      };
      sendToServer(streamStartMessage);

      const reader = response.body.getReader();
      const decoder = new TextDecoder(); // To decode Uint8Array to string

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunkData = decoder.decode(value, { stream: true }); // stream: true for multi-byte characters
        const streamChunkMessage: WSStreamChunkMessage = {
          id,
          type: "stream_chunk",
          payload: { data: chunkData },
        };
        sendToServer(streamChunkMessage);
      }
      // Final empty decode call to flush any remaining bytes from decoder buffer
      const finalChunk = decoder.decode();
      if (finalChunk) {
         const streamChunkMessage: WSStreamChunkMessage = {
          id,
          type: "stream_chunk",
          payload: { data: finalChunk },
        };
        sendToServer(streamChunkMessage);
      }


      const streamEndMessage: WSStreamEndMessage = {
        id,
        type: "stream_end",
        payload: {},
      };
      sendToServer(streamEndMessage);

    } else {
      // Non-stream response
      const responseBodyText = await response.text();
      const httpResponseMessage: WSHttpResponseMessage = {
        id,
        type: "http_response",
        payload: {
          status: response.status,
          headers: responseHeaders,
          body: responseBodyText,
        },
      };
      sendToServer(httpResponseMessage);
    }
  } catch (error) {
    console.error(`WebSocket Proxy: Fetch error for request ID ${id} (${method} ${url}):`, error);
    const errorMessage: WSErrorMessage = {
      id,
      type: "error",
      payload: {
        code: "FETCH_ERROR",
        message: error instanceof Error ? error.message : String(error),
      },
    };
    // If it's an HTTP error from a response, we might already have response details
    // For now, general FETCH_ERROR. More specific HTTP_ERROR could be added if response object is available before throw
    if (error instanceof Response && error.status) { // This check is a bit simplistic
        errorMessage.payload.code = "HTTP_ERROR";
        errorMessage.payload.http_response = {
            status: error.status,
            headers: {}, // TODO: extract headers if possible
            body: await error.text().catch(() => "Could not read error body"),
        };
    }
    sendToServer(errorMessage);
  }
}


function onSocketOpen() {
  updateStatus(WebSocketProxyStatus.CONNECTED);
  currentReconnectDelay = RECONNECT_INITIAL_DELAY_MS; // Reset reconnect delay on successful connection
  if (reconnectTimeoutId) {
    clearTimeout(reconnectTimeoutId);
    reconnectTimeoutId = null;
  }
  startPing();
}

function onSocketMessage(event: MessageEvent) {
  try {
    const message = JSON.parse(event.data as string) as WSServerSentMessage;
    // console.log("WebSocket Proxy: Received message", message);

    switch (message.type) {
      case "http_request":
        handleHttpRequest(message as WSHttpRequestMessage);
        break;
      case "pong":
        // console.log("WebSocket Proxy: Pong received");
        // Pong received, server is alive. No action needed beyond logging if desired.
        break;
      default:
        console.warn("WebSocket Proxy: Received unknown message type", message);
    }
  } catch (error) {
    console.error("WebSocket Proxy: Error parsing message from server or handling it:", error, event.data);
    // Optionally send an error back to server if malformed message is critical, though spec doesn't define this.
  }
}

function onSocketError(event: Event) {
  console.error("WebSocket Proxy: Socket error:", event);
  // onClose will handle reconnection attempts if appropriate
  // No need to updateStatus here as onClose will be called
}

function onSocketClose(event: CloseEvent) {
  stopPing();
  if (reconnectTimeoutId) { // If a reconnect attempt is already scheduled, don't override
    return;
  }

  if (explicitClose) {
    updateStatus(WebSocketProxyStatus.IDLE, `Connection closed by client. Code: ${event.code}`);
    explicitClose = false; // Reset for next connect attempt
  } else {
    updateStatus(WebSocketProxyStatus.DISCONNECTED, `Connection closed. Code: ${event.code}, Reason: ${event.reason || 'N/A'}`);
    scheduleReconnect();
  }
  socket = null;
}

function startPing() {
  stopPing(); // Clear any existing ping interval
  pingIntervalId = window.setInterval(() => {
    const pingMsg: WSPingMessage = { type: "ping" };
    sendToServer(pingMsg);
  }, PING_INTERVAL_MS);
}

function stopPing() {
  if (pingIntervalId) {
    clearInterval(pingIntervalId);
    pingIntervalId = null;
  }
}

function scheduleReconnect() {
  if (explicitClose || !currentJwtToken) { // Don't reconnect if explicitly closed or no token
    updateStatus(WebSocketProxyStatus.IDLE, "Reconnection not attempted (explicit close or no token).");
    return;
  }
  if (reconnectTimeoutId) {
    clearTimeout(reconnectTimeoutId); // Clear existing to avoid multiple stacking up
  }

  const delayWithJitter = currentReconnectDelay + Math.random() * RECONNECT_JITTER_MS;
  updateStatus(WebSocketProxyStatus.RECONNECTING, `Attempting to reconnect in ${Math.round(delayWithJitter / 1000)}s...`);

  reconnectTimeoutId = window.setTimeout(() => {
    reconnectTimeoutId = null; // Clear the ID once the timeout executes
    if (currentJwtToken) { // Ensure token is still set
        connect(currentJwtToken);
    } else {
        updateStatus(WebSocketProxyStatus.IDLE, "Reconnect aborted: JWT token became unavailable.");
    }
  }, delayWithJitter);

  currentReconnectDelay = Math.min(currentReconnectDelay * 2, RECONNECT_MAX_DELAY_MS);
}


function connect(jwtToken: string) {
  if (!jwtToken) {
    updateStatus(WebSocketProxyStatus.ERROR, "JWT Token is required to connect.");
    return;
  }
  currentJwtToken = jwtToken; // Store for reconnects

  if (socket && (socket.readyState === WS_OPEN || socket.readyState === WS_CONNECTING)) {
    console.log("WebSocket Proxy: Already connected or connecting.");
    return;
  }

  explicitClose = false;
  updateStatus(WebSocketProxyStatus.CONNECTING);

  const wsUrl = `${BASE_WEBSOCKET_URL}?auth_token=${jwtToken}`;
  console.log(`WebSocket Proxy: Attempting to connect to ${wsUrl}`);

  try {
    socket = new WebSocket(wsUrl);
  } catch (error) {
    console.error("WebSocket Proxy: Instantiation error:", error);
    updateStatus(WebSocketProxyStatus.ERROR, `Failed to instantiate WebSocket: ${error instanceof Error ? error.message : String(error)}`);
    scheduleReconnect(); // Attempt to reconnect even on instantiation error
    return;
  }

  socket.onopen = onSocketOpen;
  socket.onmessage = onSocketMessage;
  socket.onerror = onSocketError;
  socket.onclose = onSocketClose;
}

function disconnect() {
  explicitClose = true;
  currentJwtToken = null; // Clear token on explicit disconnect
  if (reconnectTimeoutId) {
    clearTimeout(reconnectTimeoutId);
    reconnectTimeoutId = null;
  }
  stopPing();
  if (socket) {
    if (socket.readyState === WS_OPEN || socket.readyState === WS_CONNECTING) {
      socket.close(1000, "Client initiated disconnect"); // 1000 for normal closure
    } else {
      // Socket exists but not in a state to be closed gracefully, just nullify
      onSocketClose({ code: 1000, reason: "Client initiated disconnect on non-open socket", wasClean: true } as CloseEvent);
    }
  } else {
     // No socket, ensure status is IDLE
     updateStatus(WebSocketProxyStatus.IDLE, "Disconnected (no active socket).");
  }
  socket = null; // Ensure socket is cleared
}

function setOnStatusChange(callback: ((status: WebSocketProxyStatus, details?: string) => void) | null) {
  onStatusChangeCallback = callback;
  // Immediately provide current status if a callback is set
  if (onStatusChangeCallback) {
    onStatusChangeCallback(currentStatus);
  }
}

export const webSocketProxyManager = {
  connect,
  disconnect,
  setOnStatusChange,
  // Send is internal to the service for proxying, not exposed directly for arbitrary messages.
};
