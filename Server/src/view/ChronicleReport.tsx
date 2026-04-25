import React from 'react';
import type { ChronicleMessage } from '@/config/AI/plugins/chronicle';

export interface ChronicleReportProps {
    messages: ChronicleMessage[];
    comment?: string;
    title?: string;
}

const STYLES = `
body { font-family: 'Noto Serif SC', 'Noto Sans SC', serif; margin: 0; padding: 0; }
.bg { background: linear-gradient(180deg, #f5e6c8 0%, #efe0b8 50%, #e8d5a3 100%); }
.bar-top {
  height: 28px;
  background: linear-gradient(180deg, #7a5230, #5c3d2e 40%, #4a3020);
  border: 1px solid #3a2218;
  box-shadow: 0 3px 8px rgba(60,30,10,0.35);
}
.bar-bot {
  height: 28px;
  background: linear-gradient(0deg, #7a5230, #5c3d2e 40%, #4a3020);
  border: 1px solid #3a2218;
  box-shadow: 0 -3px 8px rgba(60,30,10,0.35);
}
`;

export const ChronicleReport: React.FC<ChronicleReportProps> = ({
    messages, comment, title,
}) => {
    const heading = title || '岁月史书 · 考古报告';
    const now = new Date().toLocaleString('zh-CN', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
    });

    return (
        <html>
            <head>
                <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700;900&family=Noto+Sans+SC:wght@400;500;700&display=swap" rel="stylesheet" />
                <style>{STYLES}</style>
            </head>
            <body className="bg" style={{ width: 700, padding: 0, margin: 0 }}>
                <div className="bar-top" />
                <div style={{ padding: '28px 40px 20px' }}>
                    <Header title={heading} />
                    <MessageList messages={messages} />
                    {comment && <Comment text={comment} />}
                    <Footer time={now} />
                </div>
                <div className="bar-bot" />
            </body>
        </html>
    );
};

const Header: React.FC<{ title: string }> = ({ title }) => (
    <header style={{ marginBottom: 24, textAlign: 'center', position: 'relative' }}>
        <div style={{
            position: 'absolute', top: -8, right: 0,
            width: 56, height: 56, borderRadius: 4,
            border: '3px solid #c0392b', opacity: 0.6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transform: 'rotate(-12deg)',
            fontSize: 16, fontWeight: 900, color: '#c0392b',
        }}>考古</div>
        <div style={{
            fontSize: 26, fontWeight: 900, color: '#3a2218',
            letterSpacing: 4, marginBottom: 8,
        }}>📜 {title}</div>
        <div style={{
            width: '80%', height: 2, margin: '0 auto',
            background: 'linear-gradient(90deg, transparent, #8b6914, transparent)',
        }} />
    </header>
);

const MessageList: React.FC<{ messages: ChronicleMessage[] }> = ({ messages }) => (
    <div style={{
        paddingLeft: 20,
        borderLeft: '2px solid rgba(139,105,20,0.3)',
        marginBottom: 24,
    }}>
        {messages.map((msg, i) => (
            <div key={i} style={{
                background: 'rgba(139,105,20,0.08)',
                borderLeft: '3px solid #c0392b',
                padding: '8px 14px', marginBottom: 10,
                borderRadius: '0 4px 4px 0',
            }}>
                <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    marginBottom: 4, fontSize: 12,
                    fontFamily: "'Noto Sans SC', sans-serif",
                }}>
                    <span style={{ color: '#5c3d2e', fontWeight: 700 }}>{msg.user}</span>
                    <span style={{ color: '#8b6914' }}>{msg.time}</span>
                </div>
                <div style={{
                    fontSize: 14, lineHeight: 1.8, color: '#3a2218',
                }}>{msg.content}</div>
            </div>
        ))}
    </div>
);

const Comment: React.FC<{ text: string }> = ({ text }) => (
    <div style={{
        background: 'rgba(192,57,43,0.06)',
        border: '1px dashed #c0392b',
        borderRadius: 6, padding: '10px 16px',
        marginBottom: 20, fontSize: 14,
        lineHeight: 1.8, color: '#5c3d2e',
        fontStyle: 'italic',
    }}>
        🖊️ {text}
    </div>
);

const Footer: React.FC<{ time: string }> = ({ time }) => (
    <footer style={{
        textAlign: 'center', paddingTop: 16,
        borderTop: '1px dashed rgba(139,105,20,0.3)',
    }}>
        <div style={{
            fontSize: 12, color: '#8b6914', marginBottom: 4,
            fontFamily: "'Noto Sans SC', sans-serif",
        }}>{time}</div>
        <div style={{
            fontSize: 13, color: '#5c3d2e', fontWeight: 600,
            letterSpacing: 3,
        }}>— 翻阅古籍完毕 —</div>
    </footer>
);
