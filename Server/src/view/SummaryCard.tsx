import React from 'react';

export interface SummaryData {
    timeRange: string;
    messageCount: number;
    oneSentenceSummary: string;
    topics: { name: string; description: string }[];
    participants: { name: string; messageCount: number; highlight: string }[];
    mood: string;
    highlights: string[];
}

const ACCENT_COLORS = ['#ff5000', '#00b4d8', '#8338ec', '#06d6a0', '#ffd166'];

export const SummaryCard: React.FC<{ data: SummaryData }> = ({ data }) => {
    return (
        <html>
            <head>
                <script src="https://cdn.tailwindcss.com"></script>
                <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700;900&family=Roboto+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
                <style>{`
                    body { font-family: 'Noto Sans SC', sans-serif; margin: 0; padding: 0; }
                    .font-mono { font-family: 'Roboto Mono', monospace; }
                    .summary-bg {
                        background-color: #0f0f0f;
                        background-image:
                            radial-gradient(circle at 20% 50%, rgba(255, 80, 0, 0.04) 0%, transparent 50%),
                            radial-gradient(circle at 80% 20%, rgba(0, 180, 216, 0.03) 0%, transparent 50%),
                            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
                        background-size: 100%, 100%, 32px 32px, 32px 32px;
                    }
                    .bubble-left { border-radius: 2px 16px 16px 16px; }
                    .glass { background: rgba(255,255,255,0.04); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.06); }
                `}</style>
            </head>
            <body className="summary-bg text-gray-200" style={{ width: 700, padding: 40 }}>
                <Header data={data} />
                <TldrSection text={data.oneSentenceSummary} />
                <TopicsSection topics={data.topics} />
                <ParticipantsSection participants={data.participants} />
                <HighlightsSection highlights={data.highlights} />
                <Footer mood={data.mood} />
            </body>
        </html>
    );
};

const Header: React.FC<{ data: SummaryData }> = ({ data }) => (
    <header style={{ marginBottom: 32 }}>
        <div style={{ width: 48, height: 3, background: '#ff5000', marginBottom: 20 }}></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
                <h1 className="text-4xl font-black tracking-tight text-white" style={{ margin: 0, marginBottom: 6 }}>
                    CHAT <span style={{ color: '#ff5000' }}>SUMMARY</span>
                </h1>
                <div className="font-mono text-xs" style={{ color: '#666', letterSpacing: 2 }}>
                    // GROUP CONVERSATION ANALYSIS
                </div>
            </div>
            <div style={{ textAlign: 'right' }}>
                <div className="font-mono text-sm" style={{ color: '#888' }}>{data.timeRange}</div>
                <div className="font-mono text-xs" style={{ color: '#ff5000', marginTop: 4 }}>
                    {data.messageCount} MESSAGES
                </div>
            </div>
        </div>
        <div style={{ height: 1, background: 'linear-gradient(to right, #ff5000, transparent)', marginTop: 16 }}></div>
    </header>
);

const TldrSection: React.FC<{ text: string }> = ({ text }) => (
    <div className="glass" style={{ borderRadius: 8, padding: '16px 20px', marginBottom: 28, borderLeft: '3px solid #ff5000' }}>
        <div className="font-mono text-xs" style={{ color: '#ff5000', marginBottom: 6, letterSpacing: 2 }}>TL;DR</div>
        <div style={{ color: '#e0e0e0', fontSize: 15, lineHeight: 1.6 }}>{text}</div>
    </div>
);

const TopicsSection: React.FC<{ topics: SummaryData['topics'] }> = ({ topics }) => (
    <section style={{ marginBottom: 28 }}>
        <SectionTitle title="TOPICS" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {topics.map((topic, i) => (
                <div key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '12px 16px',
                    borderLeft: `3px solid ${ACCENT_COLORS[i % ACCENT_COLORS.length]}`
                }}>
                    <span className="font-mono text-xs" style={{ color: ACCENT_COLORS[i % ACCENT_COLORS.length], flexShrink: 0, marginTop: 2 }}>
                        #{(i + 1).toString().padStart(2, '0')}
                    </span>
                    <div>
                        <div className="font-bold text-sm text-white" style={{ marginBottom: 2 }}>{topic.name}</div>
                        <div className="text-xs" style={{ color: '#999', lineHeight: 1.5 }}>{topic.description}</div>
                    </div>
                </div>
            ))}
        </div>
    </section>
);

const ParticipantsSection: React.FC<{ participants: SummaryData['participants'] }> = ({ participants }) => {
    const maxCount = Math.max(...participants.map(p => p.messageCount), 1);
    return (
        <section style={{ marginBottom: 28 }}>
            <SectionTitle title="KEY PARTICIPANTS" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {participants.map((p, i) => {
                    const color = ACCENT_COLORS[i % ACCENT_COLORS.length];
                    return (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{
                                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                                    background: `linear-gradient(135deg, ${color}, ${color}88)`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 13, fontWeight: 700, color: '#fff'
                                }}>
                                    {p.name.charAt(0).toUpperCase()}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                        <span className="text-sm font-bold text-white">{p.name}</span>
                                        <span className="font-mono text-xs" style={{ color: '#666' }}>{p.messageCount} msgs</span>
                                    </div>
                                    <div style={{ height: 3, background: '#1a1a1a', borderRadius: 2, overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${(p.messageCount / maxCount) * 100}%`, background: color, borderRadius: 2 }}></div>
                                    </div>
                                </div>
                            </div>
                            {/* Chat bubble */}
                            <div className="bubble-left" style={{
                                marginLeft: 42, padding: '10px 14px',
                                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                                fontSize: 13, color: '#bbb', lineHeight: 1.5, fontStyle: 'italic'
                            }}>
                                "{p.highlight}"
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
};

const HighlightsSection: React.FC<{ highlights: string[] }> = ({ highlights }) => (
    <section style={{ marginBottom: 28 }}>
        <SectionTitle title="HIGHLIGHTS" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {highlights.map((h, i) => (
                <div key={i} style={{
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                    padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 6
                }}>
                    <span className="font-mono text-xs" style={{ color: '#ff5000', flexShrink: 0, marginTop: 1 }}>▸</span>
                    <span className="text-sm" style={{ color: '#ccc', lineHeight: 1.5 }}>{h}</span>
                </div>
            ))}
        </div>
    </section>
);

const Footer: React.FC<{ mood: string }> = ({ mood }) => (
    <footer style={{ paddingTop: 16, borderTop: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="font-mono text-xs" style={{ color: '#444', letterSpacing: 1 }}>
            MEOWSEV ANALYTICS
        </div>
        <div style={{
            padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
            background: 'rgba(255, 80, 0, 0.12)', color: '#ff5000', border: '1px solid rgba(255, 80, 0, 0.2)'
        }}>
            {mood}
        </div>
    </footer>
);

const SectionTitle: React.FC<{ title: string }> = ({ title }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ width: 6, height: 6, background: '#ff5000', transform: 'rotate(45deg)' }}></div>
        <span className="font-mono text-xs font-bold" style={{ color: '#ff5000', letterSpacing: 3 }}>{title}</span>
    </div>
);
