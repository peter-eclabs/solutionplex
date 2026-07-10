# Product Requirements Document (PRD)

**Product Name:** Solutionplex  
**Document Version:** 1.1 (MVP)  
**Date:** July 2026  

## 1. Product Overview
Solutionplex is an internal knowledge base and collaborative solution-mapping application. It serves as a centralized hub to document business/technical problems and link them directly to proposed solutions, architectural designs, and infrastructure requirements.

**Objective:**
To create a structured environment where problem identification (the "why") is clearly separated from, yet strictly linked to, system design (the "how"). Solutionplex also serves a secondary marketing purpose, allowing clients to view the company's rigorous, transparent problem-solving methodology.

## 2. Data Model & Relationships
The core value of Solutionplex is the "Plex"—the interconnected relationships between entities:

* **Problem to Solution:** 1-to-Many (1:N). A single problem can have multiple proposed solutions.
* **Solution to Problem:** 1-to-1 (1:1). A specific solution card must be tied to one specific problem statement.
* **Solution to Architecture/Infrastructure:** 1-to-Many (1:N). A solution card can select and implement multiple architectural patterns and infrastructure stacks.

## 3. Feature Requirements: The 4 Tabs

### 3.1. Problems Tab
* **Purpose:** To define and illustrate problem statements.
* **Card Data:** Title, Description.
* **Logic:**
  * Users (Empiricists) create Problem Cards.
  * If a problem has an associated solution(s), the UI must display a link or mention of the Solution(s) inside the Problem Card.

### 3.2. Solutions Tab
* **Purpose:** To propose rational solutions that directly address items in the Problems tab.
* **Card Data:** Title, Description.
* **Logic:**
  * Users (Rationalists) create Solution Cards.
  * *Requirement:* Creating a solution card mandates the user to select an existing Problem Statement from a dropdown/list.
  * *Requirement:* The creation flow must include dropdowns for "Architecture" and "Infrastructure" where the Rationalist can select multiple existing stacks to associate with the solution.

### 3.3. Architecture Tab
* **Purpose:** A repository of architectural patterns and system designs.
* **Card Data:** Title (Name of architecture), Description (Specific working and details).
* **Logic:**
  * Created by Rationalists.
  * These cards populate the Architecture dropdown in the Solutions tab.

### 3.4. Infrastructure Tab
* **Purpose:** A repository of infrastructure stacks, tools, and environments.
* **Card Data:** Title (Name of infrastructure), Description (Specifics and usage).
* **Logic:**
  * Created by Rationalists.
  * These cards populate the Infrastructure dropdown in the Solutions tab.

### 3.5. Apps Tab
* **Purpose:** To showcase and link functional prototypes built for specific problem statements.
* **Card Data:** Title, Description, GitHub URL (Required), Live URL (Optional).
* **Logic:**
  * Created by Rationalists.
  * **Requirement:** Creating an App card mandates the user to select the specific Problem Statement the prototype addresses.
  * **GitHub Integration:** The frontend/backend will utilize the GitHub API to fetch and dynamically render the `README.md` file from the provided repository URL directly within the card.
  * **Live Redirection:** If the optional Live URL is provided, a call-to-action button (e.g., "Launch App") will be displayed, redirecting the user to the deployed prototype in a new tab.

## 4. Search and Discovery (MVP)
* **Functionality:** Simple keyword/word-match search.
* **Scope:** Search will be scoped to the active tab (e.g., searching while on the Problems tab only returns Problem cards).

## 5. Technical Stack
* **Frontend:** React (for building the dynamic, tab-based user interface).
* **Backend Framework:** FastAPI (Python-based, high-performance API framework to handle data relationships, CRUD operations, and RBAC).
* **Backend Language:** Python.
* **Server:** UV Server (an ultra-fast Python ASGI web server to run the FastAPI application).
* **Database:** MongoDB (NoSQL database, highly flexible for storing document-based card data and mapping complex 1:N relationships between the tabs).

## 6. Future Scope (Post-MVP)
* **Semantic Search:** Upgrading from basic word match to AI-driven semantic search to find related concepts across all tabs.
* **Expanded Card Metadata:** Adding fields such as Status (Draft, Approved, Implemented), Tags, Timestamps, and Creator ID as the platform scales.