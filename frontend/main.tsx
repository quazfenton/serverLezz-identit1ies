import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

// Import the main App component
import AuraApp from "./App";

// ==================== ERROR BOUNDARY ====================

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("🚨 Coordination System Error:", error);
    console.error("Error Info:", errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // In production, you might want to send this to an error reporting service
    if (process.env.NODE_ENV === "production") {
      // Send to error reporting service
      console.log("Would send error to reporting service in production");
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-container">
            <h1>⚠️ Coordination System Error</h1>
            <p>
              Something went wrong in the advanced coordination system. Please
              refresh the page to reinitialize.
            </p>
            <details>
              <summary>Technical Details</summary>
              <pre>{this.state.error?.stack}</pre>
              <pre>{this.state.errorInfo?.componentStack}</pre>
            </details>
            <button
              onClick={() => window.location.reload()}
              className="restart-button"
            >
              🔄 Restart Coordination System
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ==================== DEVELOPMENT HELPERS ====================

const setupDevelopmentHelpers = () => {
  if (process.env.NODE_ENV === "development") {
    // Add development-specific logging and debugging tools
    console.log("🔧 Development Mode: Coordination Cosmos");
    console.log("🚀 Advanced Systems Loading...");

    // Performance monitoring in development
    if ("performance" in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === "navigation") {
            console.log("📊 Navigation Performance:", {
              loadTime: entry.loadEventEnd - entry.loadEventStart,
              domContentLoaded:
                entry.domContentLoadedEventEnd -
                entry.domContentLoadedEventStart,
              type: entry.type,
            });
          }
        }
      });

      observer.observe({ entryTypes: ["navigation"] });
    }

    // Add global debug helpers
    (window as any).coordinationDebug = {
      version: "1.0.0",
      build: "development",
      features: [
        "AI-Enhanced Coordination",
        "Real-time Optimization",
        "Advanced Aura Interface",
        "Symbiotic Matching",
        "Multi-dimensional Network Analysis",
      ],
      logs: {
        performance: true,
        websocket: true,
        optimization: true,
        ai: true,
      },
    };
  }
};

// ==================== APP INITIALIZATION ====================

const initializeApp = async () => {
  try {
    // Setup development helpers
    setupDevelopmentHelpers();

    // Get the root element
    const rootElement = document.getElementById("root");

    if (!rootElement) {
      throw new Error(
        "Root element not found. Cannot initialize Coordination System.",
      );
    }

    // Create React root
    const root = createRoot(rootElement);

    // Add app-ready class to body for CSS transitions
    document.body.classList.add("app-ready");

    // Render the app with error boundary
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <AuraApp />
        </ErrorBoundary>
      </React.StrictMode>,
    );

    console.log("✅ Coordination Cosmos Successfully Initialized");
    console.log("🌟 Advanced AI-Enhanced Coordination Network Active");
    console.log("⚡ Real-time Symbiotic Matching Enabled");
    console.log("🎯 Multi-dimensional Optimization Systems Online");

    // Hide loading screen if it's still visible
    const loadingElement = document.getElementById("loading");
    if (loadingElement) {
      setTimeout(() => {
        loadingElement.style.opacity = "0";
        setTimeout(() => {
          loadingElement.style.display = "none";
        }, 500);
      }, 1000);
    }
  } catch (error) {
    console.error("❌ Failed to initialize Coordination System:", error);

    // Show fallback error UI
    const rootElement = document.getElementById("root");
    if (rootElement) {
      rootElement.innerHTML = `
        <div class="initialization-error">
          <h1>🚨 System Initialization Failed</h1>
          <p>The Advanced Coordination System failed to start.</p>
          <p>Error: ${error instanceof Error ? error.message : "Unknown error"}</p>
          <button onclick="window.location.reload()">🔄 Retry Initialization</button>
        </div>
      `;
    }
  }
};

// ==================== BROWSER COMPATIBILITY CHECK ====================

const checkBrowserCompatibility = (): boolean => {
  const requirements = {
    webgl: !!window.WebGLRenderingContext,
    websocket: !!window.WebSocket,
    canvas: !!document.createElement("canvas").getContext,
    es6: typeof Symbol !== "undefined",
    fetch: typeof fetch !== "undefined",
  };

  const incompatible = Object.entries(requirements)
    .filter(([, supported]) => !supported)
    .map(([feature]) => feature);

  if (incompatible.length > 0) {
    console.warn("⚠️ Browser compatibility issues detected:", incompatible);

    // Show compatibility warning but still try to load
    const warningMessage = `
      Your browser may not fully support all features of the Advanced Coordination System.
      Missing: ${incompatible.join(", ")}

      For the best experience, please use a modern browser like Chrome, Firefox, or Safari.
    `;

    if (process.env.NODE_ENV === "development") {
      console.warn(warningMessage);
    }

    return false;
  }

  return true;
};

// ==================== STARTUP SEQUENCE ====================

const startCoordinationSystem = async () => {
  try {
    console.log("🌟 Starting Advanced Coordination System...");

    // Check browser compatibility
    const isCompatible = checkBrowserCompatibility();

    if (!isCompatible) {
      console.warn("⚠️ Some features may not work optimally in this browser");
    }

    // Wait for DOM to be ready
    if (document.readyState === "loading") {
      await new Promise((resolve) => {
        document.addEventListener("DOMContentLoaded", resolve);
      });
    }

    // Initialize the React application
    await initializeApp();
  } catch (error) {
    console.error("💥 Critical startup error:", error);

    // Last resort error handling
    document.body.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%);
        color: white;
        font-family: 'Inter', sans-serif;
        text-align: center;
        padding: 20px;
      ">
        <h1 style="color: #ff4444; margin-bottom: 20px;">💥 Critical System Error</h1>
        <p>The Advanced Coordination System encountered a critical error and cannot start.</p>
        <p style="margin: 20px 0; opacity: 0.7;">Please refresh the page or contact support if the problem persists.</p>
        <button
          onclick="window.location.reload()"
          style="
            background: linear-gradient(135deg, #00ff88, #00ccff);
            color: black;
            border: none;
            padding: 15px 30px;
            border-radius: 10px;
            font-weight: bold;
            cursor: pointer;
            font-size: 16px;
          "
        >
          🔄 Reload System
        </button>
      </div>
    `;
  }
};

// ==================== LAUNCH ====================

// Start the coordination system
startCoordinationSystem();

// Handle hot module replacement in development
if (import.meta.hot) {
  import.meta.hot.accept();
}

// Export for debugging purposes
export { ErrorBoundary, setupDevelopmentHelpers };
