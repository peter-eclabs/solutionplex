// SolutionPlex Graph Explorer Logic and Data

// 1. Data Store
const problemsData = [
    {
        id: "prob-1",
        name: "Real-time AI Document Scale",
        desc: "Analyzing large document corpuses with LLMs in real-time suffers from high API latency, token limits, and extreme compute costs.",
        icon: "cpu",
        specs: [
            "Target latency: Under 2 seconds per batch",
            "Average file size: 10MB - 100MB PDF files",
            "Requires low cost structure & zero security leaks"
        ],
        complexity: "High",
        reliability: "99.9%",
        solutions: [
            {
                id: "sol-1-1",
                name: "Agentic RAG Pipeline",
                desc: "An intelligent retrieval pipeline using specialized agents to chunk, index, pre-filter, and summarize document sections before calling heavy reasoning LLMs.",
                complexity: "Medium-High",
                reliability: "99.95%",
                specs: [
                    "Sub-second semantic search lookup",
                    "Reduces LLM token costs by up to 73%",
                    "Automatic fallback models on rate limits"
                ],
                arch: [
                    { name: "Retrieval-Augmented Generation (RAG)", desc: "Retrieves document facts dynamically to anchor LLM responses and avoid hallucinations." },
                    { name: "Multi-Agent Orchestration", desc: "Coordinates specialized micro-agents (Router, Filter, Summarizer) for task execution." },
                    { name: "Semantic Chunking", desc: "Splits documents dynamically at shifts in meaning, preserving context." }
                ],
                infra: [
                    { name: "Pinecone Vector DB", desc: "Fully managed vector database for super-fast semantic embedding lookup." },
                    { name: "AWS ECS (Fargate)", desc: "Serverless container compute hosting the agent logic orchestration." },
                    { name: "OpenAI GPT-4o API", desc: "Core generative AI model for reasoning and synthesis." },
                    { name: "Redis Cache", desc: "In-memory caching of recurrent document queries and chunks." }
                ]
            },
            {
                id: "sol-1-2",
                name: "Local LLM Fine-Tuning",
                desc: "Fine-tuning a smaller open-source model (e.g., Llama-3-8B) on document analysis tasks to run locally, eliminating external API costs and resolving data privacy concerns.",
                complexity: "Critical",
                reliability: "99.5%",
                specs: [
                    "Zero external network data leakage",
                    "Optimized for specific internal document schemas",
                    "Significantly cheaper inference at massive volumes"
                ],
                arch: [
                    { name: "LoRA Fine-Tuning", desc: "Low-Rank Adaptation technique to train weights efficiently with low GPU memory." },
                    { name: "Quantized Inference (llama.cpp)", desc: "Loads 4-bit and 8-bit quantized weights to fit models on consumer/mid-range GPUs." },
                    { name: "Batching Inference Engine", desc: "Groups concurrent user requests to run high-throughput parallel compute on active GPUs." }
                ],
                infra: [
                    { name: "RunPod GPU Cloud", desc: "Scalable, on-demand GPU clouds for model training and high-throughput inference." },
                    { name: "vLLM Inference Server", desc: "High-performance LLM deployment engine with PagedAttention and continuous batching." },
                    { name: "Hugging Face Hub", desc: "Secure model registry to version and deploy custom trained weights." }
                ]
            }
        ]
    },
    {
        id: "prob-2",
        name: "Flash Sale Checkout Peak",
        desc: "E-Commerce platform experiences severe system latency and inventory race-conditions during peak traffic surges (e.g., flash sales).",
        icon: "shopping-cart",
        specs: [
            "Peaks up to 150,000 requests per second",
            "Payment checkout flow timing bottlenecks",
            "Strong consistency required for item counts"
        ],
        complexity: "Critical",
        reliability: "99.999%",
        solutions: [
            {
                id: "sol-2-1",
                name: "Event-Driven Microservices",
                desc: "Decouples checkout intakes from slow payment execution pipelines. Orders are pushed to high-throughput message streams and processed asynchronously.",
                complexity: "High",
                reliability: "99.99%",
                specs: [
                    "Isolates checkout requests to protect database limits",
                    "Backpressure handling to scale container pools",
                    "Guaranteed single-execution payment flows"
                ],
                arch: [
                    { name: "Saga Pattern", desc: "Manages distributed transactions across microservices with failure compensation steps." },
                    { name: "CQRS", desc: "Separates write processes from read processes for optimal database performance." },
                    { name: "Transactional Outbox", desc: "Guarantees that state updates and corresponding integration events occur together." }
                ],
                infra: [
                    { name: "Apache Kafka", desc: "Highly-scalable event streaming system acting as the central buffer queue." },
                    { name: "Kubernetes (AWS EKS)", desc: "Auto-scalable pod environments running containerized checkout microservices." },
                    { name: "AWS Aurora PostgreSQL", desc: "Relational transactional database for inventory state tracking." },
                    { name: "Redis Enterprise", desc: "Sub-millisecond global locking system to handle inventory decrements." }
                ]
            },
            {
                id: "sol-2-2",
                name: "Edge-Computing Checkout",
                desc: "Validates and structures order payloads at point-of-presence edge nodes closest to users, drastically reducing database load and response latency.",
                complexity: "Medium",
                reliability: "99.9%",
                specs: [
                    "Time-To-First-Byte (TTFB) reduced to under 50ms",
                    "Mitigates distributed denial of service (DDoS) attempts at the edge",
                    "Highly modular deployment cycle"
                ],
                arch: [
                    { name: "Edge Web Workers", desc: "Small edge server processes running Javascript payloads to process request logic instantly." },
                    { name: "Optimistic Locking Control", desc: "Verifies lock version records to prevent concurrency issues without full table locks." }
                ],
                infra: [
                    { name: "Cloudflare Workers", desc: "Edge runtime compute hosting the checkout validation endpoint." },
                    { name: "Cloudflare D1 (SQLite)", desc: "Global distributed database storing light catalog listings." },
                    { name: "Upstash Redis", desc: "Serverless global cache for instantaneous rate limiting checks." }
                ]
            }
        ]
    }
];

