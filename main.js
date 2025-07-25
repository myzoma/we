document.addEventListener('DOMContentLoaded', () => {
    const analyzeButton = document.getElementById('analyzeButton');
    analyzeButton.addEventListener('click', runAnalysis);

    async function runAnalysis() {
        const resultsDiv = document.getElementById('analysisResults');
        resultsDiv.innerHTML = '<p>جاري تحليل السوق...</p>';

        try {
            // Fetch K-line data from Binance API (BTC/USDT, 1h timeframe, last 100 candles)
            const response = await fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=100');
            const klineData = await response.json();

            if (!Array.isArray(klineData) || klineData.length === 0) {
                resultsDiv.innerHTML = '<p class="error">فشل في جلب بيانات السوق</p>';
                return;
            }

            // Initialize ElliottWaveAnalyzer
            const analyzer = new ElliottWaveAnalyzer();
            const analysis = analyzer.analyze(klineData);

            // Clear previous results
            resultsDiv.innerHTML = '';

            // Display results based on analysis status
            if (analysis.status !== 'success') {
                resultsDiv.innerHTML = `<p class="error">${analysis.message || 'خطأ في التحليل'}</p>`;
                return;
            }

            // Display general analysis summary
            resultsDiv.innerHTML += `<h3>ملخص التحليل</h3>`;
            resultsDiv.innerHTML += `<p><strong>الحالة:</strong> ناجح</p>`;
            resultsDiv.innerHTML += `<p><strong>السعر الحالي:</strong> ${analysis.currentPrice.toFixed(2)}</p>`;
            resultsDiv.innerHTML += `<p><strong>الاتجاه العام:</strong> ${analyzer.translateTrend(analysis.trend)}</p>`;
            resultsDiv.innerHTML += `<p><strong>ملخص:</strong> ${analysis.summary}</p>`;

            // Display current wave analysis if available
            if (analysis.currentWaveAnalysis) {
                resultsDiv.innerHTML += `<h3>تحليل الموجة الحالية</h3>`;
                resultsDiv.innerHTML += `<p><strong>نوع الموجة:</strong> ${analyzer.translateWaveType(analysis.currentWaveAnalysis.currentWave)}</p>`;
                if (analysis.currentWaveAnalysis.expectedTarget) {
                    resultsDiv.innerHTML += `<p><strong>الهدف المتوقع:</strong> ${analysis.currentWaveAnalysis.expectedTarget.toFixed(2)}</p>`;
                }
                if (analysis.currentWaveAnalysis.stopLoss) {
                    resultsDiv.innerHTML += `<p><strong>وقف الخسارة:</strong> ${analysis.currentWaveAnalysis.stopLoss.toFixed(2)}</p>`;
                }
                resultsDiv.innerHTML += `<p><strong>مستوى الثقة:</strong> ${analysis.currentWaveAnalysis.confidence.toFixed(1)}%</p>`;
                resultsDiv.innerHTML += `<p><strong>الإطار الزمني:</strong> ${analysis.currentWaveAnalysis.timeframe}</p>`;
                if (analysis.currentWaveAnalysis.riskReward) {
                    resultsDiv.innerHTML += `<p><strong>نسبة المخاطرة/العائد:</strong> ${analysis.currentWaveAnalysis.riskReward}</p>`;
                }
            }

            // Display detected patterns
            if (analysis.patterns.length > 0) {
                resultsDiv.innerHTML += `<h3>الأنماط المكتشفة (${analysis.patterns.length})</h3>`;
                analysis.patterns.slice(0, 3).forEach((pattern, index) => {
                    const patternDiv = document.createElement('div');
                    patternDiv.className = 'pattern';
                    patternDiv.innerHTML = `
                        <h3>نمط ${index + 1}: ${pattern.type === 'motive' ? 'دافع' : 'تصحيحي'} (${pattern.direction === 'bullish' ? 'صاعد' : 'هابط'})</h3>
                        <p><strong>مستوى الثقة:</strong> ${pattern.confidence.toFixed(1)}%</p>
                        <p><strong>عدد النقاط:</strong> ${pattern.points.length}</p>
                        <p><strong>نسبة التغيير:</strong> ${pattern.waves[0].percentage.toFixed(2)}%</p>
                        <p><strong>تحليل فيبوناتشي:</strong></p>
                        <ul>
                            ${Object.entries(pattern.fibonacciAnalysis).map(([wave, data]) => `
                                <li>${wave}: نسبة ${data.retracement ? data.retracement.toFixed(3) : data.ratio.toFixed(3)}, مستوى فيبوناتشي ${data.fibLevel.toFixed(3)} (${data.isValid ? 'صالح' : 'غير صالح'})</li>
                            `).join('')}
                        </ul>
                        <p><strong>الأهداف:</strong></p>
                        <ul>
                            ${Object.entries(pattern.targets)
                                .filter(([key, value]) => typeof value === 'number' && key !== 'support' && key !== 'resistance')
                                .map(([key, value]) => `<li>${key}: ${value.toFixed(2)}</li>`).join('')}
                        </ul>
                        <p><strong>الدعم:</strong> ${pattern.targets.support.toFixed(2)}</p>
                        <p><strong>المقاومة:</strong> ${pattern.targets.resistance.toFixed(2)}</p>
                    `;
                    resultsDiv.appendChild(patternDiv);
                });
            }

            // Display dynamic levels
            resultsDiv.innerHTML += `<h3>مستويات الدعم والمقاومة</h3>`;
            resultsDiv.innerHTML += `<p><strong>الدعم:</strong> ${analysis.dynamicLevels.support.map(level => level.toFixed(2)).join(', ')}</p>`;
            resultsDiv.innerHTML += `<p><strong>المقاومة:</strong> ${analysis.dynamicLevels.resistance.map(level => level.toFixed(2)).join(', ')}</p>`;
            resultsDiv.innerHTML += `<p><strong>الأهداف:</strong> ${analysis.dynamicLevels.targets.map(target => target.toFixed(2)).join(', ')}</p>`;

            // Display recommendations
            if (analysis.recommendations.length > 0) {
                resultsDiv.innerHTML += `<h3>التوصيات</h3>`;
                analysis.recommendations.forEach((rec, index) => {
                    const recDiv = document.createElement('div');
                    recDiv.className = 'pattern';
                    recDiv.innerHTML = `
                        <h3>توصية ${index + 1}</h3>
                        <p><strong>النوع:</strong> ${rec.type === 'buy' ? 'شراء' : rec.type === 'sell' ? 'بيع' : rec.type === 'wait' ? 'انتظار' : 'حذر'}</p>
                        <p><strong>الرسالة:</strong> ${rec.message}</p>
                        <p><strong>مستوى الثقة:</strong> ${rec.confidence ? rec.confidence.toFixed(1) : 0}%</p>
                        ${rec.entry ? `<p><strong>نقطة الدخول:</strong> ${rec.entry.toFixed(2)}</p>` : ''}
                        ${rec.targets ? `<p><strong>الأهداف:</strong> ${rec.targets.map(t => t.toFixed(2)).join(', ')}</p>` : ''}
                        ${rec.stopLoss ? `<p><strong>وقف الخسارة:</strong> ${rec.stopLoss.toFixed(2)}</p>` : ''}
                        ${rec.expectedCompletion ? `<p><strong>التكملة المتوقعة:</strong> ${rec.expectedCompletion.toFixed(2)}</p>` : ''}
                    `;
                    resultsDiv.appendChild(recDiv);
                });
            }

            // Display nested patterns if available
            if (analysis.nestedPatterns.length > 0) {
                resultsDiv.innerHTML += `<h3>الأنماط المتداخلة (${analysis.nestedPatterns.length})</h3>`;
                analysis.nestedPatterns.slice(0, 3).forEach((nested, index) => {
                    const nestedDiv = document.createElement('div');
                    nestedDiv.className = 'pattern';
                    nestedDiv.innerHTML = `
                        <h3>نمط متداخل ${index + 1}</h3>
                        <p><strong>الاتجاه:</strong> ${nested.direction === 'up' ? 'صاعد' : 'هابط'}</p>
                        <p><strong>الطول:</strong> ${nested.length.toFixed(2)}</p>
                        <p><strong>نسبة التغيير:</strong> ${nested.percentage.toFixed(2)}%</p>
                        <p><strong>الإطار الزمني:</strong> ${(nested.timeframe / (1000 * 60 * 60)).toFixed(2)} ساعة</p>
                    `;
                    resultsDiv.appendChild(nestedDiv);
                });
            }

        } catch (error) {
            resultsDiv.innerHTML = `<p class="error">خطأ في تحليل السوق: ${error.message}</p>`;
        }
    }
});