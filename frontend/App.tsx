import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { createRoot } from "react-dom/client";
import {
  Profile,
  ServiceListing,
  MatchingResult,
  CoordinationMechanism,
  SystemMetrics,
} from "../shared/types";

// ==================== TYPES FOR AURA INTERFACE ====================

interface AuraNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  intensity: number;
  pulsation: number;
  type: "profile" | "listing" | "need" | "collaboration";
  data: Profile | ServiceListing;
  connections: string[];
  attractionForce: number;
  lastInteraction: Date;
}

interface AuraState {
  nodes: Map<string, AuraNode>;
  activeConnections: Set<string>;
  centerNode: string | null;
  resonanceFilter: ResonanceFilter;
  simulationRunning: boolean;
  zoomLevel: number;
  panOffset: { x: number; y: number };
}

interface ResonanceFilter {
  creativity: number;
  practical: number;
  social: number;
  urgency: number;
  proximity: number;
}

interface InteractionMode {
  type: "explore" | "connect" | "coordinate" | "optimize";
  active: boolean;
  target?: string;
}

// ==================== MAIN AURA APP COMPONENT ====================

const AuraApp: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const animationRef = useRef<number>();

  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [auraState, setAuraState] = useState<AuraState>({
    nodes: new Map(),
    activeConnections: new Set(),
    centerNode: null,
    resonanceFilter: {
      creativity: 0.5,
      practical: 0.5,
      social: 0.5,
      urgency: 0.5,
      proximity: 0.8,
    },
    simulationRunning: true,
    zoomLevel: 1,
    panOffset: { x: 0, y: 0 },
  });

  const [interactionMode, setInteractionMode] = useState<InteractionMode>({
    type: "explore",
    active: false,
  });

  const [selectedNode, setSelectedNode] = useState<AuraNode | null>(null);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(
    null,
  );
  const [isOnboarding, setIsOnboarding] = useState<boolean>(true);
  const [onboardingStep, setOnboardingStep] = useState<number>(0);

  // ==================== INITIALIZATION ====================

  useEffect(() => {
    initializeWebSocket();
    initializeUserProfile();
    startAuraSimulation();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const initializeWebSocket = () => {
    wsRef.current = new WebSocket("ws://localhost:3003");

    wsRef.current.onopen = () => {
      console.log("Connected to coordination network");
    };

    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleRealTimeUpdate(data);
    };

    wsRef.current.onclose = () => {
      console.log("Disconnected from coordination network");
      // Attempt to reconnect
      setTimeout(initializeWebSocket, 3000);
    };
  };

  const initializeUserProfile = async () => {
    try {
      const response = await fetch("/api/profile/current");
      if (response.ok) {
        const profile = await response.json();
        setCurrentProfile(profile);
        setIsOnboarding(false);
      } else {
        setIsOnboarding(true);
      }
    } catch (error) {
      console.error("Failed to load profile:", error);
      setIsOnboarding(true);
    }
  };

  // ==================== AURA SIMULATION ENGINE ====================

  const startAuraSimulation = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const simulate = () => {
      if (auraState.simulationRunning) {
        updateAuraPhysics();
        renderAuraField(ctx);
      }
      animationRef.current = requestAnimationFrame(simulate);
    };

    simulate();
  };

  const updateAuraPhysics = () => {
    setAuraState((prevState) => {
      const newNodes = new Map(prevState.nodes);

      // Apply gravitational forces between nodes
      newNodes.forEach((node, nodeId) => {
        let fx = 0,
          fy = 0;

        // Center attraction force
        if (prevState.centerNode && nodeId !== prevState.centerNode) {
          const center = newNodes.get(prevState.centerNode);
          if (center) {
            const dx = center.x - node.x;
            const dy = center.y - node.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const force = calculateAttractionForce(node, center, distance);

            fx += (dx / distance) * force;
            fy += (dy / distance) * force;
          }
        }

        // Inter-node forces
        newNodes.forEach((otherNode, otherId) => {
          if (nodeId !== otherId) {
            const dx = otherNode.x - node.x;
            const dy = otherNode.y - node.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 0) {
              const attraction = calculateNodeAttraction(node, otherNode);
              const repulsion = calculateNodeRepulsion(
                node,
                otherNode,
                distance,
              );

              const force = attraction - repulsion;
              fx += (dx / distance) * force;
              fy += (dy / distance) * force;
            }
          }
        });

        // Update velocity and position
        node.vx = (node.vx + fx) * 0.8; // Damping
        node.vy = (node.vy + fy) * 0.8;

        node.x += node.vx;
        node.y += node.vy;

        // Update pulsation
        node.pulsation =
          Math.sin(Date.now() / 1000 + parseFloat(nodeId)) * 0.2 + 1;

        // Boundary constraints
        const canvas = canvasRef.current;
        if (canvas) {
          const margin = node.radius;
          node.x = Math.max(margin, Math.min(canvas.width - margin, node.x));
          node.y = Math.max(margin, Math.min(canvas.height - margin, node.y));
        }
      });

      return { ...prevState, nodes: newNodes };
    });
  };

  const renderAuraField = (ctx: CanvasRenderingContext2D) => {
    const canvas = ctx.canvas;

    // Clear canvas with cosmic background
    const gradient = ctx.createRadialGradient(
      canvas.width / 2,
      canvas.height / 2,
      0,
      canvas.width / 2,
      canvas.height / 2,
      Math.max(canvas.width, canvas.height),
    );
    gradient.addColorStop(0, "#0a0a0a");
    gradient.addColorStop(0.5, "#1a1a2e");
    gradient.addColorStop(1, "#16213e");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Render connection lines
    renderConnections(ctx);

    // Render aura nodes
    auraState.nodes.forEach((node) => {
      renderAuraNode(ctx, node);
    });

    // Render interaction effects
    renderInteractionEffects(ctx);

    // Render UI overlays
    renderUIOverlays(ctx);
  };

  const renderAuraNode = (ctx: CanvasRenderingContext2D, node: AuraNode) => {
    const { x, y, radius, color, intensity, pulsation } = node;

    // Outer glow
    const glowGradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 2);
    glowGradient.addColorStop(0, `${color}80`);
    glowGradient.addColorStop(0.7, `${color}40`);
    glowGradient.addColorStop(1, `${color}00`);

    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(x, y, radius * 2 * pulsation, 0, Math.PI * 2);
    ctx.fill();

    // Core orb
    const coreGradient = ctx.createRadialGradient(
      x - radius * 0.3,
      y - radius * 0.3,
      0,
      x,
      y,
      radius * pulsation,
    );
    coreGradient.addColorStop(0, "#ffffff60");
    coreGradient.addColorStop(0.4, color);
    coreGradient.addColorStop(1, "#00000020");

    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.arc(x, y, radius * pulsation, 0, Math.PI * 2);
    ctx.fill();

    // Urgency indicator
    if (node.type === "need" && node.intensity > 0.7) {
      ctx.strokeStyle = "#ff4444";
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(x, y, radius * 1.5 * pulsation, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Node type indicators
    renderNodeTypeIndicator(ctx, node);
  };

  const renderConnections = (ctx: CanvasRenderingContext2D) => {
    auraState.nodes.forEach((node, nodeId) => {
      node.connections.forEach((connectionId) => {
        const targetNode = auraState.nodes.get(connectionId);
        if (targetNode) {
          const strength = calculateConnectionStrength(node, targetNode);

          ctx.strokeStyle = `rgba(100, 200, 255, ${strength * 0.6})`;
          ctx.lineWidth = strength * 3;
          ctx.beginPath();
          ctx.moveTo(node.x, node.y);
          ctx.lineTo(targetNode.x, targetNode.y);
          ctx.stroke();

          // Animated flow particles
          if (auraState.activeConnections.has(`${nodeId}-${connectionId}`)) {
            renderFlowParticles(ctx, node, targetNode);
          }
        }
      });
    });
  };

  const renderNodeTypeIndicator = (
    ctx: CanvasRenderingContext2D,
    node: AuraNode,
  ) => {
    const { x, y, radius, type } = node;

    ctx.fillStyle = "#ffffff";
    ctx.font = `${radius * 0.6}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    let icon = "";
    switch (type) {
      case "profile":
        icon = "👤";
        break;
      case "listing":
        icon = "📦";
        break;
      case "need":
        icon = "🔍";
        break;
      case "collaboration":
        icon = "🤝";
        break;
    }

    ctx.fillText(icon, x, y);
  };

  const renderFlowParticles = (
    ctx: CanvasRenderingContext2D,
    from: AuraNode,
    to: AuraNode,
  ) => {
    const time = Date.now() / 1000;
    const numParticles = 3;

    for (let i = 0; i < numParticles; i++) {
      const t = (time + i * 0.3) % 1;
      const x = from.x + (to.x - from.x) * t;
      const y = from.y + (to.y - from.y) * t;

      ctx.fillStyle = `rgba(100, 200, 255, ${1 - t})`;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const renderInteractionEffects = (ctx: CanvasRenderingContext2D) => {
    if (selectedNode) {
      const { x, y, radius } = selectedNode;

      // Selection ring
      ctx.strokeStyle = "#00ff88";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, radius * 1.8, 0, Math.PI * 2);
      ctx.stroke();

      // Ripple effect
      const time = Date.now() / 1000;
      const rippleRadius = radius * 2 + Math.sin(time * 3) * 10;
      ctx.strokeStyle = `rgba(0, 255, 136, ${0.5 - Math.sin(time * 3) * 0.3})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, rippleRadius, 0, Math.PI * 2);
      ctx.stroke();
    }
  };

  const renderUIOverlays = (ctx: CanvasRenderingContext2D) => {
    // Render any additional UI overlays directly on canvas if needed
  };

  // ==================== INTERACTION HANDLERS ====================

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Find clicked node
    let clickedNode: AuraNode | null = null;
    auraState.nodes.forEach((node) => {
      const distance = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2);
      if (distance <= node.radius) {
        clickedNode = node;
      }
    });

    if (clickedNode) {
      handleNodeClick(clickedNode);
    } else {
      setSelectedNode(null);
    }
  };

  const handleNodeClick = (node: AuraNode) => {
    setSelectedNode(node);

    switch (interactionMode.type) {
      case "explore":
        exploreNode(node);
        break;
      case "connect":
        initiateConnection(node);
        break;
      case "coordinate":
        startCoordination(node);
        break;
      case "optimize":
        optimizeInteraction(node);
        break;
    }
  };

  const exploreNode = (node: AuraNode) => {
    // Show detailed information about the node
    if (node.type === "profile") {
      showProfileDetails(node.data as Profile);
    } else if (node.type === "listing") {
      showListingDetails(node.data as ServiceListing);
    }
  };

  const initiateConnection = (node: AuraNode) => {
    if (currentProfile && node.id !== currentProfile.id) {
      sendConnectionRequest(currentProfile.id, node.id);
    }
  };

  const startCoordination = (node: AuraNode) => {
    if (currentProfile) {
      createCoordinationMechanism(currentProfile.id, node.id);
    }
  };

  const optimizeInteraction = (node: AuraNode) => {
    requestOptimization(node.id);
  };

  // ==================== RESONANCE FILTERING ====================

  const updateResonanceFilter = (filter: Partial<ResonanceFilter>) => {
    setAuraState((prevState) => ({
      ...prevState,
      resonanceFilter: { ...prevState.resonanceFilter, ...filter },
    }));

    // Recalculate node visibility and attraction
    recalculateNodeResonance();
  };

  const recalculateNodeResonance = () => {
    setAuraState((prevState) => {
      const newNodes = new Map(prevState.nodes);

      newNodes.forEach((node) => {
        const resonance = calculateNodeResonance(
          node,
          prevState.resonanceFilter,
        );
        node.intensity = resonance;
        node.attractionForce = resonance * 2;

        // Adjust visibility based on resonance
        if (resonance < 0.3) {
          node.color = node.color.replace(/,\s*[\d.]+\)/, ", 0.3)");
        } else {
          node.color = node.color.replace(/,\s*[\d.]+\)/, ", 1)");
        }
      });

      return { ...prevState, nodes: newNodes };
    });
  };

  const calculateNodeResonance = (
    node: AuraNode,
    filter: ResonanceFilter,
  ): number => {
    let resonance = 0.5; // Base resonance

    if (node.type === "listing") {
      const listing = node.data as ServiceListing;

      // Check tag matching with filter preferences
      if (listing.tags.includes("creative")) {
        resonance += filter.creativity * 0.3;
      }
      if (listing.tags.includes("practical")) {
        resonance += filter.practical * 0.3;
      }
      if (listing.tags.includes("social")) {
        resonance += filter.social * 0.3;
      }

      // Urgency factor
      const hoursOld =
        (Date.now() - listing.createdAt.getTime()) / (1000 * 60 * 60);
      const urgencyFactor = Math.max(0, 1 - hoursOld / 24);
      resonance += filter.urgency * urgencyFactor * 0.2;
    }

    // Proximity factor
    if (currentProfile && node.type === "profile") {
      const profile = node.data as Profile;
      const distance = calculateGeographicDistance(
        currentProfile.location,
        profile.location,
      );
      const proximityFactor = Math.max(0, 1 - distance / 100); // 100km max
      resonance += filter.proximity * proximityFactor * 0.4;
    }

    return Math.min(1, Math.max(0, resonance));
  };

  // ==================== REAL-TIME UPDATES ====================

  const handleRealTimeUpdate = (data: any) => {
    switch (data.type) {
      case "new_profile":
        addProfileToAura(data.profile);
        break;
      case "new_listing":
        addListingToAura(data.listing);
        break;
      case "connection_established":
        establishConnection(data.from, data.to);
        break;
      case "coordination_started":
        highlightCoordination(data.coordinationId);
        break;
      case "system_metrics":
        setSystemMetrics(data.metrics);
        break;
      case "notification":
        addNotification(data.message);
        break;
    }
  };

  const addProfileToAura = (profile: Profile) => {
    const node: AuraNode = {
      id: profile.id,
      x: Math.random() * (canvasRef.current?.width || 800),
      y: Math.random() * (canvasRef.current?.height || 600),
      vx: 0,
      vy: 0,
      radius: 20 + profile.weight * 15,
      color: getProfileColor(profile),
      intensity: profile.weight,
      pulsation: 1,
      type: "profile",
      data: profile,
      connections: [],
      attractionForce: profile.weight,
      lastInteraction: new Date(),
    };

    setAuraState((prevState) => ({
      ...prevState,
      nodes: new Map(prevState.nodes).set(profile.id, node),
    }));
  };

  const addListingToAura = (listing: ServiceListing) => {
    const node: AuraNode = {
      id: listing.id,
      x: Math.random() * (canvasRef.current?.width || 800),
      y: Math.random() * (canvasRef.current?.height || 600),
      vx: 0,
      vy: 0,
      radius: 15,
      color: getListingColor(listing),
      intensity: 0.8,
      pulsation: 1.2,
      type: "listing",
      data: listing,
      connections: [],
      attractionForce: 0.5,
      lastInteraction: new Date(),
    };

    setAuraState((prevState) => ({
      ...prevState,
      nodes: new Map(prevState.nodes).set(listing.id, node),
    }));
  };

  // ==================== ONBOARDING SYSTEM ====================

  const OnboardingFlow = () => {
    if (!isOnboarding) return null;

    const onboardingSteps = [
      {
        title: "Welcome to Your Coordination Cosmos",
        content:
          "This is your personal coordination space where you'll discover and connect with others who can help fulfill your needs and make use of your resources.",
        action: "Begin Journey",
      },
      {
        title: "What are you passionate about offering?",
        content:
          "Tell us about the skills, resources, or services you're excited to share with your community.",
        action: "Continue",
      },
      {
        title: "What challenges are you facing?",
        content:
          "Share the needs, goals, or problems you're looking to address through coordination with others.",
        action: "Continue",
      },
      {
        title: "Your Aura is Taking Shape",
        content:
          "Watch as your unique coordination signature manifests as your personal aura. The brighter and larger it appears, the more coordination potential you have.",
        action: "Enter the Network",
      },
    ];

    const currentStep = onboardingSteps[onboardingStep];

    return (
      <div className="onboarding-overlay">
        <div className="onboarding-modal">
          <h2>{currentStep.title}</h2>
          <p>{currentStep.content}</p>

          {onboardingStep === 1 && (
            <div className="input-section">
              <textarea
                placeholder="I'm great at web development, have a car I can share, love cooking..."
                className="onboarding-input"
              />
            </div>
          )}

          {onboardingStep === 2 && (
            <div className="input-section">
              <textarea
                placeholder="I need help with marketing, looking for a study group, need rides to work..."
                className="onboarding-input"
              />
            </div>
          )}

          <button
            className="onboarding-button"
            onClick={() => {
              if (onboardingStep < onboardingSteps.length - 1) {
                setOnboardingStep(onboardingStep + 1);
              } else {
                completeOnboarding();
              }
            }}
          >
            {currentStep.action}
          </button>
        </div>
      </div>
    );
  };

  const completeOnboarding = () => {
    setIsOnboarding(false);
    // Initialize user's aura in the network
    if (currentProfile) {
      setAuraState((prevState) => ({
        ...prevState,
        centerNode: currentProfile.id,
      }));
    }
  };

  // ==================== UI COMPONENTS ====================

  const ResonanceControls = () => (
    <div className="resonance-controls">
      <h3>Tune Your Resonance</h3>
      <div className="resonance-sliders">
        <div className="slider-group">
          <label>Creative Collaboration</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={auraState.resonanceFilter.creativity}
            onChange={(e) =>
              updateResonanceFilter({ creativity: parseFloat(e.target.value) })
            }
          />
        </div>
        <div className="slider-group">
          <label>Practical Assistance</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={auraState.resonanceFilter.practical}
            onChange={(e) =>
              updateResonanceFilter({ practical: parseFloat(e.target.value) })
            }
          />
        </div>
        <div className="slider-group">
          <label>Social Connection</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={auraState.resonanceFilter.social}
            onChange={(e) =>
              updateResonanceFilter({ social: parseFloat(e.target.value) })
            }
          />
        </div>
        <div className="slider-group">
          <label>Urgent Needs</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={auraState.resonanceFilter.urgency}
            onChange={(e) =>
              updateResonanceFilter({ urgency: parseFloat(e.target.value) })
            }
          />
        </div>
        <div className="slider-group">
          <label>Proximity Preference</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={auraState.resonanceFilter.proximity}
            onChange={(e) =>
              updateResonanceFilter({ proximity: parseFloat(e.target.value) })
            }
          />
        </div>
      </div>
    </div>
  );

  const InteractionModeSelector = () => (
    <div className="interaction-modes">
      <button
        className={`mode-button ${interactionMode.type === "explore" ? "active" : ""}`}
        onClick={() => setInteractionMode({ type: "explore", active: true })}
      >
        🔍 Explore
      </button>
      <button
        className={`mode-button ${interactionMode.type === "connect" ? "active" : ""}`}
        onClick={() => setInteractionMode({ type: "connect", active: true })}
      >
        🤝 Connect
      </button>
      <button
        className={`mode-button ${interactionMode.type === "coordinate" ? "active" : ""}`}
        onClick={() => setInteractionMode({ type: "coordinate", active: true })}
      >
        ⚡ Coordinate
      </button>
      <button
        className={`mode-button ${interactionMode.type === "optimize" ? "active" : ""}`}
        onClick={() => setInteractionMode({ type: "optimize", active: true })}
      >
        🎯 Optimize
      </button>
    </div>
  );

  const SystemMetricsDisplay = () => {
    if (!systemMetrics) return null;

    return (
      <div className="system-metrics">
        <h4>Network Health</h4>
        <div className="metrics-grid">
          <div className="metric">
            <span className="metric-label">Total Utility</span>
            <span className="metric-value">
              {systemMetrics.totalUtility.toFixed(2)}
            </span>
          </div>
          <div className="metric">
            <span className="metric-label">Efficiency</span>
            <span className="metric-value">
              {(systemMetrics.efficiencyScore * 100).toFixed(1)}%
            </span>
          </div>
          <div className="metric">
            <span className="metric-label">Waste Level</span>
            <span className="metric-value">
              {(systemMetrics.wasteLevel * 100).toFixed(1)}%
            </span>
          </div>
          <div className="metric">
            <span className="metric-label">Social Welfare</span>
            <span className="metric-value">
              {systemMetrics.socialWelfare.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const NotificationCenter = () => (
    <div className="notification-center">
      {notifications.map((notification, index) => (
        <div key={index} className="notification">
          {notification}
        </div>
      ))}
    </div>
  );

  const SelectedNodeDetails = () => {
    if (!selectedNode) return null;

    return (
      <div className="selected-node-details">
        <h3>Connection Details</h3>
        {selectedNode.type === "profile" && (
          <ProfileDetailsCard profile={selectedNode.data as Profile} />
        )}
        {selectedNode.type === "listing" && (
          <ListingDetailsCard listing={selectedNode.data as ServiceListing} />
        )}
      </div>
    );
  };

  const ProfileDetailsCard = ({ profile }: { profile: Profile }) => (
    <div className="profile-card">
      <img src={profile.avatar} alt={profile.name} />
      <h4>{profile.name}</h4>
      <div className="profile-stats">
        <span>Reputation: {profile.reputation.overall.toFixed(2)}</span>
        <span>
          Active Connections:{" "}
          {profile.behaviorProfile.interactionPatterns.length}
        </span>
      </div>
      <div className="profile-resources">
        <div className="resource-section">
          <h5>Offers</h5>
          <ul>
            {profile.resources.goods.slice(0, 3).map((good) => (
              <li key={good.id}>{good.name}</li>
            ))}
          </ul>
        </div>
        <div className="resource-section">
          <h5>Needs</h5>
          <ul>
            {profile.resources.needs.slice(0, 3).map((need) => (
              <li key={need.id}>{need.name}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );

  const ListingDetailsCard = ({ listing }: { listing: ServiceListing }) => (
    <div className="listing-card">
      <h4>{listing.title}</h4>
      <p>{listing.description}</p>
      <div className="listing-details">
        <span>Type: {listing.type}</span>
        <span>
          Price:{" "}
          {typeof listing.pricing.basePrice === "number"
            ? `$${listing.pricing.basePrice}`
            : "Negotiable"}
        </span>
      </div>
      <div className="listing-tags">
        {listing.tags.map((tag) => (
          <span key={tag} className="tag">
            {tag}
          </span>
        ))}
      </div>
      <div className="listing-actions">
        <button onClick={() => initiateContact(listing.providerId)}>
          Contact Provider
        </button>
        <button onClick={() => requestOptimization(listing.id)}>
          Optimize Match
        </button>
      </div>
    </div>
  );

  // ==================== UTILITY FUNCTIONS ====================

  const calculateAttractionForce = (
    nodeA: AuraNode,
    nodeB: AuraNode,
    distance: number,
  ): number => {
    const baseForce =
      (nodeA.attractionForce * nodeB.attractionForce) /
      Math.max(distance * distance, 1);
    const resonanceMultiplier = calculateResonanceMultiplier(nodeA, nodeB);
    return baseForce * resonanceMultiplier * 0.01;
  };

  const calculateNodeAttraction = (
    nodeA: AuraNode,
    nodeB: AuraNode,
  ): number => {
    if (nodeA.connections.includes(nodeB.id)) {
      return 0.05; // Existing connections have attraction
    }

    const typeAttraction = calculateTypeAttraction(nodeA.type, nodeB.type);
    const dataAttraction = calculateDataCompatibility(nodeA.data, nodeB.data);

    return (typeAttraction + dataAttraction) * 0.02;
  };

  const calculateNodeRepulsion = (
    nodeA: AuraNode,
    nodeB: AuraNode,
    distance: number,
  ): number => {
    const minDistance = (nodeA.radius + nodeB.radius) * 2;
    if (distance < minDistance) {
      return 0.1 / distance; // Strong repulsion when too close
    }
    return 0.001; // Minimal base repulsion
  };

  const calculateConnectionStrength = (
    nodeA: AuraNode,
    nodeB: AuraNode,
  ): number => {
    const baseStrength = 0.5;
    const recencyBonus = calculateRecencyBonus(
      nodeA.lastInteraction,
      nodeB.lastInteraction,
    );
    const compatibilityBonus = calculateDataCompatibility(
      nodeA.data,
      nodeB.data,
    );

    return Math.min(1, baseStrength + recencyBonus + compatibilityBonus);
  };

  const calculateResonanceMultiplier = (
    nodeA: AuraNode,
    nodeB: AuraNode,
  ): number => {
    return (nodeA.intensity + nodeB.intensity) / 2;
  };

  const calculateTypeAttraction = (typeA: string, typeB: string): number => {
    const attractionMatrix: Record<string, Record<string, number>> = {
      profile: { listing: 0.8, need: 0.6, collaboration: 0.9, profile: 0.3 },
      listing: { profile: 0.8, need: 0.9, collaboration: 0.7, listing: 0.2 },
      need: { profile: 0.6, listing: 0.9, collaboration: 0.8, need: 0.1 },
      collaboration: {
        profile: 0.9,
        listing: 0.7,
        need: 0.8,
        collaboration: 0.5,
      },
    };

    return attractionMatrix[typeA]?.[typeB] || 0.1;
  };

  const calculateDataCompatibility = (dataA: any, dataB: any): number => {
    // Simplified compatibility calculation
    if (!dataA || !dataB) return 0.1;

    if ("resources" in dataA && "resources" in dataB) {
      // Profile-to-profile compatibility
      const profileA = dataA as Profile;
      const profileB = dataB as Profile;

      const skillMatch = calculateSkillOverlap(
        profileA.resources.skills,
        profileB.resources.needs,
      );
      const needMatch = calculateSkillOverlap(
        profileB.resources.skills,
        profileA.resources.needs,
      );

      return (skillMatch + needMatch) / 2;
    }

    return 0.3; // Default compatibility
  };

  const calculateSkillOverlap = (skills: any[], needs: any[]): number => {
    if (!skills.length || !needs.length) return 0;

    const skillNames = skills.map((s) => s.name || s);
    const needNames = needs.map((n) => n.name || n);

    const overlap = skillNames.filter((skill) =>
      needNames.includes(skill),
    ).length;
    return overlap / Math.max(skillNames.length, needNames.length);
  };

  const calculateRecencyBonus = (dateA: Date, dateB: Date): number => {
    const now = Date.now();
    const avgAge = (now - dateA.getTime() + (now - dateB.getTime())) / 2;
    const hoursOld = avgAge / (1000 * 60 * 60);

    return Math.max(0, 0.5 - hoursOld / 24); // Bonus decreases over 24 hours
  };

  const calculateGeographicDistance = (locA: any, locB: any): number => {
    if (!locA || !locB) return 100; // Default to max distance

    const R = 6371; // Earth's radius in km
    const dLat = ((locB.latitude - locA.latitude) * Math.PI) / 180;
    const dLon = ((locB.longitude - locA.longitude) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((locA.latitude * Math.PI) / 180) *
        Math.cos((locB.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const getProfileColor = (profile: Profile): string => {
    const hue =
      Math.abs(profile.id.split("").reduce((a, b) => a + b.charCodeAt(0), 0)) %
      360;
    const saturation = 70 + profile.weight * 30;
    const lightness = 50 + profile.reputation.overall * 20;

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  };

  const getListingColor = (listing: ServiceListing): string => {
    const colorMap: Record<string, string> = {
      goods: "#4ade80",
      service: "#3b82f6",
      collaboration: "#f59e0b",
      social: "#ec4899",
    };

    return colorMap[listing.type] || "#6b7280";
  };

  // ==================== API FUNCTIONS ====================

  const sendConnectionRequest = async (fromId: string, toId: string) => {
    try {
      const response = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromId, toId }),
      });

      if (response.ok) {
        addNotification("Connection request sent!");
      }
    } catch (error) {
      console.error("Failed to send connection request:", error);
      addNotification("Failed to send connection request");
    }
  };

  const createCoordinationMechanism = async (
    initiatorId: string,
    targetId: string,
  ) => {
    try {
      const response = await fetch("/api/coordination", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "collaboration",
          participants: [initiatorId, targetId],
          objectives: [{ type: "utility_maximization", weight: 1 }],
        }),
      });

      if (response.ok) {
        addNotification("Coordination mechanism created!");
      }
    } catch (error) {
      console.error("Failed to create coordination:", error);
    }
  };

  const requestOptimization = async (nodeId: string) => {
    try {
      const response = await fetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId, currentProfile: currentProfile?.id }),
      });

      if (response.ok) {
        const optimization = await response.json();
        addNotification(
          `Optimization suggests: ${optimization.recommendation}`,
        );
      }
    } catch (error) {
      console.error("Failed to request optimization:", error);
    }
  };

  const showProfileDetails = (profile: Profile) => {
    // This would typically open a detailed modal or sidebar
    console.log("Showing profile details:", profile);
  };

  const showListingDetails = (listing: ServiceListing) => {
    // This would typically open a detailed modal or sidebar
    console.log("Showing listing details:", listing);
  };

  const initiateContact = (providerId: string) => {
    if (currentProfile) {
      sendConnectionRequest(currentProfile.id, providerId);
    }
  };

  const establishConnection = (fromId: string, toId: string) => {
    setAuraState((prevState) => {
      const newNodes = new Map(prevState.nodes);
      const fromNode = newNodes.get(fromId);
      const toNode = newNodes.get(toId);

      if (fromNode && toNode) {
        if (!fromNode.connections.includes(toId)) {
          fromNode.connections.push(toId);
        }
        if (!toNode.connections.includes(fromId)) {
          toNode.connections.push(fromId);
        }

        const newActiveConnections = new Set(prevState.activeConnections);
        newActiveConnections.add(`${fromId}-${toId}`);

        return {
          ...prevState,
          nodes: newNodes,
          activeConnections: newActiveConnections,
        };
      }

      return prevState;
    });
  };

  const highlightCoordination = (coordinationId: string) => {
    // Add visual highlighting for active coordination
    addNotification(`New coordination active: ${coordinationId}`);
  };

  const addNotification = (message: string) => {
    setNotifications((prev) => [...prev.slice(-4), message]); // Keep last 5 notifications

    // Auto-remove after 5 seconds
    setTimeout(() => {
      setNotifications((prev) => prev.slice(1));
    }, 5000);
  };

  // ==================== MAIN RENDER ====================

  return (
    <div className="aura-app">
      <canvas
        ref={canvasRef}
        width={window.innerWidth}
        height={window.innerHeight}
        onClick={handleCanvasClick}
        className="aura-canvas"
      />

      <div className="ui-overlay">
        <header className="app-header">
          <h1>Coordination Cosmos</h1>
          {currentProfile && (
            <div className="current-profile">
              <img src={currentProfile.avatar} alt={currentProfile.name} />
              <span>{currentProfile.name}</span>
              <div className="profile-weight">
                Weight: {currentProfile.weight.toFixed(2)}
              </div>
            </div>
          )}
        </header>

        <div className="left-panel">
          <ResonanceControls />
          <InteractionModeSelector />
          <SystemMetricsDisplay />
        </div>

        <div className="right-panel">
          <SelectedNodeDetails />
        </div>

        <div className="bottom-panel">
          <NotificationCenter />
        </div>
      </div>

      <OnboardingFlow />
    </div>
  );
};

