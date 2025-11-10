import { Profile, ServiceListing, GraphNode, GraphEdge } from '../shared/types';

export const createGraphNetwork = () => {
  const nodes: Record<string, GraphNode> = {};
  const edges: GraphEdge[] = [];

  const addNode = (profile: Profile) => {
    const node: GraphNode = {
      id: profile.id,
      profile,
      connections: [],
      weight: 1,
      lastInteraction: new Date(),
    };
    nodes[profile.id] = node;
  };

  const addEdge = (source: string, target: string, weight: number) => {
    const edge = edges.find(
      (e) => e.source === source && e.target === target
    );
    
    if (edge) {
      edge.weight = weight;
      edge.lastUsed = new Date();
    } else {
      edges.push({
        id: `${source}-${target}-${Date.now()}`,
        source,
        target,
        weight,
        lastUsed: new Date(),
      });
    }
  };

  const addListing = (listing: ServiceListing) => {
    // Find potential matches and update graph weights
    Object.values(nodes).forEach((node) => {
      if (node.profile.resources.needs.some(need => 
        listing.tags.includes(need.name)
      )) {
        addEdge(listing.providerId, node.profile.id, 1);
      }
    });
  };

  const optimizeWeights = () => {
    // Implement weight optimization algorithm
    edges.forEach((edge) => {
      const sourceNode = nodes[edge.source];
      const targetNode = nodes[edge.target];
      
      if (sourceNode && targetNode) {
        const timeDiff = Date.now() - edge.lastUsed.getTime();
        const decayFactor = Math.exp(-timeDiff / (1000 * 60 * 60 * 24)); // Daily decay
        edge.weight *= decayFactor;
        
        if (edge.weight < 0.1) {
          // Remove weak edges
          const index = edges.indexOf(edge);
          edges.splice(index, 1);
        }
      }
    });
  };

  const getConnections = (profileId: string) => {
    return edges
      .filter((e) => e.source === profileId || e.target === profileId)
      .map((e) => ({
        profileId: e.source === profileId ? e.target : e.source,
        weight: e.weight,
      }));
  };

  return {
    addNode,
    addEdge,
    addListing,
    optimizeWeights,
    getConnections,
  };
};