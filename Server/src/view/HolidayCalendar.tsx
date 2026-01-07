import React from 'react';

export interface HolidayItem {
  holiday: boolean;
  name: string;
  wage: number;
  date: string;
  rest: number;
}

export interface HolidayData {
  [date: string]: HolidayItem;
}

interface HolidayCalendarProps {
  year: number;
  data: HolidayData;
}

const styles: { [key: string]: React.CSSProperties }  = {
  container: {
    fontFamily: '"Rajdhani", "Noto Sans SC", sans-serif',
    backgroundColor: '#1a1a1a',
    color: '#ffffff',
    padding: '40px',
    width: '1200px',
    minHeight: '800px',
    position: 'relative' as const,
    overflow: 'hidden',
  },
  header: {
    borderBottom: '2px solid #ffffff',
    paddingBottom: '20px',
    marginBottom: '30px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  title: {
    fontSize: '64px',
    fontWeight: 'bold',
    lineHeight: '1',
    letterSpacing: '4px',
    color: '#ffffff',
    textShadow: '0 0 10px rgba(255,255,255,0.3)',
  },
  subTitle: {
    fontSize: '24px',
    color: '#ffcd00',
    letterSpacing: '2px',
    marginBottom: '5px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '20px',
  },
  monthCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    border: '1px solid #444',
    padding: '15px',
    position: 'relative' as const,
  },
  monthTitle: {
    fontSize: '24px',
    fontWeight: 'bold',
    borderBottom: '1px solid #444',
    paddingBottom: '10px',
    marginBottom: '10px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  monthNum: {
    fontSize: '36px',
    color: 'rgba(255,255,255,0.1)',
    position: 'absolute' as const,
    top: '5px',
    right: '10px',
    fontWeight: 'bold',
  },
  dayGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '2px',
    textAlign: 'center' as const,
  },
  dayHeader: {
    fontSize: '12px',
    color: '#888',
    marginBottom: '5px',
  },
  day: {
    fontSize: '14px',
    padding: '4px 0',
    position: 'relative' as const,
    height: '30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  holiday: {
    backgroundColor: 'rgba(255, 205, 0, 0.2)',
    color: '#ffcd00',
    border: '1px solid rgba(255, 205, 0, 0.5)',
  },
  work: {
    backgroundColor: '#333',
    color: '#aaa',
  },
  weekend: {
    color: '#ff4d4f',
  },
  today: {
    border: '1px solid #fff',
  },
  legend: {
    marginTop: '30px',
    display: 'flex',
    gap: '20px',
    fontSize: '14px',
    color: '#888',
    borderTop: '1px solid #333',
    paddingTop: '20px',
  },
  decoration: {
    position: 'absolute' as const,
    top: '20px',
    right: '20px',
    border: '1px solid rgba(255,255,255,0.2)',
    padding: '5px 10px',
    fontSize: '10px',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: '2px',
  },
  holidayName: {
    position: 'absolute' as const,
    bottom: '-25px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: '#ffcd00',
    color: '#000',
    padding: '2px 5px',
    fontSize: '10px',
    borderRadius: '2px',
    whiteSpace: 'nowrap' as const,
    zIndex: 10,
    opacity: 0, 
    // Since this is static rendering for image, hover effects won't work easily. 
    // We should probably display meaningful holidays only or list them separately.
  },
  listContainer: {
    marginTop: '20px',
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '10px',
  },
  listItem: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderLeft: '3px solid #ffcd00',
    padding: '10px',
  }
};

const MONTHS = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'
];