// 2. Application State Management
let appState = {
    currentView: "problem", // "problem" | "solution"
    activeProblemId: "prob-1",
    activeSolutionId: null,
    activeCategory: null, // "arch" | "infra"
    history: []
};

// Dimensions and nodes layout positions
let dimensions = { width: 0, height: 0 };
const NODE_WIDTH = 200;
const NODE_HEIGHT = 80;

// Initialize elements
document.addEventListener("DOMContentLoaded", () => {
    initLayout();
    renderProblemList();
    loadProblem(appState.activeProblemId);
    
    // Resize handler
    window.addEventListener("resize", () => {
        initLayout();
        renderGraph();
    });

    // Reset button
    document.getElementById("btn-reset").addEventListener("click", () => {
        resetView();
    });

    // Close floating list panel
    document.getElementById("floating-panel-close").addEventListener("click", () => {
        closeFloatingPanel();
    });

    // Click outside panel handler
    document.addEventListener("mousedown", (e) => {
        const panel = document.getElementById("floating-list-panel");
        const svg = document.getElementById("graph-svg");
        if (panel.classList.contains("visible") && !panel.contains(e.target) && !svg.contains(e.target)) {
            closeFloatingPanel();
        }
    });
});

// Setup container dimensions
function initLayout() {
    const viewport = document.getElementById("graph-viewport");
    dimensions.width = viewport.clientWidth;
    dimensions.height = viewport.clientHeight;
    
    const svg = document.getElementById("graph-svg");
    svg.setAttribute("width", dimensions.width);
    svg.setAttribute("height", dimensions.height);
}

// 3. Render Navigation Problems
function renderProblemList() {
    const list = document.getElementById("problem-list");
    list.innerHTML = "";
    
    problemsData.forEach(prob => {
        const li = document.createElement("li");
        li.className = `problem-item ${prob.id === appState.activeProblemId ? 'active' : ''}`;
        li.dataset.id = prob.id;
        
        li.innerHTML = `
            <span>${prob.name}</span>
            <span class="problem-item-solutions">
                <i data-lucide="lightbulb" style="width: 12px; height: 12px;"></i>
                ${prob.solutions.length} Solutions
            </span>
        `;
        
        li.addEventListener("click", () => {
            document.querySelectorAll(".problem-item").forEach(item => item.classList.remove("active"));
            li.classList.add("active");
            loadProblem(prob.id);
        });
        
        list.appendChild(li);
    });
    lucide.createIcons();
}