// ==================== STYLES ====================

const styles = `
.aura-app {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #0a0a0a;
  font-family: 'Arial', sans-serif;
}

.aura-canvas {
  position: absolute;
  top: 0;
  left: 0;
  cursor: crosshair;
}

.ui-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 10;
}

.ui-overlay > * {
  pointer-events: auto;
}

.app-header {
  position: absolute;
  top: 20px;
  left: 20px;
  right: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: white;
  background: rgba(0, 0, 0, 0.7);
  padding: 15px 20px;
  border-radius: 10px;
  backdrop-filter: blur(10px);
}

.current-profile {
  display: flex;
  align-items: center;
  gap: 10px;
}

.current-profile img {
  width: 40px;
  height: 40px;
  border-radius: 50%;
}

.profile-weight {
  font-size: 0.8em;
  opacity: 0.7;
}

.left-panel {
  position: absolute;
  top: 100px;
  left: 20px;
  width: 300px;
  max-height: calc(100vh - 200px);
  overflow-y: auto;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 10px;
  padding: 20px;
  color: white;
}

.right-panel {
  position: absolute;
  top: 100px;
  right: 20px;
  width: 300px;
  max-height: calc(100vh - 200px);
  overflow-y: auto;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 10px;
  padding: 20px;
  color: white;
}

.bottom-panel {
  position: absolute;
  bottom: 20px;
  left: 20px;
  right: 20px;
  max-height: 150px;
  overflow-y: auto;
}

.resonance-controls h3 {
  margin-bottom: 15px;
  color: #00ff88;
}

.slider-group {
  margin-bottom: 15px;
}

.slider-group label {
  display: block;
  margin-bottom: 5px;
  font-size: 0.9em;
}

.slider-group input[type="range"] {
  width: 100%;
  margin-bottom: 5px;
}

.interaction-modes {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 20px;
}

.mode-button {
  padding: 8px 12px;
  border: none;
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  cursor: pointer;
  transition: all 0.3s;
}

.mode-button:hover {
  background: rgba(255, 255, 255, 0.2);
}

.mode-button.active {
  background: #00ff88;
  color: black;
}

.system-metrics h4 {
  color: #00ff88;
  margin-bottom: 10px;
}

.metrics-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.metric {
  display: flex;
  flex-direction: column;
  padding: 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 5px;
}

.metric-label {
  font-size: 0.8em;
  opacity: 0.7;
}

.metric-value {
  font-size: 1.2em;
  font-weight: bold;
  color: #00ff88;
}

.notification-center {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.notification {
  padding: 10px 15px;
  background: rgba(0, 255, 136, 0.9);
  color: black;
  border-radius: 5px;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.selected-node-details h3 {
  color: #00ff88;
  margin-bottom: 15px;
}

.profile-card, .listing-card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 15px;
}

.profile-card img {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  margin-bottom: 10px;
}

.profile-stats {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin: 10px 0;
  font-size: 0.9em;
  opacity: 0.8;
}

.resource-section h5 {
  color: #00ff88;
  margin: 10px 0 5px 0;
}

.resource-section ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.resource-section li {
  padding: 3px 0;
}

.listing-details {
  display: flex;
  gap: 15px;
  margin: 10px 0;
  font-size: 0.9em;
}

.listing-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin: 10px 0;
}

.tag {
  background: rgba(0, 255, 136, 0.2);
  color: #00ff88;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.8em;
}

.listing-actions {
  display: flex;
  gap: 10px;
  margin-top: 15px;
}

.listing-actions button {
  padding: 8px 12px;
  border: none;
  border-radius: 5px;
  background: #00ff88;
  color: black;
  cursor: pointer;
  font-size: 0.9em;
}

.listing-actions button:hover {
  background: #00cc6a;
}

.onboarding-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.onboarding-modal {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  padding: 40px;
  max-width: 500px;
  text-align: center;
  color: white;
}

.onboarding-modal h2 {
  color: #00ff88;
  margin-bottom: 20px;
}

.onboarding-modal p {
  margin-bottom: 30px;
  line-height: 1.6;
}

.input-section {
  margin: 20px 0;
}

.onboarding-input {
  width: 100%;
  min-height: 100px;
  padding: 15px;
  border: none;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  font-size: 16px;
  resize: vertical;
}

.onboarding-input::placeholder {
  color: rgba(255, 255, 255, 0.6);
}

.onboarding-button {
  background: #00ff88;
  color: black;
  border: none;
  padding: 15px 30px;
  border-radius: 10px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
}

.onboarding-button:hover {
  background: #00cc6a;
  transform: translateY(-2px);
}
`;

// Inject styles
const styleSheet = document.createElement("style");
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);

// ==================== EXPORT ====================

const App: React.FC = AuraApp;

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
