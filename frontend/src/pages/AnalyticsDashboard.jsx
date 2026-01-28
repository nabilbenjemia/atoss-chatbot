import React, { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';

const CONVERSATION_API = import.meta.env.VITE_CONVERSATION_API || 'http://localhost:4004';

const AnalyticsDashboard = () => {
    const [dashboardData, setDashboardData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState(null);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const userId = localStorage.getItem('userId');

    useEffect(() => {
        fetchDashboardData();
    }, [startDate, endDate]);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            setError(null);
            let url = `${CONVERSATION_API}/api/analytics/dashboard?userId=${userId}`;
            if (startDate) url += `&startDate=${startDate}`;
            if (endDate) url += `&endDate=${endDate}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch analytics data');
            const data = await response.json();
            console.log('Dashboard data received:', data); // Debug log
            setDashboardData(data);
        } catch (err) {
            setError(err.message);
            console.error('Error fetching dashboard data:', err);
        } finally {
            setLoading(false);
        }
    };

    const processQueries = async () => {
        try {
            setProcessing(true);
            const response = await fetch(`${CONVERSATION_API}/api/analytics/process`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            if (!response.ok) throw new Error('Failed to process queries');
            const result = await response.json();
            console.log('Process result:', result); // Debug log
            alert(result.message);
            await fetchDashboardData(); // Wait for refresh to complete
        } catch (err) {
            console.error('Error processing queries:', err);
            alert('Error processing queries: ' + err.message);
        } finally {
            setProcessing(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-900">
                <div className="text-white text-xl">Loading analytics...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-900">
                <div className="text-red-500 text-xl">Error: {error}</div>
            </div>
        );
    }

    // Debug logs
    console.log('Dashboard data state:', dashboardData);
    
    const { overall, keywords, categories, timeline } = dashboardData || {};
    
    console.log('Keywords:', keywords);
    console.log('Categories:', categories);
    console.log('Timeline:', timeline);

    // Prepare data for keyword bar chart
    const keywordData = keywords && keywords.length > 0 ? [{
        x: keywords.map(k => k.keyword),
        y: keywords.map(k => k.count),
        type: 'bar',
        marker: { color: '#3b82f6' }
    }] : [];

    // Prepare data for category pie chart
    const categoryData = categories && categories.length > 0 ? [{
        labels: categories.map(c => c.category.replace(/_/g, ' ')),
        values: categories.map(c => c.count),
        type: 'pie',
        hole: 0.4,
        marker: {
            colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
        }
    }] : [];

    // Prepare data for timeline line chart
    const timelineData = timeline && timeline.length > 0 ? [{
        x: timeline.map(t => t.date),
        y: timeline.map(t => t.count),
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: '#3b82f6', width: 2 },
        marker: { size: 8, color: '#3b82f6' }
    }] : [];

    return (
        <div className="min-h-screen bg-gray-900 text-white p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h1 className="text-3xl font-bold mb-2">Analytics Dashboard</h1>
                            <p className="text-gray-400">Query analysis and insights</p>
                        </div>
                        <button
                            onClick={processQueries}
                            disabled={processing}
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-6 py-2 rounded-lg transition-colors"
                        >
                            {processing ? 'Processing...' : 'Process New Queries'}
                        </button>
                    </div>
                    
                    {/* Date Range Filters */}
                    <div className="flex gap-4 items-center bg-gray-800 p-4 rounded-lg border border-gray-700">
                        <div className="flex items-center gap-2">
                            <label className="text-gray-400 text-sm">From:</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-gray-400 text-sm">To:</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                            />
                        </div>
                        {(startDate || endDate) && (
                            <button
                                onClick={() => { setStartDate(''); setEndDate(''); }}
                                className="text-gray-400 hover:text-white text-sm underline"
                            >
                                Clear filters
                            </button>
                        )}
                    </div>
                </div>

                {/* Overall Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                        <div className="text-gray-400 text-sm mb-2">Total Queries</div>
                        <div className="text-4xl font-bold">{overall?.totalQueries || 0}</div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                        <div className="text-gray-400 text-sm mb-2">Total Users</div>
                        <div className="text-4xl font-bold">{overall?.uniqueUsers || 0}</div>
                    </div>
                    <div className="bg-green-900/30 rounded-lg p-6 border border-green-700">
                        <div className="text-green-400 text-sm mb-2">🟢 Active Now (15min)</div>
                        <div className="text-4xl font-bold text-green-500">{overall?.activeUsersNow || 0}</div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                        <div className="text-gray-400 text-sm mb-2">Avg Keywords</div>
                        <div className="text-4xl font-bold">{overall?.avgKeywordsPerQuery || 0}</div>
                    </div>
                </div>

                {/* Debug Info */}
                {dashboardData && (
                    <div className="bg-gray-800 rounded-lg p-4 border border-yellow-700 mb-6">
                        <details>
                            <summary className="text-yellow-400 cursor-pointer">🐛 Debug Info (click to expand)</summary>
                            <pre className="text-xs text-gray-300 mt-2 overflow-auto">
                                {JSON.stringify(dashboardData, null, 2)}
                            </pre>
                        </details>
                    </div>
                )}

                {/* Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* Top Keywords Chart */}
                    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                        <h2 className="text-xl font-semibold mb-4">Top Keywords</h2>
                        {keywords && keywords.length > 0 ? (
                            <Plot
                                data={keywordData}
                                layout={{
                                    paper_bgcolor: 'rgba(0,0,0,0)',
                                    plot_bgcolor: 'rgba(0,0,0,0)',
                                    font: { color: '#e5e7eb' },
                                    xaxis: {
                                        gridcolor: '#374151',
                                        title: 'Keywords'
                                    },
                                    yaxis: {
                                        gridcolor: '#374151',
                                        title: 'Frequency'
                                    },
                                    margin: { t: 20, b: 60, l: 50, r: 20 },
                                    height: 350
                                }}
                                config={{ displayModeBar: false }}
                                style={{ width: '100%' }}
                                useResizeHandler={true}
                            />
                        ) : (
                            <div className="text-gray-400 text-center py-10">No keyword data available</div>
                        )}
                    </div>

                    {/* Category Distribution Chart */}
                    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                        <h2 className="text-xl font-semibold mb-4">Query Categories</h2>
                        {categories && categories.length > 0 ? (
                            <Plot
                                data={categoryData}
                                layout={{
                                    paper_bgcolor: 'rgba(0,0,0,0)',
                                    plot_bgcolor: 'rgba(0,0,0,0)',
                                    font: { color: '#e5e7eb' },
                                    showlegend: true,
                                    legend: {
                                        orientation: 'v',
                                        x: 1,
                                        y: 0.5
                                    },
                                    margin: { t: 20, b: 20, l: 20, r: 100 },
                                    height: 350
                                }}
                                config={{ displayModeBar: false }}
                                style={{ width: '100%' }}
                                useResizeHandler={true}
                            />
                        ) : (
                            <div className="text-gray-400 text-center py-10">No category data available</div>
                        )}
                    </div>
                </div>

                {/* Timeline Chart - Full Width */}
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <h2 className="text-xl font-semibold mb-4">
                        Queries Over Time
                        {!startDate && !endDate && <span className="text-gray-400 text-sm ml-2">(Last 30 Days)</span>}
                        {(startDate || endDate) && (
                            <span className="text-blue-400 text-sm ml-2">
                                ({startDate || '...'} to {endDate || 'now'})
                            </span>
                        )}
                    </h2>
                    {timeline && timeline.length > 0 ? (
                        <Plot
                            data={timelineData}
                            layout={{
                                paper_bgcolor: 'rgba(0,0,0,0)',
                                plot_bgcolor: 'rgba(0,0,0,0)',
                                font: { color: '#e5e7eb' },
                                xaxis: {
                                    gridcolor: '#374151',
                                    title: 'Date'
                                },
                                yaxis: {
                                    gridcolor: '#374151',
                                    title: 'Number of Queries'
                                },
                                margin: { t: 20, b: 60, l: 50, r: 20 },
                                height: 350
                            }}
                            config={{ displayModeBar: false }}
                            style={{ width: '100%' }}
                            useResizeHandler={true}
                        />
                    ) : (
                        <div className="text-gray-400 text-center py-10">No timeline data available</div>
                    )}
                </div>

                {/* Info Box */}
                <div className="mt-6 bg-blue-900/20 border border-blue-800 rounded-lg p-4">
                    <p className="text-sm text-blue-300">
                        <strong>Note:</strong> Analytics are powered by a small LLM that classifies queries into keywords and categories. 
                        Click "Process New Queries" to analyze recent chat messages.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsDashboard;