// Load a specific problem
function loadProblem(id) {
    appState.activeProblemId = id;
    appState.currentView = "problem";
    appState.activeSolutionId = null;
    appState.activeCategory = null;
    
    closeFloatingPanel();
    updateBreadcrumbs();
    renderGraph();
    updateDetailPanel("problem", problemsData.find(p => p.id === id));
}

// Reset graph view back to root problem view
function resetView() {
    loadProblem(appState.activeProblemId);
}

// 4. Graph Rendering Logic (SVG calculations)
function renderGraph() {
    const nodesGroup = document.getElementById("nodes-group");
    const connectionsGroup = document.getElementById("connections-group");
    
    // Clear graphics
    nodesGroup.innerHTML = "";
    connectionsGroup.innerHTML = "";
    
    const cx = dimensions.width / 2;
    const cy = dimensions.height / 2;
    
    const activeProblem = problemsData.find(p => p.id === appState.activeProblemId);
    
    if (appState.currentView === "problem") {
        // --- PROBLEM CENTRIC GRAPH ---
        // Render problem node in center
        const parentNode = createNodeData(
            activeProblem.id, 
            activeProblem.name, 
            "problem", 
            cx - NODE_WIDTH/2, 
            cy - NODE_HEIGHT/2, 
            activeProblem.icon || "alert-circle",
            true
        );
        
        drawNode(parentNode);
        
        // Render solution child nodes around it
        const solutions = activeProblem.solutions;
        const radius = Math.min(dimensions.width, dimensions.height) * 0.28;
        
        solutions.forEach((sol, index) => {
            const angle = (index * 2 * Math.PI / solutions.length) + (Math.PI / 2); // Start angle top/bottom
            const x = cx + radius * Math.cos(angle) - NODE_WIDTH/2;
            const y = cy + radius * Math.sin(angle) - NODE_HEIGHT/2;
            
            const childNode = createNodeData(sol.id, sol.name, "solution", x, y, "lightbulb");
            drawNode(childNode);
            
            // Draw connector line
            drawBezierConnector(
                cx, cy, 
                x + NODE_WIDTH/2, y + NODE_HEIGHT/2, 
                "grad-prob-sol", 
                `link-${parentNode.id}-${childNode.id}`
            );
        });
        
    } else if (appState.currentView === "solution") {
        // --- SOLUTION CENTRIC GRAPH ---
        const activeSolution = activeProblem.solutions.find(s => s.id === appState.activeSolutionId);
        
        // Center: Solution Parent Node
        const solNode = createNodeData(
            activeSolution.id, 
            activeSolution.name, 
            "solution", 
            cx - NODE_WIDTH/2, 
            cy - NODE_HEIGHT/2, 
            "lightbulb", 
            true
        );
        drawNode(solNode);
        
        // Left: Back-to-Problem Node
        const leftX = cx - 240 - NODE_WIDTH/2;
        const leftY = cy - NODE_HEIGHT/2;
        const probNode = createNodeData(
            activeProblem.id, 
            activeProblem.name, 
            "problem", 
            leftX, 
            leftY, 
            "arrow-left"
        );
        drawNode(probNode);
        
        // Draw connector Solution -> Problem
        drawBezierConnector(
            cx, cy, 
            leftX + NODE_WIDTH/2, leftY + NODE_HEIGHT/2, 
            "grad-prob-sol", 
            `link-${solNode.id}-${probNode.id}`
        );
        
        // Right Upper: Architecture Category Node
        const rightUpperX = cx + 220 - NODE_WIDTH/2;
        const rightUpperY = cy - 100 - NODE_HEIGHT/2;
        const archNode = createNodeData(
            "cat-arch", 
            "Architecture", 
            "architecture", 
            rightUpperX, 
            rightUpperY, 
            "git-branch"
        );
        drawNode(archNode);
        
        // Draw connector Solution -> Architecture
        drawBezierConnector(
            cx, cy, 
            rightUpperX + NODE_WIDTH/2, rightUpperY + NODE_HEIGHT/2, 
            "grad-sol-arch", 
            `link-${solNode.id}-${archNode.id}`
        );
        
        // Right Lower: Infrastructure Category Node
        const rightLowerX = cx + 220 - NODE_WIDTH/2;
        const rightLowerY = cy + 100 - NODE_HEIGHT/2;
        const infraNode = createNodeData(
            "cat-infra", 
            "Infrastructure", 
            "infrastructure", 
            rightLowerX, 
            rightLowerY, 
            "database"
        );
        drawNode(infraNode);
        
        // Draw connector Solution -> Infrastructure
        drawBezierConnector(
            cx, cy, 
            rightLowerX + NODE_WIDTH/2, rightLowerY + NODE_HEIGHT/2, 
            "grad-sol-infra", 
            `link-${solNode.id}-${infraNode.id}`
        );
    }
    
    // Bind dynamic Lucide icon markup generated inside foreignObject
    lucide.createIcons();
}