export const HolidayCalendar: React.FC<HolidayCalendarProps> = ({ year, data }) => {
  // Helper to get days in month
  const getDaysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (month: number, year: number) => new Date(year, month, 1).getDay();

  // Process data to get major holidays for list
  const holidays = Object.values(data).filter(h => h.holiday).sort((a, b) => a.date.localeCompare(b.date));
  const uniqueHolidays = holidays.filter((h, i, self) => 
    i === self.findIndex((t) => t.name === h.name)
  );

  return (
    <html>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;700&family=Noto+Sans+SC:wght@400;700&display=swap" rel="stylesheet" />
        <style dangerouslySetInnerHTML={{ __html: `
          body { margin: 0; padding: 0; background: #1a1a1a; }
          * { box-sizing: border-box; }
        ` }} />
      </head>
      <body>
        <div style={styles.container}>
          <div style={styles.decoration}>RHODES ISLAND // TERMINAL</div>
          
          <div style={styles.header}>
            <div>
              <div style={styles.title}>{year}</div>
              <div style={styles.subTitle}>HOLIDAY CALENDAR // 节假日安排</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>SYSTEM: ONLINE</div>
              <div style={{ fontSize: '12px', color: '#ffcd00' }}>DATA SOURCE: STATE COUNCIL</div>
            </div>
          </div>

          <div style={styles.grid}>
            {MONTHS.map((monthName, index) => {
              const daysInMonth = getDaysInMonth(index, year);
              const firstDay = getFirstDayOfMonth(index, year); // 0 = Sunday
              const days = [];

              // Empty slots for start of month
              for (let i = 0; i < firstDay; i++) {
                days.push(<div key={`empty-${i}`} style={styles.day}></div>);
              }

              // Days
              for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = `${year}-${String(index + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const monthDay = `${String(index + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                
                const info = data[monthDay];
                const isHoliday = info && info.holiday;
                const isWeekend = new Date(year, index, d).getDay() === 0 || new Date(year, index, d).getDay() === 6;
                
                let dayStyle = { ...styles.day };
                if (isHoliday) {
                  dayStyle = { ...dayStyle, ...styles.holiday };
                } else if (isWeekend) {
                   dayStyle = { ...dayStyle, color: '#888' }; // Normal weekend text color
                } else {
                   dayStyle = { ...dayStyle, color: '#fff' };
                }

                days.push(
                  <div key={d} style={dayStyle}>
                    {d}
                  </div>
                );
              }

              return (
                <div key={monthName} style={styles.monthCard}>
                  <div style={styles.monthNum}>{String(index + 1).padStart(2, '0')}</div>
                  <div style={styles.monthTitle}>
                    {monthName}
                  </div>
                  <div style={styles.dayGrid}>
                    <div style={styles.dayHeader}>S</div>
                    <div style={styles.dayHeader}>M</div>
                    <div style={styles.dayHeader}>T</div>
                    <div style={styles.dayHeader}>W</div>
                    <div style={styles.dayHeader}>T</div>
                    <div style={styles.dayHeader}>F</div>
                    <div style={styles.dayHeader}>S</div>
                    {days}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: '30px', borderTop: '1px solid #444', paddingTop: '20px' }}>
             <div style={{ fontSize: '18px', color: '#fff', marginBottom: '15px', borderLeft: '4px solid #ffcd00', paddingLeft: '10px' }}>
                HOLIDAY LIST
             </div>
             <div style={styles.listContainer}>
                {uniqueHolidays.map((h, i) => (
                  <div key={i} style={styles.listItem}>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', marginRight: '15px', color: '#ffcd00', width: '30px' }}>
                      {i + 1}
                    </div>
                    <div>
                      <div style={{ color: '#fff', fontWeight: 'bold' }}>{h.name}</div>
                      <div style={{ fontSize: '12px', color: '#888' }}>{h.date}</div>
                    </div>
                  </div>
                ))}
             </div>
          </div>

          <div style={styles.legend}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
               <div style={{ width: '12px', height: '12px', backgroundColor: 'rgba(255, 205, 0, 0.2)', border: '1px solid #ffcd00' }}></div>
               <span>HOLIDAY</span>
             </div>
             <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
               <div style={{ width: '12px', height: '12px', backgroundColor: '#1a1a1a', border: '1px solid #444' }}></div>
               <span>WORK DAY</span>
             </div>
          </div>
        </div>
      </body>
    </html>
  );
};
