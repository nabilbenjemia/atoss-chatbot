import React, { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';
import { toast } from 'react-toastify';
import { getCurrentUser, userAPI } from '../services/api'
import Header from '../components/Header'; 
const CONVERSATION_API = import.meta.env.VITE_CONVERSATION_API || 'http://localhost:4004';

const AnalyticsDashboard = () => {
    const [dashboardData, setDashboardData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState(null);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [theme, setTheme] = useState('auto'); 

    const currentUser = getCurrentUser();
    const userId = currentUser?.id;
    const role = currentUser?.role;

    // Determine if dark mode should be applied - MUST BE BEFORE EARLY RETURNS
    const isDarkMode = theme === 'dark';

    // Load user preferences for theme
    useEffect(() => {
        const loadPreferences = async () => {
            try {
                const response = await userAPI.getProfile();
                if (response.success && response.data.preferences) {
                    const userTheme = response.data.preferences.theme;
                    if (userTheme === 'auto') {
                        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                        setTheme(prefersDark ? 'dark' : 'light');
                    } else {
                        setTheme(userTheme);
                    }
                }
            } catch (error) {
                console.error('Failed to load preferences:', error);
            }
        };

        if (userId) {
            loadPreferences();
        }
    }, [userId]);

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
            <div className={`h-screen flex flex-col overflow-hidden ${isDarkMode ? 'bg-[#212121]' : 'bg-white'}`}>
                <div className="flex-shrink-0 h-14">
                    <Header role={role} isDarkMode={isDarkMode} />
                </div>
                <div className="flex-1 flex items-center justify-center">
                    <div className={`text-xl ${isDarkMode ? 'text-white' : 'text-tum-grey-1'}`}>Loading analytics...</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`h-screen flex flex-col overflow-hidden ${isDarkMode ? 'bg-[#212121]' : 'bg-white'}`}>
                <div className="flex-shrink-0 h-14">
                    <Header role={role} isDarkMode={isDarkMode} />
                </div>
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-tum-red text-xl">Error: {error}</div>
                </div>
            </div>
        );
    }

    if (!dashboardData) {
        return (
            <div className={`h-screen flex flex-col overflow-hidden ${isDarkMode ? 'bg-[#212121]' : 'bg-white'}`}>
                <div className="flex-shrink-0 h-14">
                    <Header role={role} isDarkMode={isDarkMode} />
                </div>
                <div className="flex-1 flex items-center justify-center">
                    <div className={`text-xl ${isDarkMode ? 'text-white' : 'text-tum-grey-1'}`}>No data available</div>
                </div>
            </div>
        );
    }

    const { overall, keywords, categories, timeline } = dashboardData || {};

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
        <div className={`h-screen flex flex-col overflow-hidden ${isDarkMode ? 'bg-[#212121] text-white' : 'bg-white text-tum-grey-1'}`}>
            {/* Header - fixed height, consistent with ChatbotPage */}
            <div className="flex-shrink-0 h-14">
                <Header role={role} isDarkMode={isDarkMode} />
            </div>
            
            {/* Main dashboard area */}
            <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="max-w-7xl mx-auto p-6">
                    {/* Header */}
                    <div className="mb-8">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h1 className={`text-3xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-tum-grey-1'}`}>Analytics Dashboard</h1>
                                <p className={`${isDarkMode ? 'text-white' : 'text-tum-grey-4'}`}>Query analysis and insights</p>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={downloadCSV}
                                    className="bg-tum-green hover:bg-tum-green-dark text-tum-white px-6 py-2 rounded-lg transition-colors"
                                >
                                    Download CSV
                                </button>
                                <button
                                    onClick={processQueries}
                                    disabled={processing}
                                    className="bg-tum-blue-brand hover:bg-tum-dark-blue disabled:bg-tum-grey-4 text-tum-white px-6 py-2 rounded-lg transition-colors"
                                >
                                    {processing ? 'Processing...' : 'Process New Queries'}
                                </button>
                            </div>
                        </div>
                        
                        {/* Date Range Filters */}
                        <div className={`flex gap-4 items-center p-4 rounded-xl border shadow-lg
                            ${isDarkMode 
                                ? 'bg-tum-grey-2 border-tum-grey-4'
                                : 'bg-tum-blue-light-5 border-tum-blue-light-2'
                            }`
                        }>
                            <div className="flex items-center gap-2">
                                <label className={`${isDarkMode ? 'text-white' : 'text-tum-grey-3'} text-sm font-medium`}>From:</label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className={`px-3 py-2 rounded-xl border focus:border-tum-blue-brand focus:ring-2 focus:ring-tum-blue-brand focus:outline-none
                                        ${isDarkMode 
                                            ? 'bg-tum-grey-3 text-white border-tum-grey-4'
                                            : 'bg-tum-white text-tum-grey-1 border-tum-blue-light-2'
                                        }`
                                    }
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <label className={`${isDarkMode ? 'text-white' : 'text-tum-grey-3'} text-sm font-medium`}>To:</label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className={`px-3 py-2 rounded-xl border focus:border-tum-blue-brand focus:ring-2 focus:ring-tum-blue-brand focus:outline-none
                                        ${isDarkMode 
                                            ? 'bg-tum-grey-3 text-white border-tum-grey-4'
                                            : 'bg-tum-white text-tum-grey-1 border-tum-blue-light-2'
                                        }`
                                    }
                                />
                            </div>
                            {(startDate || endDate) && (
                                <button
                                    onClick={() => { setStartDate(''); setEndDate(''); }}
                                    className={`text-tum-blue-brand hover:text-tum-white text-sm font-medium transition-colors ${isDarkMode ? '' : ''}`}
                                >
                                    Clear filters
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Overall Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <div className={`${isDarkMode ? 'bg-tum-grey-2 border-tum-grey-4 text-white' : 'bg-tum-blue-light-4 border-tum-blue-light-2'} rounded-xl p-6 border shadow-lg`}>
                            <div className={`${isDarkMode ? 'text-white' : 'text-tum-grey-3'} text-sm mb-2 font-medium`}>Processed Queries <span className="text-[10px] font-normal">(1 word queries skipped)</span></div>
                            <div className={`text-4xl font-bold ${isDarkMode ? 'text-tum-blue' : 'text-tum-dark-blue'}`}>{overall?.totalQueries || 0}</div>
                        </div>
                        <div className={`${isDarkMode ? 'bg-tum-grey-2 border-tum-grey-4 text-white' : 'bg-tum-blue-light-4 border-tum-blue-light-2'} rounded-xl p-6 border shadow-lg`}>
                            <div className={`${isDarkMode ? 'text-white' : 'text-tum-grey-3'} text-sm mb-2 font-medium`}>Total Queries <span className="text-[10px] font-normal">(including 1 word queries)</span></div>
                            <div className={`text-4xl font-bold ${isDarkMode ? 'text-tum-blue' : 'text-tum-dark-blue'}`}>{overall?.totalQueriesIncludingOneWord || 0}</div>
                        </div>
                        <div className={`${isDarkMode ? 'bg-tum-grey-2 border-tum-grey-4 text-white' : 'bg-tum-blue-light-4 border-tum-blue-light-2'} rounded-xl p-6 border shadow-lg`}>
                            <div className={`${isDarkMode ? 'text-white' : 'text-tum-grey-3'} text-sm mb-2 font-medium`}>Total Users</div>
                            <div className={`text-4xl font-bold ${isDarkMode ? 'text-tum-blue' : 'text-tum-dark-blue'}`}>{overall?.uniqueUsers || 0}</div>
                        </div>
                        <div className={`${isDarkMode ? 'bg-tum-green-6 border-tum-green-3 text-white' : 'bg-tum-green-5 border-tum-green-2'} rounded-xl p-6 border shadow-lg`}>
                            <div className={`${isDarkMode ? 'text-white' : 'text-tum-grey-3'} text-sm mb-2 font-medium`}>🟢 Active Now (15min)</div>
                            <div className="text-4xl font-bold text-tum-green">{overall?.activeUsersNow || 0}</div>
                        </div>
                    </div>
                    {/* Charts Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                        {/* Top Keywords Chart */}
                        <div className={`${isDarkMode ? 'bg-tum-grey-2 border-tum-grey-4 text-white' : 'bg-tum-blue-light-4 border-tum-blue-light-2'} rounded-xl p-6 border shadow-lg`}>
                            <h2 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-tum-blue' : 'text-tum-dark-blue'}`}>Top Keywords</h2>
                            {keywords && keywords.length > 0 ? (
                                <Plot
                                    data={keywordData}
                                    layout={{
                                        paper_bgcolor: 'rgba(0,0,0,0)',
                                        plot_bgcolor: 'rgba(0,0,0,0)',
                                        font: { color: isDarkMode ? '#FFFFFF' : '#20252A' },
                                        xaxis: {
                                            gridcolor: isDarkMode ? '#444' : '#C2D7EF',
                                            title: {
                                                text: 'Keywords',
                                                font: { color: isDarkMode ? '#FFFFFF' : '#20252A' }
                                            },
                                            tickfont: { color: isDarkMode ? '#FFFFFF' : '#20252A' }
                                        },
                                        yaxis: {
                                            gridcolor: isDarkMode ? '#444' : '#C2D7EF',
                                            title: {
                                                text: 'Frequency',
                                                font: { color: isDarkMode ? '#FFFFFF' : '#20252A' }
                                            },
                                            tickfont: { color: isDarkMode ? '#FFFFFF' : '#20252A' }
                                        },
                                        margin: { t: 20, b: 80, l: 60, r: 20 },
                                        height: 350
                                    }}
                                    config={{ displayModeBar: false }}
                                    style={{ width: '100%' }}
                                    useResizeHandler={true}
                                />
                            ) : (
                                <div className="text-tum-grey-4 text-center py-10">No keyword data available</div>
                            )}
                        </div>

                        {/* Category Distribution Chart */}
                        <div className={`${isDarkMode ? 'bg-tum-grey-2 border-tum-grey-4 text-white' : 'bg-tum-blue-light-4 border-tum-blue-light-2'} rounded-xl p-6 border shadow-lg`}>
                            <h2 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-tum-blue' : 'text-tum-dark-blue'}`}>Query Categories</h2>
                            {categories && categories.length > 0 ? (
                                <Plot
                                    data={categoryData}
                                    layout={{
                                        paper_bgcolor: 'rgba(0,0,0,0)',
                                        plot_bgcolor: 'rgba(0,0,0,0)',
                                        font: { color: isDarkMode ? '#FFFFFF' : '#20252A' },
                                        showlegend: true,
                                        legend: {
                                            orientation: 'v',
                                            x: 1.15,
                                            y: 0.5,
                                            font: { color: isDarkMode ? '#FFFFFF' : '#20252A' }
                                        },
                                        margin: { t: 30, b: 30, l: 30, r: 220 },
                                        height: 350
                                    }}
                                    config={{ displayModeBar: false }}
                                    style={{ width: '100%' }}
                                    useResizeHandler={true}
                                />
                            ) : (
                                <div className="text-tum-grey-4 text-center py-10">No category data available</div>
                            )}
                        </div>
                    </div>

                    {/* Timeline Chart - Full Width */}
                    <div className={`${isDarkMode ? 'bg-tum-grey-2 border-tum-grey-4 text-white' : 'bg-tum-blue-light-4 border-tum-blue-light-2'} rounded-xl p-6 border shadow-lg`}>
                        <h2 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-tum-blue' : 'text-tum-dark-blue'}`}>
                            Queries Over Time
                            {!startDate && !endDate && <span className={`${isDarkMode ? 'text-white' : 'text-tum-grey-4'} text-sm ml-2`}>(Last 7 Days)</span>}
                            {(startDate || endDate) && (
                                <span className={`${isDarkMode ? 'text-white' : 'text-tum-grey-4'} text-sm ml-2`}>
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
                                    font: { color: isDarkMode ? '#FFFFFF' : '#20252A' },
                                    xaxis: {
                                        gridcolor: '#C2D7EF',
                                        title: 'Date'
                                    },
                                    yaxis: {
                                        gridcolor: '#C2D7EF',
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
                            <div className="text-tum-grey-4 text-center py-10">No timeline data available</div>
                        )}
                    </div>

                    {/* Info Box */}
                    <div className={`mt-6 rounded-xl p-4 shadow-lg border
                        ${isDarkMode 
                            ? 'bg-tum-grey-2 border-tum-grey-4 text-white'
                            : 'bg-tum-blue-light-5 border-tum-blue-light-2'
                        }`
                    }>
                        <p className={`${isDarkMode ? 'text-white' : 'text-tum-grey-3'} text-sm`}>
                            <strong>Note:</strong> Analytics are powered by a small LLM that classifies queries into keywords and categories. 
                            Click "Process New Queries" to analyze recent chat messages.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsDashboard;
