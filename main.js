document.addEventListener('DOMContentLoaded', () => {
    const analyzeButton = document.getElementById('analyzeButton');
    const resultsDiv = document.getElementById('analysisResults');

    if (!analyzeButton || !resultsDiv) {
        console.error('عناصر الواجهة غير موجودة');
        resultsDiv.innerHTML = '<p class="error">خطأ في تحميل الواجهة</p>';
        return;
    }

    // List of Binance API endpoints
    const endpoints = [
        'https://api.binance.com',
        'https://api1.binance.com',
        'https://api2.binance.com',
        'https://api3.binance.com',
        'https://api4.binance.com',
        'https://data-api.binance.vision'
    ];

    // CORS proxy for development
    const corsProxy = 'https://cors-anywhere.herokuapp.com/';

    async function fetchWithFallback(url, options = {}, endpointIndex = 0) {
        if (endpointIndex >= endpoints.length) {
            throw new Error('فشل الاتصال بجميع الـ endpoints');
        }

        const currentEndpoint = endpoints[endpointIndex];
        const proxiedUrl = url.replace(/^https:\/\/(api\d?\.binance\.com|data-api\.binance\.vision)/, `${corsProxy}$1`);

        try {
            const response = await fetch(proxiedUrl, {
                ...options,
                headers: { ...options.headers },
                timeout: 10000
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.warn(`فشل ${proxiedUrl}: ${error.message}. جاري تجربة endpoint آخر...`);
            return fetchWithFallback(url.replace(currentEndpoint, endpoints[endpointIndex + 1]), options, endpointIndex + 1);
        }
    }

    analyzeButton.addEventListener('click', async () => {
        resultsDiv.innerHTML = '<p class="loading">جاري فلترة السوق وتحليل العملات...</p>';

        try {
            if (typeof ElliottWaveAnalyzer === 'undefined') {
                resultsDiv.innerHTML = '<p class="error">خطأ: ملف elliottWaveAnalyzer.js غير محمل أو يحتوي على أخطاء.</p>';
                console.error('ElliottWaveAnalyzer غير معرف');
                return;
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
                ws.onerror = () => console.warn('فشل WebSocket، الاعتماد على بيانات API فقط');
                await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (wsError) {
                console.warn('خطأ WebSocket:', wsError.message);
            }

            // Fetch trading pairs
            let nonBtcPairs = [];
            try {
                const exchangeInfo = await fetchWithFallback(`${endpoints[0]}/api/v3/exchangeInfo`);
                nonBtcPairs = exchangeInfo.symbols
                    .filter(symbol => symbol.quoteAsset === 'USDT' && !symbol.baseAsset.includes('BTC') && !symbol.symbol.includes('BTC'))
                    .map(symbol => symbol.symbol)
                    .slice(0, 5);
            } catch (error) {
                console.warn('فشل جلب قائمة الأزواج:', error.message);
                resultsDiv.innerHTML = '<p class="error">فشل جلب قائمة أزواج التداول. يرجى المحاولة لاحقاً.</p>';
                return;
            }

            if (!nonBtcPairs.length) {
                resultsDiv.innerHTML = '<p class="error">لم يتم العثور على أزواج تداول غير بيتكوين.</p>';
                return;
            }

            resultsDiv.innerHTML = '';
            const analyzer = new ElliottWaveAnalyzer();

            // Analyze each pair
            for (const pair of nonBtcPairs) {
                try {
                    let klineData;
                    try {
                        klineData = await fetchWithFallback(`${endpoints[0]}/api/v3/klines?symbol=${pair}&interval=1h&limit=100`);
                    } catch (apiError) {
                        console.warn(`فشل جلب بيانات ${pair}:`, apiError.message);
                        continue; // تخطي هذا الزوج إذا فشل جلب البيانات
                    }

                    if (!Array.isArray(klineData) || klineData.length < 20) {
                        console.warn(`بيانات غير كافية لـ ${pair}`);
                        continue;
                    }

                    const analysis = analyzer.analyze(klineData);
                    if (analysis.status !== 'success') {
                        console.warn(`فشل تحليل ${pair}: ${analysis.message}`);
                        continue;
                    }

                    analysis.currentPrice = wsData[pair] || analysis.currentPrice;

                    // Create currency card
                    const card = document.createElement('div');
                    card.className = 'currency-card';
                    card.innerHTML = `
                        <h3>${pair} (${analyzer.translateTrend(analysis.trend)})</h3>
                        <p><strong>السعر الحالي:</strong> ${parseFloat(analysis.currentPrice).toFixed(2)} USDT</p>
                        <p><strong>ملخص:</strong> ${analysis.summary}</p>
                    `;

                    // Current wave analysis
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

                    // Detected patterns (in table)
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
                            const percentage = pattern.waves && pattern.waves[0] && pattern.waves[0].percentage 
                                ? pattern.waves[0].percentage.toFixed(2) 
                                : ((pattern.points[pattern.points.length - 1][1] - pattern.points[0][1]) / pattern.points[0][1] * 100).toFixed(2);
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
                                    <p><strong>مستوى الثقة:</strong> ${rec.confidence ? rec.confidence.toFixed(1) : 0}%</p>
                                    ${rec.entry ? `<p><strong>نقطة الدخول:</strong> ${rec.entry.toFixed(2)} USDT</p>` : ''}
                                    ${rec.targets ? `<p><strong>الأهداف:</strong> ${rec.targets.map(t => t.toFixed(2)).join(', ') + ' USDT'}</p>` : ''}
                                    ${rec.stopLoss ? `<p><strong>وقف الخسارة:</strong> ${rec.stopLoss.toFixed(2)} USDT</p>` : ''}
                                </div>
                            `;
                        });
                        card.innerHTML += `</div>`;
                    }

                    // Dynamic levels
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
                } catch (pairError) {
                    console.warn(`خطأ في تحليل ${pair}: ${pairError.message}`);
                }
            }

            if (!resultsDiv.hasChildNodes()) {
                resultsDiv.innerHTML = '<p class="error">لم يتم العثور على تحليلات صالحة للعملات غير بيتكوين.</p>';
            }
        } catch (error) {
            resultsDiv.innerHTML = `<p class="error">خطأ في تحليل السوق: ${error.message}</p>`;
            console.error('خطأ:', error);
        }
    });
});
