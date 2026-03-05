import React, { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';
import { toast } from 'react-toastify';
import { getCurrentUser } from '../services/api';
import useUserPreferences from '../hooks/useUserPreferences';
import Header from '../components/Header'; 
const CONVERSATION_API = import.meta.env.VITE_CONVERSATION_API || 'http://localhost:4004';

const AnalyticsDashboard = () => {
    const [dashboardData, setDashboardData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState(null);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const currentUser = getCurrentUser();
    const userId = currentUser?.id;
    const role = currentUser?.role;

    const normalizeDateInput = (value) => {
        if (!value) return '';
        if (value.includes('-')) return value;

        const dottedMatch = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
        if (dottedMatch) {
            const day = dottedMatch[1].padStart(2, '0');
            const month = dottedMatch[2].padStart(2, '0');
            const year = dottedMatch[3];
            return `${year}-${month}-${day}`;
        }

        const slashedMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (slashedMatch) {
            const day = slashedMatch[1].padStart(2, '0');
            const month = slashedMatch[2].padStart(2, '0');
            const year = slashedMatch[3];
            return `${year}-${month}-${day}`;
        }

        return value;
    };

    // User preferences (theme, language)
    const { isDarkMode, language } = useUserPreferences(userId);

    // Translations
    const translations = {
        en: {
            loadingAnalytics: 'Loading analytics...',
            noDataAvailable: 'No data available',
            analyticsDashboard: 'Analytics Dashboard',
            queryAnalysisInsights: 'Query analysis and insights',
            downloadCSV: 'Download CSV',
            processNewQueries: 'Process New Queries',
            processing: 'Processing...',
            from: 'From:',
            to: 'To:',
            clearFilters: 'Clear filters',
            processedQueries: 'Processed Queries',
            oneWordSkipped: '(1 word queries skipped)',
            totalQueries: 'Total Queries',
            includingOneWord: '(including 1 word queries)',
            totalUsers: 'Total Users',
            activeNow: '🟢 Active Now (15min)',
            topKeywords: 'Top Keywords',
            keywords: 'Keywords',
            frequency: 'Frequency',
            noKeywordData: 'No keyword data available',
            queryCategories: 'Query Categories',
            noCategoryData: 'No category data available',
            queriesOverTime: 'Queries Over Time',
            last7Days: '(Last 7 Days)',
            date: 'Date',
            numberOfQueries: 'Number of Queries',
            noTimelineData: 'No timeline data available',
            note: 'Note:',
            analyticsNote: 'Analytics are powered by a small LLM that classifies queries into keywords and categories. Click "Process New Queries" to analyze recent chat messages.',
            noNewQueries: 'No new queries to process',
            processedCount: 'Successfully processed',
            query: 'query',
            queries: 'queries',
            errorProcessing: 'Error processing queries:',
            errorDownloadingCSV: 'Error downloading CSV:',
        },
        de: {
            loadingAnalytics: 'Analytics werden geladen...',
            noDataAvailable: 'Keine Daten verfügbar',
            analyticsDashboard: 'Analytics-Dashboard',
            queryAnalysisInsights: 'Abfrageanalyse und Erkenntnisse',
            downloadCSV: 'CSV herunterladen',
            processNewQueries: 'Neue Abfragen verarbeiten',
            processing: 'Wird verarbeitet...',
            from: 'Von:',
            to: 'Bis:',
            clearFilters: 'Filter löschen',
            processedQueries: 'Verarbeitete Abfragen',
            oneWordSkipped: '(1-Wort-Abfragen übersprungen)',
            totalQueries: 'Gesamte Abfragen',
            includingOneWord: '(inkl. 1-Wort-Abfragen)',
            totalUsers: 'Gesamtbenutzer',
            activeNow: '🟢 Jetzt aktiv (15 Min)',
            topKeywords: 'Top-Schlüsselwörter',
            keywords: 'Schlüsselwörter',
            frequency: 'Häufigkeit',
            noKeywordData: 'Keine Schlüsselwortdaten verfügbar',
            queryCategories: 'Abfragekategorien',
            noCategoryData: 'Keine Kategoriedaten verfügbar',
            queriesOverTime: 'Abfragen im Zeitverlauf',
            last7Days: '(Letzte 7 Tage)',
            date: 'Datum',
            numberOfQueries: 'Anzahl der Abfragen',
            noTimelineData: 'Keine Zeitverlaufsdaten verfügbar',
            note: 'Hinweis:',
            analyticsNote: 'Analytics werden von einem kleinen LLM unterstützt, das Abfragen in Schlüsselwörter und Kategorien einteilt. Klicken Sie auf "Neue Abfragen verarbeiten", um aktuelle Chat-Nachrichten zu analysieren.',
            noNewQueries: 'Keine neuen Abfragen zu verarbeiten',
            processedCount: 'Erfolgreich verarbeitet',
            query: 'Abfrage',
            queries: 'Abfragen',
            errorProcessing: 'Fehler beim Verarbeiten der Abfragen:',
            errorDownloadingCSV: 'Fehler beim Herunterladen der CSV:',
        },
    };
    const t = translations[language] || translations.en;

    useEffect(() => {
        fetchDashboardData();
    }, [startDate, endDate]);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            setError(null);
            let url = `${CONVERSATION_API}/api/analytics/dashboard`;
            const params = [];
            if (startDate) params.push(`startDate=${encodeURIComponent(startDate)}`);
            if (endDate) params.push(`endDate=${encodeURIComponent(endDate)}`);
            if (params.length > 0) url += `?${params.join('&')}`;
            
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
                toast.info(t.noNewQueries);
            } else {
                toast.success(`${t.processedCount} ${result.processed} ${result.processed === 1 ? t.query : t.queries}`);
            }
            
            await fetchDashboardData(); // Wait for refresh to complete
        } catch (err) {
            console.error('Error processing queries:', err);
            toast.error(t.errorProcessing + ' ' + err.message);
        } finally {
            setProcessing(false);
        }
    };

    const downloadCSV = async () => {
        try {
            let url = `${CONVERSATION_API}/api/analytics/export`;
            const params = [];
            if (startDate) params.push(`startDate=${encodeURIComponent(startDate)}`);
            if (endDate) params.push(`endDate=${encodeURIComponent(endDate)}`);
            if (params.length > 0) url += `?${params.join('&')}`;
            
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
            alert(t.errorDownloadingCSV + ' ' + err.message);
        }
    };

    if (loading) {
        return (
            <div className={`h-screen flex flex-col overflow-hidden ${isDarkMode ? 'bg-[#212121]' : 'bg-white'}`}>
                <div className="flex-shrink-0 h-14">
                    <Header role={role} isDarkMode={isDarkMode} language={language} />
                </div>
                <div className="flex-1 flex items-center justify-center">
                    <div className={`text-xl ${isDarkMode ? 'text-white' : 'text-tum-grey-1'}`}>{t.loadingAnalytics}</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`h-screen flex flex-col overflow-hidden ${isDarkMode ? 'bg-[#212121]' : 'bg-white'}`}>
                <div className="flex-shrink-0 h-14">
                    <Header role={role} isDarkMode={isDarkMode} language={language} />
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
                    <Header role={role} isDarkMode={isDarkMode} language={language} />
                </div>
                <div className="flex-1 flex items-center justify-center">
                    <div className={`text-xl ${isDarkMode ? 'text-white' : 'text-tum-grey-1'}`}>{t.noDataAvailable}</div>
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
                <Header role={role} isDarkMode={isDarkMode} language={language} />
            </div>
            
            {/* Main dashboard area */}
            <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="max-w-7xl mx-auto p-6">
                    {/* Header */}
                    <div className="mb-8">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h1 className={`text-3xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-tum-grey-1'}`}>{t.analyticsDashboard}</h1>
                                <p className={`${isDarkMode ? 'text-white' : 'text-tum-grey-4'}`}>{t.queryAnalysisInsights}</p>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={downloadCSV}
                                    className="bg-tum-green hover:bg-tum-green-dark text-tum-white px-6 py-2 rounded-lg transition-colors"
                                >
                                    {t.downloadCSV}
                                </button>
                                <button
                                    onClick={processQueries}
                                    disabled={processing}
                                    className="bg-tum-blue-brand hover:bg-tum-dark-blue disabled:bg-tum-grey-4 text-tum-white px-6 py-2 rounded-lg transition-colors"
                                >
                                    {processing ? t.processing : t.processNewQueries}
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
                                <label className={`${isDarkMode ? 'text-white' : 'text-tum-grey-3'} text-sm font-medium`}>{t.from}</label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(normalizeDateInput(e.target.value))}
                                    className={`px-3 py-2 rounded-xl border focus:border-tum-blue-brand focus:ring-2 focus:ring-tum-blue-brand focus:outline-none
                                        ${isDarkMode 
                                            ? 'bg-tum-grey-3 text-white border-tum-grey-4'
                                            : 'bg-tum-white text-tum-grey-1 border-tum-blue-light-2'
                                        }`
                                    }
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <label className={`${isDarkMode ? 'text-white' : 'text-tum-grey-3'} text-sm font-medium`}>{t.to}</label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(normalizeDateInput(e.target.value))}
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
                                    {t.clearFilters}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Overall Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <div className={`${isDarkMode ? 'bg-tum-grey-2 border-tum-grey-4 text-white' : 'bg-tum-blue-light-4 border-tum-blue-light-2'} rounded-xl p-6 border shadow-lg`}>
                            <div className={`${isDarkMode ? 'text-white' : 'text-tum-grey-3'} text-sm mb-2 font-medium`}>{t.processedQueries} <span className="text-[10px] font-normal">{t.oneWordSkipped}</span></div>
                            <div className={`text-4xl font-bold ${isDarkMode ? 'text-tum-blue' : 'text-tum-dark-blue'}`}>{overall?.totalQueries || 0}</div>
                        </div>
                        <div className={`${isDarkMode ? 'bg-tum-grey-2 border-tum-grey-4 text-white' : 'bg-tum-blue-light-4 border-tum-blue-light-2'} rounded-xl p-6 border shadow-lg`}>
                            <div className={`${isDarkMode ? 'text-white' : 'text-tum-grey-3'} text-sm mb-2 font-medium`}>{t.totalQueries} <span className="text-[10px] font-normal">{t.includingOneWord}</span></div>
                            <div className={`text-4xl font-bold ${isDarkMode ? 'text-tum-blue' : 'text-tum-dark-blue'}`}>{overall?.totalQueriesIncludingOneWord || 0}</div>
                        </div>
                        <div className={`${isDarkMode ? 'bg-tum-grey-2 border-tum-grey-4 text-white' : 'bg-tum-blue-light-4 border-tum-blue-light-2'} rounded-xl p-6 border shadow-lg`}>
                            <div className={`${isDarkMode ? 'text-white' : 'text-tum-grey-3'} text-sm mb-2 font-medium`}>{t.totalUsers}</div>
                            <div className={`text-4xl font-bold ${isDarkMode ? 'text-tum-blue' : 'text-tum-dark-blue'}`}>{overall?.uniqueUsers || 0}</div>
                        </div>
                        <div className={`${isDarkMode ? 'bg-tum-green-6 border-tum-green-3 text-white' : 'bg-tum-green-5 border-tum-green-2'} rounded-xl p-6 border shadow-lg`}>
                            <div className={`${isDarkMode ? 'text-white' : 'text-tum-grey-3'} text-sm mb-2 font-medium`}>{t.activeNow}</div>
                            <div className="text-4xl font-bold text-tum-green">{overall?.activeUsersNow || 0}</div>
                        </div>
                    </div>
                    {/* Charts Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                        {/* Top Keywords Chart */}
                        <div className={`${isDarkMode ? 'bg-tum-grey-2 border-tum-grey-4 text-white' : 'bg-tum-blue-light-4 border-tum-blue-light-2'} rounded-xl p-6 border shadow-lg`}>
                            <h2 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-tum-blue' : 'text-tum-dark-blue'}`}>{t.topKeywords}</h2>
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
                                                text: t.keywords,
                                                font: { color: isDarkMode ? '#FFFFFF' : '#20252A' }
                                            },
                                            tickfont: { color: isDarkMode ? '#FFFFFF' : '#20252A' }
                                        },
                                        yaxis: {
                                            gridcolor: isDarkMode ? '#444' : '#C2D7EF',
                                            title: {
                                                text: t.frequency,
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
                                <div className="text-tum-grey-4 text-center py-10">{t.noKeywordData}</div>
                            )}
                        </div>

                        {/* Category Distribution Chart */}
                        <div className={`${isDarkMode ? 'bg-tum-grey-2 border-tum-grey-4 text-white' : 'bg-tum-blue-light-4 border-tum-blue-light-2'} rounded-xl p-6 border shadow-lg`}>
                            <h2 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-tum-blue' : 'text-tum-dark-blue'}`}>{t.queryCategories}</h2>
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
                                <div className="text-tum-grey-4 text-center py-10">{t.noCategoryData}</div>
                            )}
                        </div>
                    </div>

                    {/* Timeline Chart - Full Width */}
                    <div className={`${isDarkMode ? 'bg-tum-grey-2 border-tum-grey-4 text-white' : 'bg-tum-blue-light-4 border-tum-blue-light-2'} rounded-xl p-6 border shadow-lg`}>
                        <h2 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-tum-blue' : 'text-tum-dark-blue'}`}>
                            {t.queriesOverTime}
                            {!startDate && !endDate && <span className={`${isDarkMode ? 'text-white' : 'text-tum-grey-4'} text-sm ml-2`}>{t.last7Days}</span>}
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
                                        title: t.date
                                    },
                                    yaxis: {
                                        gridcolor: '#C2D7EF',
                                        title: t.numberOfQueries
                                    },
                                    margin: { t: 20, b: 60, l: 50, r: 20 },
                                    height: 350
                                }}
                                config={{ displayModeBar: false }}
                                style={{ width: '100%' }}
                                useResizeHandler={true}
                            />
                        ) : (
                            <div className="text-tum-grey-4 text-center py-10">{t.noTimelineData}</div>
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
                            <strong>{t.note}</strong> {t.analyticsNote}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsDashboard;
