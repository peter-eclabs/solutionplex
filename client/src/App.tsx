import { useState, useEffect } from 'react';
import './App.css';
import { ProblemsTab } from './components/ProblemsTab';
import { SolutionsTab } from './components/SolutionsTab';
import { ArchitectureTab } from './components/ArchitectureTab';
import { InfrastructureTab } from './components/InfrastructureTab';
import { AppsTab } from './components/AppsTab';
import { DetailView } from './components/DetailView';

export type Tab = 'problems' | 'solutions' | 'architecture' | 'infrastructure' | 'apps';

export interface TabInfo {
  id: Tab;
  label: string;
}

function parseRoute(pathname: string): { component: Tab; id: string } | null {
  const match = pathname.match(/^\/(problems|problem|solutions|solution|architecture|architectures|infrastructure|infrastructures|apps|app)\/([a-zA-Z0-9_-]+)$/);
  if (!match) return null;
  
  let component = match[1];
  const id = match[2];
  
  if (component === 'problem') component = 'problems';
  if (component === 'solution') component = 'solutions';
  if (component === 'architectures') component = 'architecture';
  if (component === 'infrastructures') component = 'infrastructure';
  if (component === 'app') component = 'apps';
  
  return { component: component as Tab, id };
}

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('problems');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (to: string) => {
    window.history.pushState(null, '', to);
    setCurrentPath(to);
  };

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
    navigate('/');
  };

  const routeInfo = parseRoute(currentPath);

  // Sync active tab with parsed route component so when user returns, they land on correct tab
  useEffect(() => {
    if (routeInfo) {
      setActiveTab(routeInfo.component);
    }
  }, [currentPath]);

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo-group" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <span className="logo-icon">⎔</span>
          <h1>Solutionplex</h1>
          <span className="badge">MVP</span>
        </div>

        {!routeInfo && (
          <div className="search-group">
            <input
              type="text"
              placeholder={`Search ${tabs.find((t) => t.id === activeTab)?.label}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
        )}
      </header>

      {!routeInfo && (
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
      )}

      <main className="main-content">
        {routeInfo ? (
          <DetailView
            component={routeInfo.component}
            id={routeInfo.id}
            onNavigate={navigate}
          />
        ) : (
          <>
            {activeTab === 'problems' && (
              <div className="tab-view">
                <ProblemsTab
                  searchQuery={searchQuery}
                  onCardClick={(id) => navigate(`/problems/${id}`)}
                  onCardClickSolution={(id) => navigate(`/solutions/${id}`)}
                />
              </div>
            )}
            {activeTab === 'solutions' && (
              <div className="tab-view">
                <SolutionsTab
                  searchQuery={searchQuery}
                  onCardClick={(id) => navigate(`/solutions/${id}`)}
                  onCardClickProblem={(id) => navigate(`/problems/${id}`)}
                  onCardClickArch={(id) => navigate(`/architecture/${id}`)}
                  onCardClickInfra={(id) => navigate(`/infrastructure/${id}`)}
                  onCardClickApp={(id) => navigate(`/apps/${id}`)}
                />
              </div>
            )}
            {activeTab === 'architecture' && (
              <div className="tab-view">
                <ArchitectureTab
                  searchQuery={searchQuery}
                  onCardClick={(id) => navigate(`/architecture/${id}`)}
                />
              </div>
            )}
            {activeTab === 'infrastructure' && (
              <div className="tab-view">
                <InfrastructureTab
                  searchQuery={searchQuery}
                  onCardClick={(id) => navigate(`/infrastructure/${id}`)}
                />
              </div>
            )}
            {activeTab === 'apps' && (
              <div className="tab-view">
                <AppsTab
                  searchQuery={searchQuery}
                  onCardClick={(id) => navigate(`/apps/${id}`)}
                  onCardClickProblem={(id) => navigate(`/problems/${id}`)}
                  onCardClickSolution={(id) => navigate(`/solutions/${id}`)}
                />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

