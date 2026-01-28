import React, { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';
import { toast } from 'react-toastify';

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
            
            // Show appropriate notification based on result
            if (result.processed === 0) {
                toast.info('No new queries to process');
            } else {
                toast.success(`Successfully processed ${result.processed} ${result.processed === 1 ? 'query' : 'queries'}`);
            }
            
            await fetchDashboardData(); // Wait for refresh to complete
        } catch (err) {
            console.error('Error processing queries:', err);
            toast.error('Error processing queries: ' + err.message);
        } finally {
            setProcessing(false);
        }
    };

    const downloadCSV = async () => {
        try {
            let url = `${CONVERSATION_API}/api/analytics/export?userId=${userId}`;
            if (startDate) url += `&startDate=${startDate}`;
            if (endDate) url += `&endDate=${endDate}`;
            
            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to export data');
            
            const blob = await response.blob();
            const csvUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = csvUrl;
            link.setAttribute('download', `analyzed_queries_${new Date().toISOString().slice(0, 10)}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(csvUrl);
        } catch (err) {
            console.error('Error downloading CSV:', err);
            alert('Error downloading CSV: ' + err.message);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-tum-blue-dark">
                <div className="text-tum-white text-xl">Loading analytics...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-screen bg-tum-blue-dark">
                <div className="text-tum-red text-xl">Error: {error}</div>
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
        marker: { color: '#3070B3' }
    }] : [];

    // Prepare data for category pie chart
    const categoryData = categories && categories.length > 0 ? [{
        labels: categories.map(c => c.category.replace(/_/g, ' ')),
        values: categories.map(c => c.count),
        type: 'pie',
        hole: 0.4,
        marker: {
            colors: ['#79d8f0', '#9FBA36', '#E37222', '#C4071B', '#8F81EA', '#B55CA5', '#FED702', '#037291']
        }
    }] : [];

    // Prepare data for timeline line chart
    const timelineData = timeline && timeline.length > 0 ? [{
        x: timeline.map(t => t.date),
        y: timeline.map(t => t.count),
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: '#3070B3', width: 2 },
        marker: { size: 8, color: '#3070B3' }
    }] : [];

    return (
        <div className="min-h-screen bg-tum-blue-dark text-tum-white p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h1 className="text-3xl font-bold mb-2 text-tum-white">Analytics Dashboard</h1>
                            <p className="text-tum-grey-7">Query analysis and insights</p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={downloadCSV}
                                className="bg-tum-green-1 hover:bg-tum-green-dark text-white px-6 py-2 rounded-lg transition-colors"
                            >
                                Download CSV
                            </button>
                            <button
                                onClick={processQueries}
                                disabled={processing}
                                className="bg-tum-blue-brand hover:bg-tum-blue disabled:bg-tum-grey-4 text-white px-6 py-2 rounded-lg transition-colors"
                            >
                                {processing ? 'Processing...' : 'Process New Queries'}
                            </button>
                        </div>
                    </div>
                    
                    {/* Date Range Filters */}
                    <div className="flex gap-4 items-center bg-tum-blue-dark-1 p-4 rounded-xl border border-tum-blue-dark-3 shadow-lg">
                        <div className="flex items-center gap-2">
                            <label className="text-tum-grey-7 text-sm font-medium">From:</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="bg-tum-blue-dark-2 text-tum-white px-3 py-2 rounded-xl border border-tum-blue-dark-4 focus:border-tum-blue-brand focus:ring-2 focus:ring-tum-blue-brand focus:outline-none"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-tum-grey-7 text-sm font-medium">To:</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="bg-tum-blue-dark-2 text-tum-white px-3 py-2 rounded-xl border border-tum-blue-dark-4 focus:border-tum-blue-brand focus:ring-2 focus:ring-tum-blue-brand focus:outline-none"
                            />
                        </div>
                        {(startDate || endDate) && (
                            <button
                                onClick={() => { setStartDate(''); setEndDate(''); }}
                                className="text-tum-blue-light hover:text-tum-white text-sm font-medium transition-colors"
                            >
                                Clear filters
                            </button>
                        )}
                    </div>
                </div>

                {/* Overall Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="bg-tum-blue-dark-1 rounded-xl p-6 border border-tum-blue-dark-3 shadow-lg">
                        <div className="text-tum-grey-7 text-sm mb-2 font-medium">Processed Queries <span className="text-xs font-normal">(1 word queries skipped)</span></div>
                        <div className="text-4xl font-bold text-tum-white">{overall?.totalQueries || 0}</div>
                    </div>
                    <div className="bg-tum-blue-dark-1 rounded-xl p-6 border border-tum-blue-dark-3 shadow-lg">
                        <div className="text-tum-grey-7 text-sm mb-2 font-medium">Total Queries <span className="text-xs font-normal">(including 1 word queries)</span></div>
                        <div className="text-4xl font-bold text-tum-white">{overall?.totalQueriesIncludingOneWord || 0}</div>
                    </div>
                    <div className="bg-tum-blue-dark-1 rounded-xl p-6 border border-tum-blue-dark-3 shadow-lg">
                        <div className="text-tum-grey-7 text-sm mb-2 font-medium">Total Users</div>
                        <div className="text-4xl font-bold text-tum-white">{overall?.uniqueUsers || 0}</div>
                    </div>
                    <div className="bg-tum-blue-dark-1 rounded-xl p-6 border border-tum-green-dark shadow-lg">
                        <div className="text-tum-grey-7 text-sm mb-2 font-medium">🟢 Active Now (15min)</div>
                        <div className="text-4xl font-bold text-tum-green-2">{overall?.activeUsersNow || 0}</div>
                    </div>
                </div>
                {/* Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* Top Keywords Chart */}
                    <div className="bg-tum-blue-dark-1 rounded-xl p-6 border border-tum-blue-dark-3 shadow-lg">
                        <h2 className="text-xl font-semibold mb-4 text-tum-white">Top Keywords</h2>
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
                                    margin: { t: 20, b: 80, l: 60, r: 20 },
                                    height: 350
                                }}
                                config={{ displayModeBar: false }}
                                style={{ width: '100%' }}
                                useResizeHandler={true}
                            />
                        ) : (
                            <div className="text-tum-grey-7 text-center py-10">No keyword data available</div>
                        )}
                    </div>

                    {/* Category Distribution Chart */}
                    <div className="bg-tum-blue-dark-1 rounded-xl p-6 border border-tum-blue-dark-3 shadow-lg">
                        <h2 className="text-xl font-semibold mb-4 text-tum-white">Query Categories</h2>
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
                                        x: 1.05,
                                        y: 0.5
                                    },
                                    margin: { t: 30, b: 30, l: 30, r: 150 },
                                    height: 350
                                }}
                                config={{ displayModeBar: false }}
                                style={{ width: '100%' }}
                                useResizeHandler={true}
                            />
                        ) : (
                            <div className="text-tum-grey-7 text-center py-10">No category data available</div>
                        )}
                    </div>
                </div>

                {/* Timeline Chart - Full Width */}
                <div className="bg-tum-blue-dark-1 rounded-xl p-6 border border-tum-blue-dark-3 shadow-lg">
                    <h2 className="text-xl font-semibold mb-4 text-tum-white">
                        Queries Over Time
                        {!startDate && !endDate && <span className="text-tum-grey-7 text-sm ml-2">(Last 7 Days)</span>}
                        {(startDate || endDate) && (
                            <span className="text-tum-grey-7 text-sm ml-2">
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
                        <div className="text-tum-grey-7 text-center py-10">No timeline data available</div>
                    )}
                </div>

                {/* Info Box */}
                <div className="mt-6 bg-tum-blue-dark-1 border border-tum-blue-dark-3 rounded-xl p-4 shadow-lg">
                    <p className="text-sm text-tum-grey-7">
                        <strong>Note:</strong> Analytics are powered by a small LLM that classifies queries into keywords and categories. 
                        Click "Process New Queries" to analyze recent chat messages.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsDashboard;
