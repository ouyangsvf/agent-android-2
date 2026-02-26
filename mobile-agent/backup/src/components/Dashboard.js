/**
 * Dashboard - 数据统计面板
 * 展示连接时长、指令执行等统计信息
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

export const Dashboard = ({ stats, isConnected, theme }) => {
  const [uptime, setUptime] = useState(0);

  useEffect(() => {
    if (!isConnected || !stats.connectedTime) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - stats.connectedTime) / 1000);
      setUptime(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [isConnected, stats.connectedTime]);

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return '无';
    const diff = Math.floor((Date.now() - timestamp) / 60000);
    if (diff < 1) return '刚刚';
    if (diff < 60) return `${diff}分钟前`;
    return `${Math.floor(diff / 60)}小时前`;
  };

  const cards = [
    {
      title: '连接时长',
      value: isConnected ? formatTime(uptime) : '--:--:--',
      icon: '⏱️',
      color: '#4CAF50',
    },
    {
      title: '执行指令',
      value: stats.commandsExecuted.toString(),
      icon: '⚡',
      color: '#2196F3',
    },
    {
      title: '最后活动',
      value: formatTimeAgo(stats.lastCommand?.time),
      icon: '🕐',
      color: '#FF9800',
    },
    {
      title: '连接状态',
      value: isConnected ? '正常' : '断开',
      icon: isConnected ? '✅' : '❌',
      color: isConnected ? '#4CAF50' : '#f44336',
    },
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.grid}>
        {cards.map((card, index) => (
          <View
            key={index}
            style={[styles.card, { backgroundColor: theme.card }]}
          >
            <View style={[styles.iconBg, { backgroundColor: `${card.color}20` }]}>
              <Text style={styles.icon}>{card.icon}</Text>
            </View>
            <Text style={[styles.value, { color: theme.text }]}>{card.value}</Text>
            <Text style={[styles.title, { color: theme.textSecondary }]}>{card.title}</Text>
          </View>
        ))}
      </View>

      {/* 活动图表占位 */}
      <View style={[styles.chartCard, { backgroundColor: theme.card }]}>
        <Text style={[styles.chartTitle, { color: theme.text }]}>📊 活动趋势</Text>
        <View style={styles.chartPlaceholder}>
          <Text style={[styles.placeholderText, { color: theme.textSecondary }]}>
            功能开发中...
          </Text>
        </View>
      </View>

      {/* 系统状态 */}
      <View style={[styles.statusCard, { backgroundColor: theme.card }]}>
        <Text style={[styles.statusTitle, { color: theme.text }]}>🔧 系统状态</Text>
        <View style={styles.statusList}>
          <View style={styles.statusItem}>
            <View style={[styles.statusDot, { backgroundColor: '#4CAF50' }]} />
            <Text style={[styles.statusText, { color: theme.text }]}>WebSocket 服务</Text>
            <Text style={[styles.statusValue, { color: '#4CAF50' }]}>
              {isConnected ? '运行中' : '已停止'}
            </Text>
          </View>
          <View style={styles.statusItem}>
            <View style={[styles.statusDot, { backgroundColor: '#4CAF50' }]} />
            <Text style={[styles.statusText, { color: theme.text }]}>指令执行器</Text>
            <Text style={[styles.statusValue, { color: '#4CAF50' }]}>就绪</Text>
          </View>
          <View style={styles.statusItem}>
            <View style={[styles.statusDot, { backgroundColor: '#4CAF50' }]} />
            <Text style={[styles.statusText, { color: theme.text }]}>本地存储</Text>
            <Text style={[styles.statusValue, { color: '#4CAF50' }]}>正常</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: (width - 48) / 2,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  iconBg: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  icon: {
    fontSize: 24,
  },
  value: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  title: {
    fontSize: 12,
  },
  chartCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  chartPlaceholder: {
    height: 150,
    borderRadius: 12,
    backgroundColor: 'rgba(128,128,128,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 14,
  },
  statusCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  statusList: {
    gap: 12,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  statusText: {
    flex: 1,
    fontSize: 14,
  },
  statusValue: {
    fontSize: 13,
    fontWeight: '500',
  },
});