// 5. Node and Line creators
function createNodeData(id, label, type, x, y, icon, isParent = false) {
    return { id, label, type, x, y, icon, isParent };
}

function drawNode(node) {
    const nodesGroup = document.getElementById("nodes-group");
    
    // Create foreignObject to allow highly styled HTML elements in SVG
    const foreignObj = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
    
    // Position node
    foreignObj.setAttribute("x", node.x);
    foreignObj.setAttribute("y", node.y);
    foreignObj.setAttribute("width", NODE_WIDTH);
    foreignObj.setAttribute("height", NODE_HEIGHT);
    foreignObj.classList.add("node-wrapper");
    foreignObj.dataset.id = node.id;
    
    // Set custom float delays to node divs to offset animation patterns
    const animDelay = Math.random() * -5;
    
    // Node styling wrapper
    const nodeDiv = document.createElement("div");
    nodeDiv.className = `graph-node-card node-${node.type} ${node.isParent ? 'parent' : ''}`;
    nodeDiv.style.animationDelay = `${animDelay}s`;
    
    let iconClass = `node-icon-bg bg-${node.type}`;
    
    nodeDiv.innerHTML = `
        <div class="${iconClass}">
            <i data-lucide="${node.icon}"></i>
        </div>
        <div class="node-info">
            <span class="node-type-label">${node.type}</span>
            <span class="node-title">${node.label}</span>
        </div>
    `;
    
    // Bind click events on node card
    nodeDiv.addEventListener("click", (e) => {
        e.stopPropagation();
        handleNodeClick(node);
    });
    
    foreignObj.appendChild(nodeDiv);
    nodesGroup.appendChild(foreignObj);
}

// Curved Bezier line constructor
function drawBezierConnector(x1, y1, x2, y2, gradId, lineId) {
    const connectionsGroup = document.getElementById("connections-group");
    
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    
    // Compute control points for a smooth S-curve/Bezier
    const dx = Math.abs(x2 - x1) * 0.5;
    const ctrl1X = x1 + (x2 > x1 ? dx : -dx);
    const ctrl1Y = y1;
    const ctrl2X = x2 + (x2 > x1 ? -dx : dx);
    const ctrl2Y = y2;
    
    const d = `M ${x1} ${y1} C ${ctrl1X} ${ctrl1Y}, ${ctrl2X} ${ctrl2Y}, ${x2} ${y2}`;
    
    path.setAttribute("d", d);
    path.setAttribute("id", lineId);
    path.setAttribute("stroke", `url(#${gradId})`);
    
    // Assign specific link type class for styling fallback stroke colors
    const linkTypeClass = gradId.replace("grad-", "link-");
    path.setAttribute("class", `link-path ${linkTypeClass}`);
    
    connectionsGroup.appendChild(path);
}

// 6. Interaction Event Handlers
function handleNodeClick(node) {
    const activeProblem = problemsData.find(p => p.id === appState.activeProblemId);
    
    if (node.type === "problem") {
        // If in Solution view, click back-to-problem returns to Problem-Centric graph
        if (appState.currentView === "solution") {
            loadProblem(node.id);
        } else {
            // Problem node click inside problem view shows info
            updateDetailPanel("problem", activeProblem);
        }
    } else if (node.type === "solution") {
        // Solution Clicked - Switch to Solution-Centric Graph
        appState.currentView = "solution";
        appState.activeSolutionId = node.id;
        appState.activeCategory = null;
        
        closeFloatingPanel();
        updateBreadcrumbs();
        renderGraph();
        
        const solutionData = activeProblem.solutions.find(s => s.id === node.id);
        updateDetailPanel("solution", solutionData);
        
    } else if (node.type === "architecture" || node.type === "infrastructure") {
        // Category node clicked - Open list of technology items
        appState.activeCategory = node.type === "architecture" ? "arch" : "infra";
        
        const solutionData = activeProblem.solutions.find(s => s.id === appState.activeSolutionId);
        const listItems = node.type === "architecture" ? solutionData.arch : solutionData.infra;
        
        openFloatingPanel(node, listItems);
    }
}

