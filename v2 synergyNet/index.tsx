import React from 'react';
import ReactDOM from 'react-dom/client';

const App: React.FC = () => {
  return (
    <div className="app-container" role="main">
      <header className="app-header">
        <h1>Welcome to SynergyNet</h1>
        <p className="tagline">Connecting Local Needs & Offerings. Redefined.</p>
      </header>
      
      <section className="intro-section" aria-labelledby="intro-heading">
        <h2 id="intro-heading" className="visually-hidden">Introduction</h2>
        <p>
          SynergyNet is a forward-thinking P2P platform designed to seamlessly connect local needs with available offerings. 
          Through an avant-garde user experience and AI-powered synergy discovery, we're building a dynamic marketplace 
          for goods, services, ideas, and collaborative opportunities.
        </p>
      </section>

      <section className="core-features" aria-labelledby="features-heading">
        <h2 id="features-heading">Platform Pillars</h2>
        <div className="features-grid">
          <div className="feature-card">
            <h3>Local Marketplace</h3>
            <p>Discover or offer goods and services in your vicinity.</p>
            <button disabled aria-label="Explore local marketplace">Explore (Coming Soon)</button>
          </div>
          <div className="feature-card">
            <h3>Skill Exchange</h3>
            <p>Find collaborators or share your expertise.</p>
            <button disabled aria-label="Explore skill exchange">Connect (Coming Soon)</button>
          </div>
          <div className="feature-card">
            <h3>Community Projects</h3>
            <p>Join or initiate projects that benefit your community.</p>
            <button disabled aria-label="Explore community projects">Participate (Coming Soon)</button>
          </div>
        </div>
      </section>

      <footer className="app-footer">
        <p>&copy; ${new Date().getFullYear()} SynergyNet. All rights reserved.</p>
      </footer>
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  console.error('Failed to find the root element');
}
