import React from 'react';

export interface HelpEntry {
    command: string;
    description: string;
    usage?: string;
    examples?: string[];
    details?: string;
}

interface HelpCardProps {
    type: 'menu' | 'detail';
    data: HelpEntry[] | HelpEntry;
}

export const HelpCard: React.FC<HelpCardProps> = ({ type, data }) => {
    const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '.');

    return (
        <html>
            <head>
                <script src="https://cdn.tailwindcss.com"></script>
                <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700;900&family=Roboto+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
                <style>{`
                    body { font-family: 'Noto Sans SC', sans-serif; }
                    .font-mono { font-family: 'Roboto Mono', monospace; }
                    .ak-bg { 
                        background-color: #121212; 
                        background-image: 
                            linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
                        background-size: 40px 40px;
                    }
                    .ak-clip-tr { clip-path: polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 0 100%); }
                    .ak-clip-bl { clip-path: polygon(0 0, 100% 0, 100% 100%, 20px 100%, 0 calc(100% - 20px)); }
                    .ak-stripe {
                        background: repeating-linear-gradient(
                            45deg,
                            rgba(0, 0, 0, 0.1),
                            rgba(0, 0, 0, 0.1) 10px,
                            rgba(0, 0, 0, 0.2) 10px,
                            rgba(0, 0, 0, 0.2) 20px
                        );
                    }
                `}</style>
            </head>
            <body className="ak-bg text-gray-200 min-h-screen p-12 flex flex-col">
                {/* Header */}
                <header className="flex justify-between items-start mb-12 relative">
                    <div className="absolute top-0 left-0 w-32 h-1 bg-[#ff5000]"></div>
                    <div className="pt-6">
                        <h1 className="text-6xl font-black tracking-tighter text-white mb-2">
                            PRTS <span className="text-[#ff5000]">HELP</span>
                        </h1>
                        <div className="flex items-center gap-4 text-sm font-mono text-gray-400 tracking-widest">
                            <span className="bg-gray-800 px-2 py-0.5 text-white">SYS.VER.3.0</span>
                            <span>// RHODES ISLAND TERMINAL</span>
                        </div>
                    </div>
                    <div className="text-right pt-6">
                        <div className="text-5xl font-mono font-bold text-gray-800 select-none">00:01</div>
                        <div className="text-[#ff5000] font-mono font-bold mt-2">{currentDate}</div>
                    </div>
                </header>

                {/* Content */}
                <main className="flex-grow relative z-10">
                    {type === 'menu' ? (
                        <MenuContent entries={data as HelpEntry[]} />
                    ) : (
                        <DetailContent entry={data as HelpEntry} />
                    )}
                </main>

                {/* Footer */}
                <footer className="mt-16 pt-6 border-t border-gray-800 flex justify-between items-end text-xs text-gray-600 font-mono uppercase tracking-wider">
                    <div>
                        <p>Rhodes Island Pharmaceutical Inc.</p>
                        <p>Copyright © 2026 All Rights Reserved.</p>
                    </div>
                    <div className="flex gap-8">
                        <div>
                            <div className="w-20 h-1 bg-gray-800 mb-1"></div>
                            <span>SECURE CONNECTION</span>
                        </div>
                        <div>
                            <div className="w-20 h-1 bg-[#ff5000] mb-1"></div>
                            <span className="text-white">ONLINE</span>
                        </div>
                    </div>
                </footer>
                
                {/* Decorative Background Elements */}
                <div className="fixed top-1/2 right-0 transform -translate-y-1/2 translate-x-1/3 w-[600px] h-[600px] border-[40px] border-gray-800/20 rounded-full pointer-events-none"></div>
                <div className="fixed bottom-0 left-0 w-full h-32 bg-gradient-to-t from-black/80 to-transparent pointer-events-none"></div>
            </body>
        </html>
    );
};

const MenuContent: React.FC<{ entries: HelpEntry[] }> = ({ entries }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {entries.map((entry, index) => (
                <div key={entry.command} className="relative group">
                    <div className="absolute inset-0 bg-gray-800 transform translate-x-2 translate-y-2 transition-transform group-hover:translate-x-3 group-hover:translate-y-3"></div>
                    <div className="relative bg-[#1e1e1e] border border-gray-700 p-6 h-full ak-clip-tr transition-transform group-hover:-translate-y-1">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-2xl font-bold text-white group-hover:text-[#ff5000] transition-colors">
                                /{entry.command}
                            </h3>
                            <span className="font-mono text-xs text-gray-600">{(index + 1).toString().padStart(2, '0')}</span>
                        </div>
                        <p className="text-gray-400 text-sm leading-relaxed mb-4 border-l-2 border-gray-700 pl-3">
                            {entry.description}
                        </p>
                        <div className="font-mono text-xs text-gray-500 bg-black/30 p-2 rounded">
                            {entry.usage || `/${entry.command}`}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

const DetailContent: React.FC<{ entry: HelpEntry }> = ({ entry }) => {
    return (
        <div className="relative">
            <div className="absolute -left-4 top-0 bottom-0 w-1 bg-[#ff5000]"></div>
            <div className="pl-8">
                <div className="mb-8">
                    <h2 className="text-5xl font-black text-white mb-4">/{entry.command}</h2>
                    <p className="text-xl text-gray-300 max-w-2xl">{entry.description}</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-8">
                        {/* Usage Section */}
                        <Section title="USAGE SYNTAX">
                            <div className="bg-black/40 border border-gray-700 p-4 font-mono text-[#ff5000]">
                                {entry.usage || `/${entry.command}`}
                            </div>
                        </Section>

                        {/* Details Section */}
                        {entry.details && (
                            <Section title="SYSTEM DETAILS">
                                <div className="text-gray-300 leading-relaxed whitespace-pre-wrap font-light">
                                    {entry.details}
                                </div>
                            </Section>
                        )}
                    </div>

                    <div className="space-y-8">
                        {/* Examples Section */}
                        {entry.examples && entry.examples.length > 0 && (
                            <Section title="EXAMPLES">
                                <div className="space-y-3">
                                    {entry.examples.map((ex, i) => (
                                        <div key={i} className="bg-[#1e1e1e] p-3 border-l-2 border-gray-600 text-sm font-mono text-gray-400">
                                            {ex}
                                        </div>
                                    ))}
                                </div>
                            </Section>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div>
        <h4 className="text-[#ff5000] font-bold tracking-widest text-sm mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-[#ff5000] rotate-45"></span>
            {title}
        </h4>
        {children}
    </div>
);