// Breadcrumb indicators updating
function updateBreadcrumbs() {
    const activeProblem = problemsData.find(p => p.id === appState.activeProblemId);
    const breadcrumbProb = document.getElementById("breadcrumb-problem");
    const breadcrumbSol = document.getElementById("breadcrumb-solution");
    
    if (appState.currentView === "problem") {
        breadcrumbProb.innerText = activeProblem.name;
        breadcrumbProb.classList.add("active");
        breadcrumbSol.classList.remove("active");
        breadcrumbSol.innerText = "";
    } else {
        breadcrumbProb.innerText = activeProblem.name;
        breadcrumbProb.classList.remove("active");
        
        const activeSolution = activeProblem.solutions.find(s => s.id === appState.activeSolutionId);
        breadcrumbSol.innerText = activeSolution.name;
        breadcrumbSol.classList.add("active");
    }
}

// 7. Detail Sidebar & Floating Panel Management
function updateDetailPanel(type, data) {
    const placeholder = document.getElementById("detail-placeholder");
    const content = document.getElementById("detail-content");
    
    placeholder.classList.add("hidden");
    content.classList.remove("hidden");
    
    // Update labels and classes based on type
    const badge = document.getElementById("detail-type-badge");
    badge.innerText = type;
    badge.className = `detail-badge type-${type}`;
    
    document.getElementById("detail-title").innerText = data.name;
    document.getElementById("detail-desc").innerText = data.desc;
    
    // Populate characteristics
    const attributesList = document.getElementById("detail-attributes");
    attributesList.innerHTML = "";
    data.specs.forEach(spec => {
        const li = document.createElement("li");
        li.innerHTML = `<i data-lucide="check-circle-2" style="width: 14px; height: 14px; display:inline-block; vertical-align:middle; margin-right: 6px;"></i> <span>${spec}</span>`;
        attributesList.appendChild(li);
    });
    
    // Set metadata values
    document.getElementById("meta-complexity").innerText = data.complexity;
    document.getElementById("meta-reliability").innerText = data.reliability;
    
    lucide.createIcons();
}

// Show the floating items list next to clicked node
function openFloatingPanel(node, items) {
    const panel = document.getElementById("floating-list-panel");
    const title = document.getElementById("floating-panel-title");
    const list = document.getElementById("floating-panel-list");
    
    title.innerText = node.type === "architecture" ? "Architecture Stack" : "Infrastructure Components";
    list.innerHTML = "";
    
    items.forEach(item => {
        const li = document.createElement("li");
        const iconName = node.type === "architecture" ? "layers" : "server";
        li.innerHTML = `
            <i data-lucide="${iconName}" class="list-item-icon color-${node.type}" style="width:14px; height:14px;"></i>
            <span>${item.name}</span>
        `;
        
        li.addEventListener("click", () => {
            // Update the Detail Panel with this specific tech item details!
            updateDetailPanel(node.type, {
                name: item.name,
                desc: item.desc,
                specs: ["Active integration in solution", "Custom enterprise module config"],
                complexity: "Included",
                reliability: "High"
            });
        });
        list.appendChild(li);
    });
    
    // Calculate and apply coordinate positions to anchor panel next to node
    // SVG coordinates mapped inside graph-viewport
    const viewport = document.getElementById("graph-viewport");
    
    // Place panel immediately below or to the side of the node card
    let leftPos = parseFloat(node.x) + NODE_WIDTH + 15;
    let topPos = parseFloat(node.y) - 20;
    
    // Boundaries check to avoid rendering off-screen
    if (leftPos + 300 > dimensions.width) {
        leftPos = parseFloat(node.x) - 300; // Position on left of node
    }
    if (topPos + 280 > dimensions.height) {
        topPos = dimensions.height - 300;
    }
    
    panel.style.left = `${leftPos}px`;
    panel.style.top = `${topPos}px`;
    
    panel.classList.add("visible");
    lucide.createIcons();
}

function closeFloatingPanel() {
    const panel = document.getElementById("floating-list-panel");
    panel.classList.remove("visible");
    appState.activeCategory = null;
}
