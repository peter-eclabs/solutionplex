import { useState } from 'react';
import './App.css';
import { ProblemsTab } from './components/ProblemsTab';
import { SolutionsTab } from './components/SolutionsTab';
import { ArchitectureTab } from './components/ArchitectureTab';
import { InfrastructureTab } from './components/InfrastructureTab';
import { AppsTab } from './components/AppsTab';

export type Tab = 'problems' | 'solutions' | 'architecture' | 'infrastructure' | 'apps';

export interface TabInfo {
  id: Tab;
  label: string;
}

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('problems');
  const [searchQuery, setSearchQuery] = useState('');

  const tabs: TabInfo[] = [
    { id: 'problems', label: 'Problems' },
    { id: 'solutions', label: 'Solutions' },
    { id: 'architecture', label: 'Architecture' },
    { id: 'infrastructure', label: 'Infrastructure' },
    { id: 'apps', label: 'Apps' },
  ];

  const handleTabChange = (tabId: Tab) => {
    setActiveTab(tabId);
    setSearchQuery('');
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo-group">
          <span className="logo-icon">⎔</span>
          <h1>Solutionplex</h1>
          <span className="badge">MVP</span>
        </div>

        <div className="search-group">
          <input
            type="text"
            placeholder={`Search ${tabs.find((t) => t.id === activeTab)?.label}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
      </header>

      <nav className="tab-navigation">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="main-content">
        {activeTab === 'problems' && (
          <div className="tab-view">
            <ProblemsTab searchQuery={searchQuery} />
          </div>
        )}
        {activeTab === 'solutions' && (
          <div className="tab-view">
            <SolutionsTab searchQuery={searchQuery} />
          </div>
        )}
        {activeTab === 'architecture' && (
          <div className="tab-view">
            <ArchitectureTab searchQuery={searchQuery} />
          </div>
        )}
        {activeTab === 'infrastructure' && (
          <div className="tab-view">
            <InfrastructureTab searchQuery={searchQuery} />
          </div>
        )}
        {activeTab === 'apps' && (
          <div className="tab-view">
            <AppsTab searchQuery={searchQuery} />
          </div>
        )}
      </main>
    </div>
  );
}

