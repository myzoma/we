document.addEventListener('DOMContentLoaded', () => {
    const analyzeButton = document.getElementById('analyzeButton');
    const resultsDiv = document.getElementById('analysisResults');

    if (!analyzeButton || !resultsDiv) {
        console.error('عناصر الواجهة غير موجودة');
        resultsDiv.innerHTML = '<p class="error">خطأ في تحميل الواجهة</p>';
        return;
    }

    // Cloudflare Worker Proxy
    const BINANCE_PROXY = 'https://yas.mezajiat.workers.dev';

    async function fetchBinanceData(endpoint) {
        try {
            const response = await fetch(`${BINANCE_PROXY}${endpoint}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error(`فشل جلب البيانات: ${endpoint}`, error);
            throw error;
        }
    }

    analyzeButton.addEventListener('click', async () => {
        resultsDiv.innerHTML = `
            <div class="loading">
                <i class="fas fa-circle-notch fa-spin"></i>
                <p>جاري تحليل السوق...</p>
            </div>
        `;

        try {
            if (typeof ElliottWaveAnalyzer === 'undefined') {
                throw new Error('ملف elliottWaveAnalyzer.js غير محمل');
            }

            // Initialize WebSocket for real-time prices
            let wsData = {};
            try {
                const ws = new WebSocket('wss://data-stream.binance.vision/ws/!miniTicker@arr');
                ws.onmessage = (event) => {
                    const data = JSON.parse(event.data);
                    data.forEach(ticker => {
                        wsData[ticker.s] = parseFloat(ticker.c);
                    });
                };
                ws.onerror = () => console.warn('فشل WebSocket');
                await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (wsError) {
                console.warn('خطأ WebSocket:', wsError.message);
            }

            // Fetch trading pairs
            let nonBtcPairs;
            try {
                const exchangeInfo = await fetchBinanceData('/api/v3/exchangeInfo');
                nonBtcPairs = exchangeInfo.symbols
                    .filter(symbol => 
                        symbol.status === 'TRADING' &&
                        symbol.quoteAsset === 'USDT' && 
                        !symbol.baseAsset.includes('BTC') && 
                        !symbol.symbol.includes('BTC')
                    )
                    .map(symbol => symbol.symbol)
                    .slice(0, 5);
                    
                if (!nonBtcPairs.length) {
                    throw new Error('لا توجد أزواج تداول نشطة');
                }
            } catch (error) {
                showError('فشل جلب أزواج التداول', error);
                return;
            }

            resultsDiv.innerHTML = '';
            const analyzer = new ElliottWaveAnalyzer();

            // Analyze each pair
            for (const pair of nonBtcPairs) {
                try {
                    const klineData = await fetchBinanceData(`/api/v3/klines?symbol=${pair}&interval=1h&limit=100`);
                    
                    if (!Array.isArray(klineData) || klineData.length < 20) {
                        throw new Error(`بيانات غير كافية لـ ${pair}`);
                    }

                    const analysis = analyzer.analyze(klineData);
                    if (analysis.status !== 'success') {
                        throw new Error(analysis.message || `فشل تحليل ${pair}`);
                    }

                    analysis.currentPrice = wsData[pair] || analysis.currentPrice;
                    renderCurrencyCard(pair, analysis, analyzer);
                    
                } catch (pairError) {
                    console.warn(`خطأ في تحليل ${pair}:`, pairError.message);
                    renderErrorCard(pair, pairError.message);
                }
            }

            if (!resultsDiv.hasChildNodes()) {
                throw new Error('لم يتم العثور على تحليلات صالحة');
            }

        } catch (error) {
            showError('خطأ في تحليل السوق', error);
        }
    });

    function renderCurrencyCard(pair, analysis, analyzer) {
        const card = document.createElement('div');
        card.className = 'currency-card';
        
        // Basic Info
        card.innerHTML = `
            <h3>${pair} (${analyzer.translateTrend(analysis.trend)})</h3>
            <p><strong>السعر الحالي:</strong> ${parseFloat(analysis.currentPrice).toFixed(2)} USDT</p>
            <p><strong>ملخص:</strong> ${analysis.summary}</p>
        `;

        // Current Wave Analysis
        if (analysis.currentWaveAnalysis) {
            card.innerHTML += `
                <div class="pattern">
                    <h4>تحليل الموجة الحالية</h4>
                    <p><strong>نوع الموجة:</strong> ${analyzer.translateWaveType(analysis.currentWaveAnalysis.currentWave)}</p>
                    ${analysis.currentWaveAnalysis.expectedTarget ? `<p><strong>الهدف المتوقع:</strong> ${analysis.currentWaveAnalysis.expectedTarget.toFixed(2)} USDT</p>` : ''}
                    ${analysis.currentWaveAnalysis.stopLoss ? `<p><strong>وقف الخسارة:</strong> ${analysis.currentWaveAnalysis.stopLoss.toFixed(2)} USDT</p>` : ''}
                    <p><strong>مستوى الثقة:</strong> ${analysis.currentWaveAnalysis.confidence.toFixed(1)}%</p>
                    <p><strong>الإطار الزمني:</strong> ${analysis.currentWaveAnalysis.timeframe}</p>
                </div>
            `;
        }

        // Detected Patterns
        if (analysis.patterns.length > 0) {
            card.innerHTML += `
                <div class="pattern">
                    <h4>الأنماط المكتشفة (${analysis.patterns.length})</h4>
                    <table class="pattern-table">
                        <thead>
                            <tr>
                                <th>النمط</th>
                                <th>الثقة</th>
                                <th>نسبة التغيير</th>
                                <th>الدعم</th>
                                <th>المقاومة</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            analysis.patterns.slice(0, 2).forEach((pattern, index) => {
                const percentage = pattern.waves?.[0]?.percentage?.toFixed(2) || 
                    ((pattern.points[pattern.points.length - 1][1] - pattern.points[0][1]) / pattern.points[0][1] * 100).toFixed(2);
                
                card.innerHTML += `
                    <tr>
                        <td>نمط ${index + 1}: ${pattern.type === 'motive' ? 'دافع' : 'تصحيحي'} (${pattern.direction === 'bullish' ? 'صاعد' : 'هابط'})</td>
                        <td>${pattern.confidence.toFixed(1)}%</td>
                        <td>${percentage}%</td>
                        <td>${pattern.targets.support.toFixed(2)} USDT</td>
                        <td>${pattern.targets.resistance.toFixed(2)} USDT</td>
                    </tr>
                `;
            });
            
            card.innerHTML += `
                        </tbody>
                    </table>
                </div>
            `;
        }

        // Recommendations
        if (analysis.recommendations.length > 0) {
            card.innerHTML += `<div class="recommendation"><h4>التوصيات</h4>`;
            
            analysis.recommendations.forEach((rec, index) => {
                card.innerHTML += `
                    <div>
                        <h4>توصية ${index + 1}</h4>
                        <p><strong>النوع:</strong> ${rec.type === 'buy' ? 'شراء' : rec.type === 'sell' ? 'بيع' : rec.type === 'wait' ? 'انتظار' : 'حذر'}</p>
                        <p><strong>الرسالة:</strong> ${rec.message}</p>
                        <p><strong>مستوى الثقة:</strong> ${rec.confidence?.toFixed(1) || 0}%</p>
                        ${rec.entry ? `<p><strong>نقطة الدخول:</strong> ${rec.entry.toFixed(2)} USDT</p>` : ''}
                        ${rec.targets ? `<p><strong>الأهداف:</strong> ${rec.targets.map(t => t.toFixed(2)).join(', ') + ' USDT'}</p>` : ''}
                        ${rec.stopLoss ? `<p><strong>وقف الخسارة:</strong> ${rec.stopLoss.toFixed(2)} USDT</p>` : ''}
                    </div>
                `;
            });
            
            card.innerHTML += `</div>`;
        }

        // Support & Resistance
        const support = analysis.dynamicLevels.support.length > 0 
            ? analysis.dynamicLevels.support.map(level => level.toFixed(2)).join(', ') 
            : analysis.patterns[0]?.targets.support.toFixed(2) || 'غير متوفر';
        
        const resistance = analysis.dynamicLevels.resistance.length > 0 
            ? analysis.dynamicLevels.resistance.map(level => level.toFixed(2)).join(', ') 
            : analysis.patterns[0]?.targets.resistance.toFixed(2) || 'غير متوفر';
        
        card.innerHTML += `
            <div class="pattern">
                <h4>مستويات الدعم والمقاومة</h4>
                <p><strong>الدعم:</strong> ${support} USDT</p>
                <p><strong>المقاومة:</strong> ${resistance} USDT</p>
            </div>
        `;

        resultsDiv.appendChild(card);
    }

    function renderErrorCard(pair, errorMessage) {
        const card = document.createElement('div');
        card.className = 'currency-card error';
        card.innerHTML = `
            <h3>${pair}</h3>
            <p class="error-message">${errorMessage}</p>
        `;
        resultsDiv.appendChild(card);
    }

    function showError(title, error) {
        resultsDiv.innerHTML = `
            <div class="error">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>${title}</h3>
                <p>${error.message}</p>
                <button onclick="location.reload()">
                    <i class="fas fa-sync-alt"></i> إعادة المحاولة
                </button>
            </div>
        `;
    }
});
