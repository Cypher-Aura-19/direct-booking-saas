export default function DashboardLoading() {
  return <div className="dashboard-overview" role="status" aria-label="Loading workspace"><span className="sr-only">Loading your workspace...</span><div className="dashboard-skeleton h-16 w-72" /><div className="metric-grid">{[0,1,2,3].map(i=><div key={i} className="dashboard-skeleton h-44" />)}</div><div className="analytics-grid"><div className="dashboard-skeleton h-96" /><div className="dashboard-skeleton h-96" /></div></div>;
}
