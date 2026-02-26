/**
 * LogViewer - 日志显示组件 (v2.0)
 * 支持主题、紧凑模式、语法高亮
 */

import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';

export const LogViewer = ({ logs, compact = false, theme }) => {
  const getLogColor = (log) => {
    if (!theme) return '#0f0';
    if (log.includes('❌') || log.includes('错误') || log.includes('失败')) return '#f44336';
    if (log.includes('✅') || log.includes('成功')) return '#4CAF50';
    if (log.includes('⚠️') || log.includes('警告')) return '#FF9800';
    if (log.includes('🔄') || log.includes('正在')) return '#2196F3';
    return theme.text;
  };

  return (
    <View style={[styles.container, compact && styles.compactContainer]}>
      <ScrollView 
        style={[styles.scrollView, compact && styles.compactScroll]}
        showsVerticalScrollIndicator={true}
        contentContainerStyle={styles.contentContainer}
      >
        {logs.length === 0 ? (
          <Text style={[styles.emptyText, { color: theme?.textSecondary || '#666' }]}>
            {compact ? '暂无日志' : '📭 暂无日志记录\n\n操作后将在此显示'}
          </Text>
        ) : (
          logs.map((log, index) => (
            <Text 
              key={index} 
              style={[
                styles.logText, 
                compact && styles.compactLogText,
                { color: getLogColor(log) }
              ]}
            >
              {log}
            </Text>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  compactContainer: {
    maxHeight: 150,
  },
  scrollView: {
    maxHeight: 400,
  },
  compactScroll: {
    maxHeight: 150,
  },
  contentContainer: {
    padding: 12,
  },
  logText: {
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 4,
    lineHeight: 18,
  },
  compactLogText: {
    fontSize: 11,
    marginBottom: 2,
    lineHeight: 16,
  },
  emptyText: {
    textAlign: 'center',
    padding: 20,
    fontSize: 13,
  },
});
