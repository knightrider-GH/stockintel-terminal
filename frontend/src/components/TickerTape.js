import React from 'react';
import { motion } from 'framer-motion';

const TickerTape = ({ indices, dark }) => {
  if (!indices || indices.length === 0) return null;

  // Duplicate items for seamless loop
  const displayItems = [...indices, ...indices, ...indices];

  return (
    <div style={{
      width: '100%',
      overflow: 'hidden',
      background: dark ? '#05070a' : '#ffffff',
      borderBottom: `1px solid ${dark ? '#1e2a3a' : '#e8edf5'}`,
      padding: '10px 0',
      whiteSpace: 'nowrap',
      position: 'relative'
    }}>
      <motion.div
        animate={{ x: [0, -1000] }}
        transition={{
          repeat: Infinity,
          duration: 30,
          ease: "linear"
        }}
        style={{ display: 'inline-block' }}
      >
        {displayItems.map((item, i) => (
          <div key={i} style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            fontSize: '14px',
            fontWeight: '800',
            letterSpacing: '0.5px'
          }}>
            <span style={{ color: dark ? '#94a3b8' : '#64748b', marginRight: '8px' }}>{item.name}</span>
            <span style={{ color: dark ? '#f1f5f9' : '#1a202c', marginRight: '10px' }}>{item.price.toLocaleString('en-IN')}</span>
            <span style={{ 
              color: item.change >= 0 ? '#10b981' : '#ef4444',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              {item.change >= 0 ? '▲' : '▼'}
              {Math.abs(item.changePct)}%
            </span>
            {/* SEPARATOR */}
            <div style={{ width: '1px', height: '14px', background: dark ? '#1e2a3a' : '#e8edf5', margin: '0 30px' }}></div>
          </div>
        ))}
      </motion.div>
    </div>
  );
};

export default TickerTape;
